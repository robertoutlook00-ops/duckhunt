import * as PIXI from 'pixi.js';
import { W, SCALE, SHOTS_PER_WAVE, DUCKS_PER_ROUND } from '../config.js';

function makeText(str, size, fill = '#ffffff', anchorX = 0) {
  const t = new PIXI.Text(str, {
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: size,
    fontWeight: 'bold',
    fill,
    stroke: '#000000',
    strokeThickness: size > 12 ? 2 : 1
  });
  t.resolution = SCALE;
  t.anchor.set(anchorX, 0);
  return t;
}

// Score, shots, round and the ten-duck tracker, plus centred messages and floating score popups.
export class Hud {
  constructor(tex, layer) {
    this.tex = tex;
    this.layer = layer;
    this.popups = [];

    this.bullets = Array.from({ length: SHOTS_PER_WAVE }, (_, i) => {
      const s = new PIXI.Sprite(tex.bullet);
      s.position.set(12 + i * 9, 206);
      layer.addChild(s);
      return s;
    });
    this.tracker = Array.from({ length: DUCKS_PER_ROUND }, (_, i) => {
      const s = new PIXI.Sprite(tex.icons.pending);
      s.position.set(46 + i * 11, 206);
      layer.addChild(s);
      return s;
    });

    this.add(makeText('SHOT', 7), 12, 222);
    this.add(makeText('HIT', 7), 46, 222);
    this.round = this.add(makeText('', 7), 12, 230);
    this.score = this.add(makeText('000000', 10, '#ffffff', 1), 246, 204);
    this.hi = this.add(makeText('HI 000000', 7, '#ffffff', 1), 246, 222);
    this.main = this.add(makeText('', 20, '#ffffff', 0.5), W / 2, 70);
    this.sub = this.add(makeText('', 8, '#ffffff', 0.5), W / 2, 100);
    this.hint = this.add(makeText('', 8, '#ffffff', 0.5), W / 2, 114);
  }

  add(text, x, y) {
    text.position.set(x, y);
    this.layer.addChild(text);
    return text;
  }

  setShots(n) { this.bullets.forEach((b, i) => { b.visible = i < n; }); }
  setScore(n) { this.score.text = String(n).padStart(6, '0'); }
  setHi(n) { this.hi.text = `HI ${String(n).padStart(6, '0')}`; }
  setRound(n) { this.round.text = `ROUND ${n}`; }
  setDuck(i, state) { this.tracker[i].texture = this.tex.icons[state]; }
  resetTracker() { this.tracker.forEach((_, i) => this.setDuck(i, 'pending')); }

  message(main = '', sub = '', hint = '') {
    this.main.text = main;
    this.sub.text = sub;
    this.hint.text = hint;
  }

  popup(str, x, y) {
    const t = makeText(str, 8);
    t.anchor.set(0.5, 0.5);
    t.position.set(x, y);
    this.layer.addChild(t);
    this.popups.push({ t, life: 0.9 });
  }

  update(dt) {
    for (const p of this.popups) {
      p.life -= dt;
      p.t.y -= 12 * dt;
    }
    this.popups = this.popups.filter((p) => {
      if (p.life > 0) return true;
      p.t.destroy();
      return false;
    });
  }
}
