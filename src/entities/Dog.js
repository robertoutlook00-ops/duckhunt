import * as PIXI from 'pixi.js';

const HIDDEN_Y = 218; // fully behind the foreground
const UP_Y = 156;     // head and shoulders above the grass
const lerp = (a, b, p) => a + (b - a) * p;

// The dog is driven by a list of timed steps: { dur, enter?, tick?(progress, elapsed) }.
export class Dog {
  constructor(tex, layers, audio) {
    this.tex = tex;
    this.layers = layers;
    this.audio = audio;
    this.sprite = new PIXI.Sprite(tex.walk[0]);
    this.sprite.anchor.set(0.5);
    this.sprite.visible = false;
    this.steps = [];
    this.elapsed = 0;
    this.done = null;
  }

  setLayer(front) {
    const target = front ? this.layers.front : this.layers.back;
    if (this.sprite.parent !== target) target.addChild(this.sprite);
  }

  run(steps, done) {
    this.steps = steps;
    this.done = done;
    this.begin();
  }

  begin() {
    this.elapsed = 0;
    this.steps[0].enter?.();
  }

  update(dt) {
    const step = this.steps[0];
    if (!step) return;
    this.elapsed += dt;
    const p = Math.min(this.elapsed / step.dur, 1);
    step.tick?.(p, this.elapsed);
    if (p < 1) return;
    this.steps.shift();
    if (this.steps.length) {
      this.begin();
    } else {
      this.sprite.visible = false;
      const done = this.done;
      this.done = null;
      done?.();
    }
  }

  // Round-start intro: walks in sniffing, barks, then jumps into the grass.
  walkIntro(done) {
    const { sprite, tex } = this;
    const show = () => { this.setLayer(true); sprite.visible = true; };
    const walk = (dur, x0, x1) => ({
      dur,
      enter: show,
      tick: (p, t) => { sprite.texture = tex.walk[Math.floor(t / 0.18) % 2]; sprite.x = lerp(x0, x1, p); sprite.y = 172; }
    });
    const sniff = (dur, x) => ({ dur, enter: show, tick: () => { sprite.texture = tex.sniff; sprite.x = x; sprite.y = 174; } });
    this.run([
      walk(1.4, -20, 70),
      sniff(0.5, 70),
      walk(0.9, 70, 105),
      sniff(0.5, 105),
      { dur: 0.35, enter: () => this.audio.play('bark'), tick: (p) => { sprite.texture = tex.jump[0]; sprite.x = lerp(105, 120, p); sprite.y = 172 - 40 * Math.sin(p * Math.PI / 2); } },
      { dur: 0.3, enter: () => this.setLayer(false), tick: (p) => { sprite.texture = tex.jump[1]; sprite.x = lerp(120, 128, p); sprite.y = 132 + 72 * p * p; } }
    ], done);
  }

  // Pops out of the grass holding `count` ducks, or laughing when count is 0.
  rise(count, x, done) {
    const { sprite, tex } = this;
    const frame = (t) => (count === 0 ? tex.laugh[Math.floor(t / 0.12) % 2] : tex.hold[Math.min(count, 2)]);
    this.run([
      { dur: 0.3, enter: () => { this.setLayer(false); sprite.visible = true; sprite.x = x; sprite.y = HIDDEN_Y; }, tick: (p, t) => { sprite.texture = frame(t); sprite.y = lerp(HIDDEN_Y, UP_Y, p); } },
      { dur: 1.2, tick: (p, t) => { sprite.texture = frame(t); sprite.y = UP_Y; } },
      { dur: 0.3, tick: (p, t) => { sprite.texture = frame(t); sprite.y = lerp(UP_Y, HIDDEN_Y, p); } }
    ], done);
  }
}
