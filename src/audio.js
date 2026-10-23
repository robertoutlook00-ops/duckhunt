import { Howl, Howler } from 'howler';

// Every .wav in src/assets/sounds is picked up by the build and gets a hashed URL.
const files = import.meta.glob('./assets/sounds/*.wav', { eager: true, query: '?url', import: 'default' });

const VOLUMES = { shot: 0.7, thud: 0.8, intro: 0.6, laugh: 0.6, gameover: 0.7 };

// Howler uses Web Audio when available and falls back to HTML5 Audio elements.
// If neither works every call becomes a silent no-op, so the game never depends on sound.
export function createAudio() {
  const sounds = {};
  let muted = false;

  try {
    for (const [file, url] of Object.entries(files)) {
      const name = file.split('/').pop().replace('.wav', '');
      sounds[name] = new Howl({ src: [url], volume: VOLUMES[name] ?? 0.5, preload: true });
    }
  } catch (err) {
    console.warn('Audio disabled:', err);
  }

  return {
    play(name) {
      if (muted || !sounds[name]) return;
      try { sounds[name].play(); } catch { /* ignore playback errors */ }
    },
    toggleMute() {
      muted = !muted;
      try { Howler.mute(muted); } catch { /* ignore */ }
      return muted;
    },
    get mode() {
      if (Howler.noAudio || !Object.keys(sounds).length) return 'none';
      return Howler.usingWebAudio ? 'Web Audio' : 'HTML5 Audio';
    }
  };
}
