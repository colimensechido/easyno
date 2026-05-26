// Sistema central de audio del juego.
// Los archivos se importan como URLs gracias a Vite (asset handling).
// El usuario puede silenciar globalmente con audio.setMuted(true) o vía el toggle de UI.

import cleandishUrl from "./files/audio/cleandish.wav";
import loginUrl from "./files/audio/login.wav";
import logoutUrl from "./files/audio/logout.wav";
import msgUrl from "./files/audio/msg.wav";
import pierdesUrl from "./files/audio/pierdes.wav";
import winUrl from "./files/audio/win.wav";

const sources = {
  cleandish: cleandishUrl,
  login: loginUrl,
  logout: logoutUrl,
  msg: msgUrl,
  pierdes: pierdesUrl,
  win: winUrl
};

// Volúmenes individuales (0..1). Algunos audios son más fuertes que otros.
const volumes = {
  cleandish: 0.85,
  login: 0.55,
  logout: 0.55,
  msg: 0.6,
  pierdes: 0.85,
  win: 0.95
};

const STORAGE_KEY = "economy-arcade-muted";

function readMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let muted = readMuted();
const listeners = new Set();
const cache = {};

function getAudio(name) {
  if (!sources[name]) return null;
  if (!cache[name]) {
    const audio = new Audio(sources[name]);
    audio.preload = "auto";
    audio.volume = volumes[name] ?? 0.7;
    cache[name] = audio;
  }
  return cache[name];
}

function notify() {
  listeners.forEach((cb) => cb(muted));
}

export const audio = {
  play(name) {
    if (muted) return;
    const a = getAudio(name);
    if (!a) return;
    try {
      // Clonar para permitir solapados (varios mensajes seguidos, etc.)
      const node = a.cloneNode(true);
      node.volume = a.volume;
      const playPromise = node.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // Autoplay bloqueado: ignorar, el audio se desbloqueará tras el primer click.
        });
      }
    } catch {
      /* noop */
    }
  },
  preload() {
    Object.keys(sources).forEach((name) => getAudio(name));
  },
  isMuted() {
    return muted;
  },
  setMuted(next) {
    muted = !!next;
    try {
      localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
    } catch {
      /* noop */
    }
    notify();
  },
  toggleMuted() {
    this.setMuted(!muted);
    return muted;
  },
  subscribe(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }
};
