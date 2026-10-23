import * as PIXI from 'pixi.js';
import { W, GRASS_Y, FLY_FLOOR, LAND_Y } from '../config.js';

const MARGIN = 16;
const HIT_FREEZE = 0.4;
const HIT_RADIUS = 15;
const FALL_ACCEL = 420;
const MAX_FALL = 240;
const AWAY_SPEED = 150;

const rand = (a, b) => a + Math.random() * (b - a);

// States: flying -> hit -> falling -> landed, or flying -> away -> gone.
export class Duck {
  constructor(frames, type, speed, events = {}) {
    this.frames = frames;
    this.type = type;
    this.speed = speed;
    this.events = events;
    this.state = 'flying';
    this.x = rand(50, W - 50);
    this.y = GRASS_Y - 12;
    this.animT = 0;
    this.pickDirection(true);
    this.sprite = new PIXI.Sprite(frames.fly[0]);
    this.sprite.anchor.set(0.5);
    this.sync();
  }

  pickDirection(upward = false) {
    const angle = rand(0.25, 1.2);
    const up = upward || Math.random() < 0.75;
    this.vx = (Math.random() < 0.5 ? -1 : 1) * Math.cos(angle) * this.speed;
    this.vy = (up ? -1 : 1) * Math.sin(angle) * this.speed;
    this.turnTimer = rand(0.7, 1.8);
  }

  contains(px, py) {
    return Math.hypot(px - this.x, py - this.y) <= HIT_RADIUS;
  }

  shoot() {
    this.state = 'hit';
    this.timer = HIT_FREEZE;
    this.vx = this.vy = 0;
    this.sprite.scale.x = Math.sign(this.sprite.scale.x) || 1;
    this.sprite.texture = this.frames.hit;
  }

  flyAway() {
    this.state = 'away';
    this.vx = 0;
    this.vy = -AWAY_SPEED;
  }

  update(dt) {
    this.animT += dt;
    switch (this.state) {
      case 'flying': this.updateFlying(dt); break;
      case 'hit':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'falling';
          this.vy = 0;
          this.events.onFall?.(this);
        }
        break;
      case 'falling':
        this.vy = Math.min(this.vy + FALL_ACCEL * dt, MAX_FALL);
        this.y += this.vy * dt;
        this.sprite.texture = this.frames.fall[Math.floor(this.animT / 0.1) % 2];
        if (this.y >= LAND_Y) {
          this.state = 'landed';
          this.events.onLand?.(this);
        }
        break;
      case 'away':
        this.y += this.vy * dt;
        this.flap();
        if (this.y < -24) this.state = 'gone';
        break;
      default: break;
    }
    this.sync();
  }

  updateFlying(dt) {
    this.turnTimer -= dt;
    if (this.turnTimer <= 0) this.pickDirection();
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < MARGIN) { this.x = MARGIN; this.vx = Math.abs(this.vx); }
    if (this.x > W - MARGIN) { this.x = W - MARGIN; this.vx = -Math.abs(this.vx); }
    if (this.y < MARGIN) { this.y = MARGIN; this.vy = Math.abs(this.vy); }
    if (this.y > FLY_FLOOR) { this.y = FLY_FLOOR; this.vy = -Math.abs(this.vy); }
    this.flap();
  }

  // Wing animation: climbing ducks use the diagonal frames, level ones the side frames.
  flap() {
    const climbing = this.vy < -Math.abs(this.vx) * 0.45;
    const set = climbing ? this.frames.dia : this.frames.fly;
    this.sprite.texture = set[[0, 1, 2, 1][Math.floor(this.animT * 10) % 4]];
    if (this.vx !== 0) this.sprite.scale.x = this.vx < 0 ? -1 : 1;
  }

  sync() {
    this.sprite.position.set(Math.round(this.x), Math.round(this.y));
  }
}
