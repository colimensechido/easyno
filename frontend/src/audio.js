// Sistema central de audio del juego.
// Los archivos se importan como URLs gracias a Vite.

import cleandishUrl from "./files/audio/cleandish.wav";
import loginUrl from "./files/audio/login.wav";
import logoutUrl from "./files/audio/logout.wav";
import msgUrl from "./files/audio/msg.wav";
import pierdesUrl from "./files/audio/pierdes.wav";
import winUrl from "./files/audio/win.wav";
import buyPropiedadUrl from "./files/audio/buypropiedad.wav";
import comprarCasaUrl from "./files/audio/comprarcasa.wav";
import rodar1Url from "./files/audio/rodar1.wav";
import rodar2Url from "./files/audio/rodar2.wav";
import rodar3Url from "./files/audio/rodar3.wav";
import selectMenuUrl from "./files/audio/selectmenu.wav";
import tuTurnoUrl from "./files/audio/tuturno.wav";
import venderUrl from "./files/audio/vender.wav";

const sources = {
  cleandish: cleandishUrl,
  login: loginUrl,
  logout: logoutUrl,
  msg: msgUrl,
  pierdes: pierdesUrl,
  win: winUrl,
  buypropiedad: buyPropiedadUrl,
  comprarcasa: comprarCasaUrl,
  rodar1: rodar1Url,
  rodar2: rodar2Url,
  rodar3: rodar3Url,
  selectmenu: selectMenuUrl,
  tuturno: tuTurnoUrl,
  vender: venderUrl
};

const volumes = {
  cleandish: 0.85,
  login: 0.55,
  logout: 0.55,
  msg: 0.6,
  pierdes: 0.85,
  win: 0.95,
  buypropiedad: 0.75,
  comprarcasa: 0.75,
  rodar1: 0.8,
  rodar2: 0.8,
  rodar3: 0.8,
  selectmenu: 0.45,
  tuturno: 0.9,
  vender: 0.75
};

const STORAGE_KEY = "economy-arcade-muted";
const DICE_AUDIO_POOL = ["rodar1", "rodar2", "rodar3"];

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
    const node = new Audio(sources[name]);
    node.preload = "auto";
    node.volume = volumes[name] ?? 0.7;
    cache[name] = node;
  }
  return cache[name];
}

function notify() {
  listeners.forEach((callback) => callback(muted));
}

export const audio = {
  playRandomDice() {
    const pick = DICE_AUDIO_POOL[Math.floor(Math.random() * DICE_AUDIO_POOL.length)];
    this.play(pick);
  },
  play(name) {
    if (muted) return;
    const source = getAudio(name);
    if (!source) return;

    try {
      const node = source.cloneNode(true);
      node.volume = source.volume;
      const playPromise = node.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    } catch {
      // noop
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
      // noop
    }
    notify();
  },
  toggleMuted() {
    this.setMuted(!muted);
    return muted;
  },
  subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }
};
