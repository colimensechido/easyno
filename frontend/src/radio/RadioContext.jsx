import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { audio } from "../audio";
import radioSource from "../files/audio/radio_monopoly/source.json";

const RadioContext = createContext(null);
const RADIO_VOLUME_KEY = "easyno-radio-volume";
const RADIO_STATION_KEY = "easyno-radio-station";
const DEFAULT_VOLUME = 0.15;
const ALL_CATEGORIES = "ALL";

function clampVolume(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, parsed));
}

function readStoredVolume() {
  try {
    const stored = window.localStorage.getItem(RADIO_VOLUME_KEY);
    return stored === null ? DEFAULT_VOLUME : clampVolume(stored);
  } catch {
    return DEFAULT_VOLUME;
  }
}

function writeStoredVolume(value) {
  try {
    window.localStorage.setItem(RADIO_VOLUME_KEY, String(clampVolume(value)));
  } catch {
    // noop
  }
}

function readStoredStation(stations) {
  try {
    const raw = window.localStorage.getItem(RADIO_STATION_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    return resolveStation(stations, stored?.id) || resolveStation(stations, stored?.url) || null;
  } catch {
    return null;
  }
}

function writeStoredStation(station) {
  try {
    if (!station) {
      window.localStorage.removeItem(RADIO_STATION_KEY);
      return;
    }
    window.localStorage.setItem(RADIO_STATION_KEY, JSON.stringify({
      id: station.id,
      url: station.URL
    }));
  } catch {
    // noop
  }
}

function sameAudioUrl(left, right) {
  if (!left || !right) return false;
  try {
    return new URL(left, window.location.href).href === new URL(right, window.location.href).href;
  } catch {
    return String(left) === String(right);
  }
}

function normalizeStation(station, index) {
  const name = String(station?.NOMBRE || "").trim();
  const category = String(station?.CATEGORIA || "").trim();
  const url = String(station?.URL || "").trim();
  const defaultGame = station?.DEFAULT ? String(station.DEFAULT).trim().toUpperCase() : null;

  return {
    ...station,
    id: `${name || "station"}-${url || index}-${index}`,
    NOMBRE: name,
    CATEGORIA: category,
    URL: url,
    DEFAULT: defaultGame,
    name,
    category,
    url,
    defaultGame
  };
}

function resolveStation(stations, stationOrId) {
  if (!stationOrId) return null;
  if (typeof stationOrId === "string") {
    return stations.find((station) => station.id === stationOrId || station.URL === stationOrId || station.NOMBRE === stationOrId) || null;
  }
  return stations.find((station) => station.id === stationOrId.id || station.URL === stationOrId.URL) || null;
}

export function RadioProvider({ children }) {
  const stations = useMemo(
    () => (Array.isArray(radioSource) ? radioSource : [])
      .map(normalizeStation)
      .filter((station) => station.NOMBRE && station.CATEGORIA && station.URL),
    []
  );
  const categories = useMemo(
    () => [...new Set(stations.map((station) => station.CATEGORIA).filter(Boolean))].sort((left, right) => left.localeCompare(right, "es")),
    [stations]
  );
  const initialStation = useMemo(() => readStoredStation(stations), [stations]);

  const audioRef = useRef(null);
  const errorTimeoutRef = useRef(null);
  const playAttemptRef = useRef(0);
  const manualStationRef = useRef(Boolean(initialStation));
  const playbackTouchedRef = useRef(false);
  const currentStationRef = useRef(initialStation);
  const isPlayingRef = useRef(false);
  const [currentStation, setCurrentStationState] = useState(initialStation);
  const [activeGameKey, setActiveGameKeyState] = useState("");
  const [category, setCategoryState] = useState(initialStation?.CATEGORIA || ALL_CATEGORIES);
  const [volume, setVolumeState] = useState(readStoredVolume);
  const [isPlaying, setIsPlayingState] = useState(false);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(() => audio.isMuted());

  useEffect(() => audio.subscribe(setMuted), []);

  const setCurrentStation = useCallback((station) => {
    currentStationRef.current = station;
    setCurrentStationState(station);
    writeStoredStation(station);
  }, []);

  const setActiveGameKey = useCallback((nextGameKey) => {
    setActiveGameKeyState(String(nextGameKey || "").trim().toUpperCase());
  }, []);

  const setIsPlaying = useCallback((next) => {
    isPlayingRef.current = Boolean(next);
    setIsPlayingState(Boolean(next));
  }, []);

  useEffect(() => {
    currentStationRef.current = currentStation;
  }, [currentStation]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const node = new Audio();
    node.preload = "none";
    audioRef.current = node;

    function clearPendingError() {
      if (errorTimeoutRef.current) {
        window.clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
    }

    function isCurrentNodeSource() {
      const station = currentStationRef.current;
      return Boolean(station && sameAudioUrl(node.currentSrc || node.src, station.URL));
    }

    function handleError() {
      if (!isCurrentNodeSource()) return;
      const stationId = currentStationRef.current?.id;
      clearPendingError();
      errorTimeoutRef.current = window.setTimeout(() => {
        if (stationId !== currentStationRef.current?.id || !isPlayingRef.current) return;
        setError("No se pudo cargar esta estacion. Prueba con otra radio.");
        setIsPlaying(false);
      }, 900);
    }

    function handleEnded() {
      if (!isCurrentNodeSource()) return;
      setIsPlaying(false);
    }

    function handlePlaying() {
      clearPendingError();
      setError("");
    }

    node.addEventListener("error", handleError);
    node.addEventListener("ended", handleEnded);
    node.addEventListener("playing", handlePlaying);

    return () => {
      clearPendingError();
      node.pause();
      node.removeAttribute("src");
      node.load();
      node.removeEventListener("error", handleError);
      node.removeEventListener("ended", handleEnded);
      node.removeEventListener("playing", handlePlaying);
      audioRef.current = null;
    };
  }, [setIsPlaying]);

  useEffect(() => {
    const node = audioRef.current;
    if (!node || !currentStation?.URL) return;
    if (errorTimeoutRef.current) {
      window.clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    setError("");
    node.pause();
    if (!sameAudioUrl(node.src, currentStation.URL)) {
      node.src = currentStation.URL;
    }
    try {
      node.load();
    } catch {
      // Browser stream loaders can throw for unsupported transports.
    }
  }, [currentStation?.id, currentStation?.URL]);

  useEffect(() => {
    const node = audioRef.current;
    if (!node) return;
    node.volume = clampVolume(volume);
    writeStoredVolume(volume);
  }, [volume]);

  useEffect(() => {
    const node = audioRef.current;
    if (!node) return;
    node.muted = muted;
  }, [muted]);

  useEffect(() => {
    const node = audioRef.current;
    if (!node) return;

    if (!isPlaying) {
      playAttemptRef.current += 1;
      node.pause();
      return;
    }

    if (!currentStation?.URL) {
      setIsPlaying(false);
      return;
    }

    const attemptId = playAttemptRef.current + 1;
    playAttemptRef.current = attemptId;
    const stationId = currentStation.id;
    if (!sameAudioUrl(node.src, currentStation.URL)) {
      node.src = currentStation.URL;
    }

    const playPromise = node.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((playError) => {
        if (
          attemptId !== playAttemptRef.current ||
          stationId !== currentStationRef.current?.id ||
          !isPlayingRef.current ||
          playError?.name === "AbortError"
        ) {
          return;
        }
        const blocked = playError?.name === "NotAllowedError";
        setError(blocked
          ? "El navegador bloqueo el autoplay. Pulsa reproducir para iniciar la radio."
          : "No se pudo reproducir esta estacion. Prueba con otra radio.");
        setIsPlaying(false);
      });
    }
  }, [currentStation?.id, currentStation?.URL, isPlaying, setIsPlaying]);

  const setStation = useCallback((stationOrId) => {
    const station = resolveStation(stations, stationOrId);
    if (!station) return;
    manualStationRef.current = true;
    setCurrentStation(station);
    setCategoryState(station.CATEGORIA || ALL_CATEGORIES);
    setError("");
  }, [setCurrentStation, stations]);

  const setVolume = useCallback((nextVolume) => {
    setVolumeState(clampVolume(nextVolume));
  }, []);

  const setCategory = useCallback((nextCategory) => {
    setCategoryState(nextCategory || ALL_CATEGORIES);
  }, []);

  const recommendedStation = useMemo(() => {
    if (!activeGameKey) return null;
    return stations.find((station) => station.DEFAULT === activeGameKey) || stations[0] || null;
  }, [activeGameKey, stations]);

  const isUsingRecommendedStation = Boolean(
    recommendedStation &&
    currentStation &&
    recommendedStation.id === currentStation.id
  );

  const playRecommendedStation = useCallback(() => {
    if (!recommendedStation) return;
    manualStationRef.current = true;
    playbackTouchedRef.current = true;
    setCurrentStation(recommendedStation);
    setCategoryState(recommendedStation.CATEGORIA || ALL_CATEGORIES);
    setError("");
    setIsPlaying(true);
  }, [recommendedStation, setCurrentStation, setIsPlaying]);

  const play = useCallback(() => {
    playbackTouchedRef.current = true;
    if (!currentStationRef.current && stations[0]) {
      setCurrentStation(stations[0]);
      setCategoryState(stations[0].CATEGORIA || ALL_CATEGORIES);
    }
    setIsPlaying(true);
  }, [setCurrentStation, setIsPlaying, stations]);

  const pause = useCallback(() => {
    playbackTouchedRef.current = true;
    setIsPlaying(false);
  }, [setIsPlaying]);

  const togglePlay = useCallback(() => {
    playbackTouchedRef.current = true;
    if (isPlayingRef.current) {
      setIsPlaying(false);
      return;
    }
    if (!currentStationRef.current && stations[0]) {
      setCurrentStation(stations[0]);
      setCategoryState(stations[0].CATEGORIA || ALL_CATEGORIES);
    }
    setIsPlaying(true);
  }, [setCurrentStation, setIsPlaying, stations]);

  const loadDefaultStation = useCallback((gameKey, options = {}) => {
    if (!stations.length) return;
    const { forcePlay = false, forceStation = false, resetPlaybackIntent = false } = options;

    if (resetPlaybackIntent) {
      playbackTouchedRef.current = false;
    }
    if (forceStation) {
      manualStationRef.current = false;
    }
    if (!forceStation && manualStationRef.current && currentStationRef.current) {
      if (forcePlay || !playbackTouchedRef.current) {
        setIsPlaying(true);
      }
      return;
    }

    const normalizedGameKey = String(gameKey || "").trim().toUpperCase();
    const target = stations.find((station) => station.DEFAULT === normalizedGameKey) || stations[0];
    if (!target) return;

    if (currentStationRef.current?.id !== target.id) {
      setCurrentStation(target);
      setCategoryState(target.CATEGORIA || ALL_CATEGORIES);
    }
    if (forcePlay || !playbackTouchedRef.current) {
      setIsPlaying(true);
    }
  }, [setCurrentStation, setIsPlaying, stations]);

  const value = useMemo(() => ({
    stations,
    categories,
    currentStation,
    activeGameKey,
    category,
    volume,
    isPlaying,
    muted,
    error,
    recommendedStation,
    isUsingRecommendedStation,
    play,
    pause,
    togglePlay,
    setStation,
    setVolume,
    setCategory,
    loadDefaultStation,
    setActiveGameKey,
    playRecommendedStation
  }), [
    stations,
    categories,
    currentStation,
    activeGameKey,
    category,
    volume,
    isPlaying,
    muted,
    error,
    recommendedStation,
    isUsingRecommendedStation,
    play,
    pause,
    togglePlay,
    setStation,
    setVolume,
    setCategory,
    loadDefaultStation,
    setActiveGameKey,
    playRecommendedStation
  ]);

  return <RadioContext.Provider value={value}>{children}</RadioContext.Provider>;
}

export function useRadio() {
  const context = useContext(RadioContext);
  if (!context) {
    throw new Error("useRadio must be used inside RadioProvider");
  }
  return context;
}

export { ALL_CATEGORIES, DEFAULT_VOLUME };
