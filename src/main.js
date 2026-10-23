import * as PIXI from 'pixi.js';
import { W, H, SCALE } from './config.js';
import { loadTextures } from './assets.js';
import { createAudio } from './audio.js';
import { Game } from './game/Game.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');

function fail(message) {
  canvas.style.display = 'none';
  status.textContent = message;
}

// WebGL when available, canvas otherwise. Add ?renderer=canvas to force the fallback.
function createRenderer() {
  const forceCanvas = new URLSearchParams(location.search).get('renderer') === 'canvas';
  return PIXI.autoDetectRenderer(W * SCALE, H * SCALE, { view: canvas, antialias: false, backgroundColor: 0x3cbcfc }, forceCanvas);
}

async function main() {
  if (!canvas.getContext) return fail('Your browser does not support the canvas element, so this game cannot run.');

  let renderer;
  try {
    renderer = createRenderer();
  } catch (err) {
    console.error(err);
    return fail('Could not start a WebGL or canvas renderer in this browser.');
  }

  const stage = new PIXI.Container();
  stage.scale.set(SCALE);

  const audio = createAudio();
  const textures = await loadTextures();
  const game = new Game(stage, textures, audio);

  const kind = renderer.type === PIXI.RENDERER_TYPE.WEBGL ? 'WebGL' : 'Canvas';
  const showStatus = (muted) => {
    status.textContent = `click to shoot \u00b7 Enter starts \u00b7 M ${muted ? 'unmutes' : 'mutes'} \u00b7 renderer: ${kind} \u00b7 audio: ${audio.mode}${muted ? ' (muted)' : ''}`;
  };
  showStatus(false);

  const toGame = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  canvas.addEventListener('pointermove', (e) => game.pointerMove(...toGame(e)));
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    game.pointerDown(...toGame(e));
  });
  addEventListener('keydown', (e) => {
    if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); game.start(); }
    if (e.code === 'KeyM') showStatus(audio.toggleMute());
  });

  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    game.update(dt);
    renderer.render(stage);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Handy for debugging and automated checks.
  window.__game = game;
}

main().catch((err) => {
  console.error(err);
  fail('Something went wrong while loading the game. Check the console for details.');
});
