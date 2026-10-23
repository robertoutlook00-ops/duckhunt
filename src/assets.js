import * as PIXI from 'pixi.js';
import spritesUrl from './assets/sprites.png';
import backgroundUrl from './assets/background.png';
import foregroundUrl from './assets/foreground.png';
import atlas from './assets/sprites.json';

function loadBase(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(new PIXI.BaseTexture(img, PIXI.SCALE_MODES.NEAREST));
    img.onerror = () => reject(new Error(`Could not load image: ${url}`));
    img.src = url;
  });
}

export async function loadTextures() {
  const [sheet, bg, fg] = await Promise.all([loadBase(spritesUrl), loadBase(backgroundUrl), loadBase(foregroundUrl)]);
  const frame = (name) => {
    const f = atlas[name];
    if (!f) throw new Error(`Missing sprite: ${name}`);
    return new PIXI.Texture(sheet, new PIXI.Rectangle(f.x, f.y, f.w, f.h));
  };
  const range = (prefix, n) => Array.from({ length: n }, (_, i) => frame(`${prefix}${i}`));

  return {
    background: new PIXI.Texture(bg),
    foreground: new PIXI.Texture(fg),
    ducks: [0, 1, 2].map((t) => ({
      fly: range(`duck${t}_fly`, 3),
      dia: range(`duck${t}_dia`, 3),
      hit: frame(`duck${t}_hit`),
      fall: range(`duck${t}_fall`, 2)
    })),
    dog: {
      walk: range('dog_walk', 2),
      sniff: frame('dog_sniff'),
      jump: range('dog_jump', 2),
      laugh: range('dog_laugh', 2),
      hold: [null, frame('dog_hold1'), frame('dog_hold2')]
    },
    gun: frame('gun'),
    flash: frame('flash'),
    crosshair: frame('crosshair'),
    bullet: frame('bullet'),
    icons: { pending: frame('icon_pending'), hit: frame('icon_hit'), miss: frame('icon_miss') }
  };
}
