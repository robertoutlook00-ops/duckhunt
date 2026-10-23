import * as PIXI from 'pixi.js';
import {
  W, DUCKS_PER_ROUND, DUCKS_PER_WAVE, SHOTS_PER_WAVE,
  requiredHits, duckSpeed, flightTime, pointsFor, pickDuckType
} from '../config.js';
import { Duck } from '../entities/Duck.js';
import { Dog } from '../entities/Dog.js';
import { Gun } from '../entities/Gun.js';
import { Hud } from './Hud.js';

const HI_KEY = 'duck-hunt-hi';

// Phases: title -> intro -> wave -> retrieve -> (wave ... | intro | gameover) -> title/intro
export class Game {
  constructor(stage, tex, audio) {
    this.tex = tex;
    this.audio = audio;

    // Draw order, back to front. The foreground grass hides the dog and landed ducks.
    const layer = () => stage.addChild(new PIXI.Container());
    const bg = layer(), ducks = layer(), dogBack = layer(), fg = layer(), dogFront = layer(), ui = layer(), gun = layer(), cursor = layer();
    bg.addChild(new PIXI.Sprite(tex.background));
    fg.addChild(new PIXI.Sprite(tex.foreground));
    this.duckLayer = ducks;

    this.dog = new Dog(tex.dog, { back: dogBack, front: dogFront }, audio);
    this.hud = new Hud(tex, ui);
    this.gun = new Gun(tex, gun);
    this.crosshair = new PIXI.Sprite(tex.crosshair);
    this.crosshair.anchor.set(0.5);
    this.crosshair.position.set(W / 2, 100);
    cursor.addChild(this.crosshair);

    this.timers = [];
    this.ducks = [];
    this.hi = Number(this.readHi());
    this.showTitle();
  }

  /* ---------- flow ---------- */

  showTitle() {
    this.phase = 'title';
    this.hud.setShots(0);
    this.hud.resetTracker();
    this.hud.setScore(0);
    this.hud.setRound(1);
    this.hud.setHi(this.hi);
    this.hud.message('DUCK HUNT', 'CLICK OR PRESS ENTER TO PLAY', 'hit the ducks before they fly away');
  }

  newGame() {
    this.timers = [];
    this.score = 0;
    this.round = 1;
    this.hud.setScore(0);
    this.startRound(true);
  }

  startRound(withDog) {
    this.phase = 'intro';
    this.ducksDone = 0;
    this.roundHits = 0;
    this.hud.setRound(this.round);
    this.hud.resetTracker();
    this.hud.setShots(0);
    this.hud.message(`ROUND ${this.round}`, `HIT ${requiredHits(this.round)} OF ${DUCKS_PER_ROUND}`);
    this.audio.play('intro');
    if (withDog) {
      this.dog.walkIntro(() => this.startWave());
    } else {
      this.after(2, () => this.startWave());
    }
  }

  startWave() {
    this.phase = 'wave';
    this.hud.message();
    this.shots = SHOTS_PER_WAVE;
    this.hud.setShots(this.shots);
    this.waveTime = flightTime(this.round);
    this.noAmmoTime = 0;
    this.fleeing = false;
    this.ducks = Array.from({ length: DUCKS_PER_WAVE }, () => {
      const type = pickDuckType(this.round);
      const duck = new Duck(this.tex.ducks[type], type, duckSpeed(this.round), {
        onFall: () => this.audio.play('fall'),
        onLand: () => this.audio.play('thud')
      });
      this.duckLayer.addChild(duck.sprite);
      return duck;
    });
    this.audio.play('quack');
  }

  updateWave(dt) {
    const flying = this.ducks.filter((d) => d.state === 'flying');
    if (flying.length && !this.fleeing) {
      this.waveTime -= dt;
      if (this.shots === 0) this.noAmmoTime += dt;
      if (this.waveTime <= 0 || this.noAmmoTime > 0.7) {
        this.fleeing = true;
        flying.forEach((d) => d.flyAway());
        this.hud.message('FLY AWAY');
      }
    }
    if (this.ducks.every((d) => d.state === 'landed' || d.state === 'gone')) this.endWave();
  }

  endWave() {
    this.phase = 'retrieve';
    this.hud.message();
    const caught = this.ducks.filter((d) => d.state === 'landed');
    this.ducks.forEach((d, i) => this.hud.setDuck(this.ducksDone + i, d.state === 'landed' ? 'hit' : 'miss'));
    this.roundHits += caught.length;
    const x = caught.length ? Math.max(30, Math.min(W - 30, caught[0].x)) : W / 2;
    this.ducks.forEach((d) => d.sprite.destroy());
    this.ducks = [];

    this.audio.play(caught.length ? 'retrieve' : 'laugh');
    this.dog.rise(caught.length, x, () => {
      this.ducksDone += DUCKS_PER_WAVE;
      if (this.ducksDone >= DUCKS_PER_ROUND) this.finishRound();
      else this.after(0.3, () => this.startWave());
    });
  }

  finishRound() {
    if (this.roundHits < requiredHits(this.round)) {
      this.gameOver();
      return;
    }
    if (this.roundHits === DUCKS_PER_ROUND) {
      this.addScore(10000);
      this.audio.play('perfect');
      this.hud.message('PERFECT!!', '10000 BONUS');
    }
    this.round++;
    this.after(this.roundHits === DUCKS_PER_ROUND ? 2.2 : 0.4, () => this.startRound(false));
  }

  gameOver() {
    this.phase = 'gameover';
    this.canRestart = false;
    if (this.score > this.hi) {
      this.hi = this.score;
      this.hud.setHi(this.hi);
      this.writeHi(this.hi);
    }
    this.hud.message('GAME OVER');
    this.audio.play('gameover');
    this.after(1.2, () => {
      this.audio.play('laugh');
      this.dog.rise(0, W / 2, () => {
        this.canRestart = true;
        this.hud.message('GAME OVER', 'CLICK OR PRESS ENTER TO PLAY AGAIN');
      });
    });
  }

  /* ---------- shooting ---------- */

  shoot(x, y) {
    if (this.shots <= 0) {
      this.audio.play('empty');
      return;
    }
    this.shots--;
    this.hud.setShots(this.shots);
    this.gun.fire();
    this.audio.play('shot');
    const target = this.ducks.find((d) => d.state === 'flying' && d.contains(x, y));
    if (!target) return;
    target.shoot();
    this.audio.play('hit');
    const points = pointsFor(target.type, this.round);
    this.addScore(points);
    this.hud.popup(String(points), target.x, target.y - 18);
  }

  addScore(n) {
    this.score += n;
    this.hud.setScore(this.score);
  }

  /* ---------- input ---------- */

  pointerMove(x, y) {
    this.crosshair.position.set(x, y);
    this.gun.aim(x, y);
  }

  pointerDown(x, y) {
    this.pointerMove(x, y);
    if (this.phase === 'wave') this.shoot(x, y);
    else this.start();
  }

  start() {
    if (this.phase === 'title' || (this.phase === 'gameover' && this.canRestart)) this.newGame();
  }

  /* ---------- loop ---------- */

  after(seconds, fn) {
    this.timers.push({ left: seconds, fn });
  }

  update(dt) {
    for (const t of this.timers.slice()) {
      t.left -= dt;
      if (t.left <= 0) {
        this.timers.splice(this.timers.indexOf(t), 1);
        t.fn();
      }
    }
    this.dog.update(dt);
    this.gun.update(dt);
    this.hud.update(dt);
    this.ducks.forEach((d) => d.update(dt));
    if (this.phase === 'wave') this.updateWave(dt);
  }

  readHi() {
    try { return localStorage.getItem(HI_KEY) || 0; } catch { return 0; }
  }

  writeHi(n) {
    try { localStorage.setItem(HI_KEY, String(n)); } catch { /* storage unavailable */ }
  }
}
