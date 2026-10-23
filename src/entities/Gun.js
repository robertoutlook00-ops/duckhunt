import * as PIXI from 'pixi.js';
import { H } from '../config.js';

const BASE_X = 176;
const BASE_Y = H + 6;
const TIP = 30;

// A zapper that swings toward the cursor, kicks back when fired and shows a muzzle flash.
export class Gun {
  constructor(tex, layer) {
    this.sprite = new PIXI.Sprite(tex.gun);
    this.sprite.anchor.set(0.5, 0.9);
    this.sprite.position.set(BASE_X, BASE_Y);
    this.flash = new PIXI.Sprite(tex.flash);
    this.flash.anchor.set(0.5);
    this.flash.visible = false;
    layer.addChild(this.sprite, this.flash);
    this.recoil = 0;
    this.flashTime = 0;
  }

  aim(x, y) {
    const angle = Math.atan2(x - BASE_X, BASE_Y - y);
    this.sprite.rotation = Math.max(-1.2, Math.min(1.2, angle));
  }

  fire() {
    this.recoil = 1;
    this.flashTime = 0.06;
  }

  update(dt) {
    this.recoil = Math.max(0, this.recoil - dt * 8);
    this.flashTime = Math.max(0, this.flashTime - dt);
    const r = this.sprite.rotation;
    const kick = this.recoil * 5;
    this.sprite.position.set(BASE_X + Math.sin(r) * -kick, BASE_Y + Math.cos(r) * kick);
    this.flash.visible = this.flashTime > 0;
    this.flash.position.set(BASE_X + Math.sin(r) * (TIP + 4), BASE_Y - Math.cos(r) * (TIP + 4));
    this.flash.rotation = r;
  }
}
