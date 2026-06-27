import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ListMusic,
  Minus,
  Music2,
  PauseCircle,
  PlayCircle,
  Radio,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ALL_CATEGORIES, useRadio } from "../radio/RadioContext";

const RADIO_MINIMIZED_KEY = "easyno-radio-minimized";
const RECOMMENDATION_HINT_MS = 15000;

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function readMinimizedPreference() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(RADIO_MINIMIZED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMinimizedPreference(value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RADIO_MINIMIZED_KEY, value ? "1" : "0");
  } catch {
    // noop
  }
}

export default function PlatformRadioPlayer({ compact = false }) {
  const {
    stations,
    categories,
    currentStation,
    activeGameKey,
    category,
    volume,
    isPlaying,
    muted,
    error,
    pause,
    togglePlay,
    setStation,
    setVolume,
    setCategory,
    recommendedStation,
    isUsingRecommendedStation,
    playRecommendedStation
  } = useRadio();
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(() => compact || readMinimizedPreference());
  const [showRecommendationHint, setShowRecommendationHint] = useState(false);

  useEffect(() => {
    writeMinimizedPreference(minimized);
  }, [minimized]);

  useEffect(() => {
    if (compact) {
      setExpanded(false);
      setMinimized(true);
    }
  }, [compact]);

  const filteredStations = useMemo(() => {
    if (!category || category === ALL_CATEGORIES) return stations;
    return stations.filter((station) => station.CATEGORIA === category);
  }, [category, stations]);

  const volumeIcon = muted || volume <= 0 ? <VolumeX size={14} /> : <Volume2 size={14} />;
  const stationName = currentStation?.NOMBRE || "Selecciona una estacion";
  const stationCategory = currentStation?.CATEGORIA || "Radio";
  const showRecommendation = Boolean(activeGameKey && recommendedStation && currentStation && !isUsingRecommendedStation);

  useEffect(() => {
    if (!showRecommendation) {
      setShowRecommendationHint(false);
      return undefined;
    }

    setShowRecommendationHint(true);
    const timeoutId = window.setTimeout(() => {
      setShowRecommendationHint(false);
    }, RECOMMENDATION_HINT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [
    showRecommendation,
    activeGameKey,
    currentStation?.id,
    recommendedStation?.id
  ]);

  if (!stations.length || (!currentStation && !error)) return null;

  function moveStation(direction) {
    const list = filteredStations.length ? filteredStations : stations;
    const currentIndex = Math.max(0, list.findIndex((station) => station.id === currentStation?.id));
    const nextIndex = (currentIndex + direction + list.length) % list.length;
    setStation(list[nextIndex]);
  }

  function handleMinimize() {
    setExpanded(false);
    setMinimized(true);
  }

  function handleRestore() {
    setMinimized(false);
  }

  if (minimized) {
    return (
      <section className={cx("platform-radio", "is-minimized", isPlaying && "is-playing")} aria-label="Radio de la plataforma">
        {showRecommendation && showRecommendationHint && (
          <button type="button" className="platform-radio-recommendation" onClick={playRecommendedStation}>
            <span>Estas escuchando otra radio.</span>
            <strong>Escuchar la recomendada para este minijuego</strong>
          </button>
        )}

        <div className="platform-radio-mini">
          <button
            type="button"
            className="platform-radio-play"
            onClick={togglePlay}
            title={isPlaying ? "Pausar radio" : "Reproducir radio"}
          >
            {isPlaying ? <PauseCircle size={21} /> : <PlayCircle size={21} />}
          </button>

          <button
            type="button"
            className="platform-radio-mini-toggle"
            onClick={handleRestore}
            title="Mostrar radio"
          >
            <ChevronRight size={14} />
          </button>

          <div className="platform-radio-mini-peek">
            <button
              type="button"
              className="platform-radio-mini-now"
              onClick={handleRestore}
              title={stationName}
            >
              <span>{stationCategory}</span>
              <strong>{stationName}</strong>
            </button>
            {showRecommendation && (
              <button type="button" className="platform-radio-mini-reco" onClick={playRecommendedStation}>
                Radio recomendada
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={cx("platform-radio", isPlaying && "is-playing", expanded && "is-expanded")} aria-label="Radio de la plataforma">
      {showRecommendation && showRecommendationHint && !expanded && (
        <button type="button" className="platform-radio-recommendation" onClick={playRecommendedStation}>
          <span>Actualmente estas escuchando otra radio.</span>
          <strong>Escuchar la radio recomendada para este minijuego</strong>
        </button>
      )}

      <div className="platform-radio-shell">
        <button
          type="button"
          className="platform-radio-play"
          onClick={togglePlay}
          title={isPlaying ? "Pausar radio" : "Reproducir radio"}
        >
          {isPlaying ? <PauseCircle size={21} /> : <PlayCircle size={21} />}
        </button>
        <button
          type="button"
          className="platform-radio-now"
          onClick={() => setExpanded((current) => !current)}
          title={stationName}
        >
          <Radio size={15} />
          <span>
            <em>{stationCategory}</em>
            <strong>{stationName}</strong>
          </span>
          {expanded ? <ChevronDown size={15} /> : <Music2 size={15} />}
        </button>
        <button
          type="button"
          className="platform-radio-collapse"
          onClick={handleMinimize}
          title="Minimizar radio"
        >
          <Minus size={14} />
        </button>
      </div>

      <div className="platform-radio-panel">
        <div className="platform-radio-panel-head">
          <div>
            <span>Radio</span>
            <strong>{stationName}</strong>
          </div>
          <div className="platform-radio-panel-head-actions">
            <button type="button" onClick={() => setExpanded(false)} title="Cerrar controles">
              <X size={15} />
            </button>
          </div>
        </div>

        {showRecommendation && showRecommendationHint && (
          <button type="button" className="platform-radio-recommendation inline" onClick={playRecommendedStation}>
            <span>Actualmente estas escuchando otra radio.</span>
            <strong>Escuchar la radio recomendada para este minijuego</strong>
          </button>
        )}

        <div className="platform-radio-actions">
          <button type="button" onClick={() => moveStation(-1)} title="Estacion anterior">
            <SkipBack size={16} />
          </button>
          <button type="button" className="primary" onClick={togglePlay} title={isPlaying ? "Pausar radio" : "Reproducir radio"}>
            {isPlaying ? <PauseCircle size={18} /> : <PlayCircle size={18} />}
          </button>
          <button type="button" onClick={() => moveStation(1)} title="Siguiente estacion">
            <SkipForward size={16} />
          </button>
          <button type="button" onClick={pause} title="Pausar radio">
            <VolumeX size={16} />
          </button>
        </div>

        <label className="platform-radio-field" title="Filtrar por categoria">
          <span><ListMusic size={14} /> Categoria</span>
          <select value={category || ALL_CATEGORIES} onChange={(event) => setCategory(event.target.value)}>
            <option value={ALL_CATEGORIES}>Todas</option>
            {categories.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="platform-radio-field" title="Cambiar estacion">
          <span><Radio size={14} /> Estacion</span>
          <select value={currentStation?.id || ""} onChange={(event) => setStation(event.target.value)}>
            <option value="" disabled>Elige estacion</option>
            {filteredStations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.NOMBRE}
              </option>
            ))}
          </select>
        </label>

        <label className="platform-radio-volume" title={muted ? "Audio silenciado" : "Volumen de radio"}>
          <span>{volumeIcon} Volumen</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Volumen de radio"
          />
          <strong>{Math.round(volume * 100)}%</strong>
        </label>

        {error && (
          <p className="platform-radio-error">
            <AlertTriangle size={14} />
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
