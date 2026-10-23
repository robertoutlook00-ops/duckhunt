// Generates every image and sound used by the game into src/assets.
// Run with `npm run assets` (also runs automatically before `npm run build`).
// All art is drawn procedurally here, so the project has no external asset dependencies.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'src', 'assets');
const soundDir = path.join(outDir, 'sounds');
mkdirSync(soundDir, { recursive: true });

/* ------------------------------------------------------------------ PNG */

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG({ w, h, data }) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * stride + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* -------------------------------------------------------- pixel drawing */

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const newImage = (w, h) => ({ w, h, data: new Uint8Array(w * h * 4) });
function put(img, x, y, c) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const i = (y * img.w + x) * 4;
  img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
}
const alphaAt = (img, x, y) => (x < 0 || y < 0 || x >= img.w || y >= img.h ? 0 : img.data[(y * img.w + x) * 4 + 3]);

function addOutline(img, color = [0, 0, 0]) {
  const out = { ...img, data: img.data.slice() };
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (alphaAt(img, x, y)) continue;
      if (alphaAt(img, x - 1, y) || alphaAt(img, x + 1, y) || alphaAt(img, x, y - 1) || alphaAt(img, x, y + 1)) put(out, x, y, color);
    }
  }
  return out;
}

// Shapes are tested in local coordinates (origin at the cell centre, y down); later shapes paint over earlier ones.
const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const circ = (cx, cy, r) => ell(cx, cy, r, r);
const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const tri = (a, b, c) => (x, y) => {
  const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d;
  const l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d;
  return l1 >= 0 && l2 >= 0 && 1 - l1 - l2 >= 0;
};

function draw(w, h, shapes, { rot = 0, outline = true } = {}) {
  const img = newImage(w, h);
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const parsed = shapes.map(([c, f]) => [rgb(c), f]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - w / 2, py = y + 0.5 - h / 2;
      const lx = px * cs + py * sn, ly = -px * sn + py * cs;
      let hit = null;
      for (const [c, f] of parsed) if (f(lx, ly)) hit = c;
      if (hit) put(img, x, y, hit);
    }
  }
  return outline ? addOutline(img) : img;
}

/* ---------------------------------------------------------------- sprites */

const DUCK_PALETTES = [
  { body: '#5a3a1a', belly: '#8a6030', wing: '#a07840', tip: '#e8d8a8' }, // black duck
  { body: '#2848b8', belly: '#5878e0', wing: '#7898f8', tip: '#d8e4ff' }, // blue duck
  { body: '#b82818', belly: '#e05838', wing: '#f88860', tip: '#ffe0c8' }  // red duck
];
const WINGS = {
  up: [[-3, 0], [-10, -13], [5, -1]],
  mid: [[-3, 0], [-14, -3], [5, 1]],
  down: [[-3, 2], [-9, 11], [5, 3]]
};
function duckShapes(p, wing, dead = false) {
  return [
    [p.body, tri([-9, 0], [-16, -3], [-10, 5])],
    [p.body, ell(0, 2, 10.5, 6.5)],
    [p.belly, ell(0, 5, 7.5, 3)],
    ['#10802c', circ(9.5, -6, 4.8)],
    ['#ffffff', ell(7.5, -1.8, 3, 1.3)],
    ['#f0a010', ell(14.5, -5, 3.6, 1.8)],
    dead ? ['#e02010', rect(10, -8, 12, -6)] : ['#ffffff', rect(10, -8, 12, -6)],
    ['#000000', rect(11, -7, 12, -6)],
    [p.wing, tri(...WINGS[wing])],
    [p.tip, tri([WINGS[wing][1][0], WINGS[wing][1][1]], [WINGS[wing][1][0] + 4, WINGS[wing][1][1] + (wing === 'down' ? -3 : 3)], [WINGS[wing][1][0] + 1, WINGS[wing][1][1] + (wing === 'down' ? -6 : 6)])]
  ];
}

const DOG = { tan: '#d88a3c', dark: '#7a3e10', light: '#f0c070' };
function dogSide({ dx = 0, hd = 0, tuck = false }) {
  const legEnd = tuck ? 12 : 16;
  return [
    [DOG.tan, tri([-13, 1], [-21, -6], [-12, 6])],
    [DOG.tan, ell(-2, 4, 13, 7)],
    [DOG.tan, rect(6 + dx, 8, 9 + dx, legEnd)],
    [DOG.tan, rect(-12 - dx, 8, -9 - dx, legEnd)],
    [DOG.tan, circ(12, hd, 7)],
    [DOG.light, ell(18, 2 + hd, 5, 3.5)],
    ['#000000', circ(22, 1.5 + hd, 1.8)],
    [DOG.dark, ell(8, hd, 3.5, 6)],
    ['#000000', rect(13, -3 + hd, 14.5, -1.5 + hd)]
  ];
}
function heldDuck(x, y) {
  return [
    ['#5a3a1a', ell(x, y, 4.5, 3.2)],
    ['#10802c', circ(x, y - 5, 2.6)],
    ['#f0a010', rect(x - 1, y - 4, x + 1, y - 3)]
  ];
}
function dogFront({ laugh = 0, arms = false, ducks = [], dy = 0 }) {
  const s = [
    [DOG.tan, ell(0, 18 + dy, 11, 8)]
  ];
  if (arms) s.push([DOG.tan, rect(-14, -3, -10, 16)], [DOG.tan, rect(10, -3, 14, 16)]);
  s.push(
    [DOG.dark, ell(-11, 2 + dy, 3.5, 7)],
    [DOG.dark, ell(11, 2 + dy, 3.5, 7)],
    [DOG.tan, circ(0, 2 + dy, 9)],
    [DOG.light, ell(0, 7 + dy, 6, 4.2)],
    ['#000000', ell(0, 4.5 + dy, 2.4, 1.6)]
  );
  if (laugh) {
    s.push(
      ['#000000', rect(-6, -1 + dy, -2, 0 + dy)], ['#000000', rect(2, -1 + dy, 6, 0 + dy)],
      ['#000000', ell(0, 9 + dy, 3.8 + laugh, 2.6 + laugh)], ['#e03030', ell(0, 10.4 + dy, 2.2, 1.3)]
    );
  } else {
    s.push(['#000000', rect(-5, -1 + dy, -3, 1 + dy)], ['#000000', rect(3, -1 + dy, 5, 1 + dy)], ['#000000', rect(-3, 9 + dy, 3, 9.6 + dy)]);
  }
  for (const [x, y] of ducks) s.push(...heldDuck(x, y));
  return s;
}

function buildSprites() {
  const sprites = {};
  for (let t = 0; t < 3; t++) {
    const p = DUCK_PALETTES[t];
    ['up', 'mid', 'down'].forEach((w, i) => {
      sprites[`duck${t}_fly${i}`] = draw(40, 40, duckShapes(p, w));
      sprites[`duck${t}_dia${i}`] = draw(40, 40, duckShapes(p, w), { rot: -0.65 });
    });
    sprites[`duck${t}_hit`] = draw(40, 40, duckShapes(p, 'mid', true));
    sprites[`duck${t}_fall0`] = draw(40, 40, duckShapes(p, 'up', true), { rot: Math.PI / 2 });
    sprites[`duck${t}_fall1`] = draw(40, 40, duckShapes(p, 'down', true), { rot: Math.PI / 2 });
  }
  sprites.dog_walk0 = draw(48, 40, dogSide({ dx: 2 }));
  sprites.dog_walk1 = draw(48, 40, dogSide({ dx: -2 }));
  sprites.dog_sniff = draw(48, 40, dogSide({ hd: 6 }));
  sprites.dog_jump0 = draw(48, 40, dogSide({ tuck: true }), { rot: -0.7 });
  sprites.dog_jump1 = draw(48, 40, dogSide({ tuck: true }), { rot: 0.7 });
  sprites.dog_laugh0 = draw(48, 48, dogFront({ laugh: 0.4 }));
  sprites.dog_laugh1 = draw(48, 48, dogFront({ laugh: 1.2, dy: -1 }));
  sprites.dog_hold1 = draw(48, 48, dogFront({ arms: true, ducks: [[12, -9]] }));
  sprites.dog_hold2 = draw(48, 48, dogFront({ arms: true, ducks: [[-12, -9], [12, -9]] }));

  sprites.gun = draw(16, 40, [
    ['#c8c8c8', rect(-2, -18, 2, 6)],
    ['#ff6a00', rect(-2, -18, 2, -14)],
    ['#383838', rect(-4, 4, 4, 14)],
    ['#585858', rect(-3, 14, 3, 20)]
  ]);
  sprites.flash = draw(16, 16, [
    ['#ffd000', rect(-1, -7, 1, 7)], ['#ffd000', rect(-7, -1, 7, 1)],
    ['#ffd000', tri([-5, -5], [5, 5], [-5, 5])], ['#ffffff', circ(0, 0, 3.5)]
  ], { outline: false });
  sprites.crosshair = draw(17, 17, [
    ['#ffffff', rect(-1, -8, 0, -3)], ['#ffffff', rect(-1, 3, 0, 8)],
    ['#ffffff', rect(-8, -1, -3, 0)], ['#ffffff', rect(3, -1, 8, 0)], ['#ff3020', rect(-1, -1, 0, 0)]
  ]);
  sprites.bullet = draw(6, 10, [['#ffd000', rect(-2, -4, 2, 4)], ['#ff6a00', rect(-2, 2, 2, 4)]], { outline: false });
  sprites.icon_pending = draw(10, 10, [['#808080', ell(0, 0, 4, 3.5)]], { outline: false });
  sprites.icon_hit = draw(10, 10, [['#ff3020', ell(0, 0, 4, 3.5)]], { outline: false });
  sprites.icon_miss = draw(10, 10, [['#ffffff', ell(0, 0, 4, 3.5)]], { outline: false });
  return sprites;
}

function packAtlas(sprites, width = 512) {
  const frames = {};
  let x = 0, y = 0, rowH = 0;
  for (const [name, img] of Object.entries(sprites)) {
    if (x + img.w > width) { x = 0; y += rowH; rowH = 0; }
    frames[name] = { x, y, w: img.w, h: img.h };
    x += img.w;
    rowH = Math.max(rowH, img.h);
  }
  const atlas = newImage(width, y + rowH);
  for (const [name, img] of Object.entries(sprites)) {
    const f = frames[name];
    for (let j = 0; j < img.h; j++) {
      const src = j * img.w * 4;
      atlas.data.set(img.data.subarray(src, src + img.w * 4), ((f.y + j) * width + f.x) * 4);
    }
  }
  return { atlas, frames };
}

/* ------------------------------------------------------------ backgrounds */

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function fillRect(img, x0, y0, x1, y1, c) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) put(img, x, y, c);
}
function fillCircle(img, cx, cy, r, c) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(img, x, y, c);
}

function buildBackground() {
  const img = newImage(256, 240);
  fillRect(img, 0, 0, 256, 240, rgb('#3cbcfc'));
  const bush = rgb('#00a800'), bushHi = rgb('#58d854');
  for (let x = 0; x < 256; x++) {
    const top = 152 + Math.round(8 * Math.sin(x / 9) + 5 * Math.sin(x / 4.3));
    fillRect(img, x, top, x + 1, 200, bush);
    fillRect(img, x, top, x + 1, top + 2, bushHi);
  }
  fillRect(img, 30, 96, 39, 182, rgb('#7a3e10'));
  fillRect(img, 30, 96, 32, 182, rgb('#a05a10'));
  for (const [cx, cy, r] of [[34, 78, 22], [16, 92, 14], [52, 92, 14], [34, 100, 12]]) fillCircle(img, cx, cy, r, rgb('#004800'));
  for (const [cx, cy, r] of [[34, 78, 20], [16, 92, 12], [52, 92, 12], [34, 100, 10]]) fillCircle(img, cx, cy, r, rgb('#00a800'));
  for (const [cx, cy, r] of [[30, 72, 8], [14, 88, 5], [46, 86, 6]]) fillCircle(img, cx, cy, r, rgb('#58d854'));
  return img;
}

function buildForeground() {
  const img = newImage(256, 240);
  const rand = rng(7);
  const grass = rgb('#38b800'), grassHi = rgb('#80e040'), grassDk = rgb('#207800');
  for (let x = 0; x < 256; x++) {
    const top = 176 - Math.round(2 * Math.abs(Math.sin(x / 11)) + (rand() < 0.2 ? 3 : 0));
    fillRect(img, x, top, x + 1, 198, grass);
    fillRect(img, x, top, x + 1, top + 2, grassHi);
    if (rand() < 0.12) fillRect(img, x, top + 4, x + 1, top + 10, grassDk);
  }
  const dirt = rgb('#c87820'), pebble = rgb('#a05a10');
  fillRect(img, 0, 198, 256, 240, dirt);
  fillRect(img, 0, 198, 256, 200, rgb('#000000'));
  for (let i = 0; i < 160; i++) {
    const px = Math.floor(rand() * 254), py = 202 + Math.floor(rand() * 36);
    fillRect(img, px, py, px + 2, py + 1, pebble);
  }
  return img;
}

/* ------------------------------------------------------------------ audio */

const SR = 22050;
const buffer = (sec) => new Float32Array(Math.ceil(sec * SR));
const osc = (type, ph) => {
  const s = Math.sin(ph);
  if (type === 'square') return s >= 0 ? 1 : -1;
  if (type === 'triangle') return (2 / Math.PI) * Math.asin(s);
  if (type === 'saw') return 2 * ((ph / (2 * Math.PI)) % 1) - 1;
  return s;
};
function tone(buf, { start = 0, dur, f0, f1 = f0, type = 'square', vol = 0.3, vib = 0 }) {
  const s0 = Math.floor(start * SR), n = Math.floor(dur * SR);
  let ph = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const t = i / n;
    const f = f0 + (f1 - f0) * t + (vib ? Math.sin(i / SR * 40) * vib : 0);
    ph += (2 * Math.PI * f) / SR;
    const env = Math.min(1, i / (0.004 * SR)) * (1 - t) ** 1.5;
    buf[s0 + i] += osc(type, ph) * vol * env;
  }
}
function noise(buf, { start = 0, dur, vol = 0.4, lp = 0.5 }) {
  const s0 = Math.floor(start * SR), n = Math.floor(dur * SR);
  let y = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    y += lp * ((Math.random() * 2 - 1) - y);
    buf[s0 + i] += y * vol * (1 - i / n) ** 2;
  }
}
function melody(freqs, note, type = 'square', vol = 0.25) {
  const buf = buffer(freqs.length * note + 0.1);
  freqs.forEach((f, i) => f && tone(buf, { start: i * note, dur: note * 0.95, f0: f, type, vol }));
  return buf;
}
function wav(buf) {
  const data = Buffer.alloc(44 + buf.length * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + buf.length * 2, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(buf.length * 2, 40);
  buf.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  return data;
}

function buildSounds() {
  const s = {};
  s.shot = (() => { const b = buffer(0.3); noise(b, { dur: 0.28, vol: 0.9, lp: 0.55 }); tone(b, { dur: 0.2, f0: 220, f1: 50, type: 'sine', vol: 0.6 }); return b; })();
  s.empty = (() => { const b = buffer(0.08); tone(b, { dur: 0.05, f0: 1200, type: 'square', vol: 0.15 }); return b; })();
  s.hit = (() => { const b = buffer(0.2); noise(b, { dur: 0.1, vol: 0.5, lp: 0.7 }); tone(b, { dur: 0.15, f0: 500, f1: 110, type: 'triangle', vol: 0.5 }); return b; })();
  s.quack = (() => { const b = buffer(0.4); tone(b, { dur: 0.13, f0: 430, f1: 260, type: 'saw', vol: 0.22 }); tone(b, { start: 0.16, dur: 0.13, f0: 400, f1: 240, type: 'saw', vol: 0.22 }); return b; })();
  s.fall = (() => { const b = buffer(0.8); tone(b, { dur: 0.75, f0: 1500, f1: 180, type: 'sine', vol: 0.25 }); return b; })();
  s.thud = (() => { const b = buffer(0.3); tone(b, { dur: 0.2, f0: 130, f1: 40, type: 'sine', vol: 0.8 }); noise(b, { dur: 0.12, vol: 0.3, lp: 0.12 }); return b; })();
  s.bark = (() => { const b = buffer(0.35); tone(b, { dur: 0.09, f0: 320, f1: 180, type: 'saw', vol: 0.3 }); tone(b, { start: 0.14, dur: 0.09, f0: 320, f1: 180, type: 'saw', vol: 0.3 }); return b; })();
  s.intro = melody([523, 587, 659, 784, 659, 784, 1047, 1047, 1047], 0.15);
  s.retrieve = melody([784, 988, 1175, 1568, 1568], 0.1);
  s.laugh = (() => { const b = buffer(1.4); for (let i = 0; i < 9; i++) tone(b, { start: i * 0.12, dur: 0.1, f0: i % 2 ? 760 : 920, f1: i % 2 ? 700 : 860, type: 'square', vol: 0.22, vib: 60 }); return b; })();
  s.gameover = melody([392, 349, 330, 294, 262, 0, 262], 0.28, 'triangle', 0.4);
  s.perfect = melody([523, 659, 784, 1047, 784, 1047, 1319, 1568], 0.1);
  return s;
}

/* ------------------------------------------------------------------ write */

const sprites = buildSprites();
const { atlas, frames } = packAtlas(sprites);
writeFileSync(path.join(outDir, 'sprites.png'), encodePNG(atlas));
writeFileSync(path.join(outDir, 'sprites.json'), JSON.stringify(frames, null, 1));
writeFileSync(path.join(outDir, 'background.png'), encodePNG(buildBackground()));
writeFileSync(path.join(outDir, 'foreground.png'), encodePNG(buildForeground()));
const sounds = buildSounds();
for (const [name, buf] of Object.entries(sounds)) writeFileSync(path.join(soundDir, `${name}.wav`), wav(buf));
console.log(`assets: ${Object.keys(sprites).length} sprites, ${Object.keys(sounds).length} sounds -> ${path.relative(root, outDir)}`);
