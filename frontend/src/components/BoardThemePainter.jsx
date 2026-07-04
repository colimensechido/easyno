import { Eraser, PaintBucket, Pencil, Redo2, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const CANVAS_SIZE = 480;
const DEFAULT_FILL = "#2d2418";

const swatches = [
  "#2d2418", "#1f6f59", "#0f172a", "#f4d45d",
  "#ef4444", "#22d3ee", "#a855f7", "#78350f",
  "#065f46", "#f8f1dc", "#111827", "#ffffff"
];

function hexToRgb(hex) {
  const clean = String(hex || "").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean;
  const value = parseInt(full || "000000", 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function colorsMatch(a, b, tolerance = 12) {
  return (
    Math.abs(a[0] - b[0]) <= tolerance &&
    Math.abs(a[1] - b[1]) <= tolerance &&
    Math.abs(a[2] - b[2]) <= tolerance &&
    Math.abs(a[3] - b[3]) <= tolerance
  );
}

/**
 * Freeform "paint" editor for a board theme. Whatever gets drawn here is
 * exported as a flat PNG and used verbatim as the real board texture, so the
 * preview and the actual match always show the same artwork.
 */
export default function BoardThemePainter({ value, onChange, disabled = false }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const historyRef = useRef([]);
  const redoRef = useRef([]);
  const loadedValueRef = useRef("");
  const [brushColor, setBrushColor] = useState("#f4d45d");
  const [brushSize, setBrushSize] = useState(16);
  const [tool, setTool] = useState("brush");
  const [historyTick, setHistoryTick] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext("2d");
    contextRef.current = ctx;
    if (value) {
      const image = new Image();
      image.onload = () => {
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        loadedValueRef.current = value;
      };
      image.src = value;
      loadedValueRef.current = value;
    } else {
      ctx.fillStyle = DEFAULT_FILL;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
    // Only re-hydrate the canvas when a *different* saved value arrives
    // (e.g. switching between presets); local strokes must not be wiped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    if (!value || value === loadedValueRef.current) return;
    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      loadedValueRef.current = value;
    };
    image.src = value;
  }, [value]);

  function commit() {
    const canvas = canvasRef.current;
    if (!canvas || !onChange) return;
    const dataUrl = canvas.toDataURL("image/png");
    loadedValueRef.current = dataUrl;
    onChange(dataUrl);
  }

  function pushHistory() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    historyRef.current.push(canvas.toDataURL("image/png"));
    if (historyRef.current.length > 20) historyRef.current.shift();
    redoRef.current = [];
    setHistoryTick((tick) => tick + 1);
  }

  function pointFromEvent(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function drawSegment(from, to) {
    const ctx = contextRef.current;
    if (!ctx) return;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = tool === "eraser" ? Math.max(brushSize, 22) : brushSize;
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : brushColor;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  function floodFill(x, y, fillColor) {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    const { width, height } = canvas;
    const startX = Math.max(0, Math.min(width - 1, Math.floor(x)));
    const startY = Math.max(0, Math.min(height - 1, Math.floor(y)));
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const startIndex = (startY * width + startX) * 4;
    const startColor = [data[startIndex], data[startIndex + 1], data[startIndex + 2], data[startIndex + 3]];
    const [r, g, b] = hexToRgb(fillColor);
    const target = [r, g, b, 255];
    if (colorsMatch(startColor, target, 4)) return;
    const stack = [[startX, startY]];
    const visited = new Uint8Array(width * height);
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
      const pixelIdx = cy * width + cx;
      if (visited[pixelIdx]) continue;
      const dataIdx = pixelIdx * 4;
      if (!colorsMatch([data[dataIdx], data[dataIdx + 1], data[dataIdx + 2], data[dataIdx + 3]], startColor)) continue;
      visited[pixelIdx] = 1;
      data[dataIdx] = target[0];
      data[dataIdx + 1] = target[1];
      data[dataIdx + 2] = target[2];
      data[dataIdx + 3] = 255;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function handlePointerDown(event) {
    if (disabled) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    if (tool === "bucket") {
      pushHistory();
      floodFill(point.x, point.y, brushColor);
      commit();
      return;
    }
    pushHistory();
    drawingRef.current = true;
    lastPointRef.current = point;
    drawSegment(point, point);
  }

  function handlePointerMove(event) {
    if (!drawingRef.current || disabled) return;
    const point = pointFromEvent(event);
    drawSegment(lastPointRef.current, point);
    lastPointRef.current = point;
  }

  function finishStroke() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    commit();
  }

  function undo() {
    if (!historyRef.current.length) return;
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    redoRef.current.push(canvas.toDataURL("image/png"));
    const previous = historyRef.current.pop();
    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      commit();
    };
    image.src = previous;
    setHistoryTick((tick) => tick + 1);
  }

  function clearCanvas() {
    pushHistory();
    const ctx = contextRef.current;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    commit();
  }

  function handleImportImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        pushHistory();
        const ctx = contextRef.current;
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        commit();
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="board-painter">
      <div className="board-painter-toolbar">
        <div className="board-painter-tools">
          <button type="button" className={tool === "brush" ? "is-active" : ""} onClick={() => setTool("brush")} disabled={disabled} title="Pincel">
            <Pencil size={15} />
          </button>
          <button type="button" className={tool === "eraser" ? "is-active" : ""} onClick={() => setTool("eraser")} disabled={disabled} title="Borrador">
            <Eraser size={15} />
          </button>
          <button type="button" className={tool === "bucket" ? "is-active" : ""} onClick={() => setTool("bucket")} disabled={disabled} title="Rellenar area">
            <PaintBucket size={15} />
          </button>
        </div>
        <input
          type="color"
          className="board-painter-color"
          value={brushColor}
          onChange={(event) => setBrushColor(event.target.value)}
          disabled={disabled}
          title="Color del pincel"
        />
        <div className="board-painter-swatches">
          {swatches.map((swatch) => (
            <button
              key={swatch}
              type="button"
              style={{ "--swatch": swatch }}
              className={brushColor.toLowerCase() === swatch ? "is-active" : ""}
              onClick={() => setBrushColor(swatch)}
              disabled={disabled}
              aria-label={`Usar color ${swatch}`}
            />
          ))}
        </div>
        <label className="board-painter-size">
          <span>Grosor {brushSize}px</span>
          <input
            type="range"
            min="2"
            max="60"
            step="1"
            value={brushSize}
            onChange={(event) => setBrushSize(Number(event.target.value))}
            disabled={disabled}
          />
        </label>
        <div className="board-painter-actions">
          <button type="button" onClick={undo} disabled={disabled || historyRef.current.length === 0} title="Deshacer">
            <Redo2 size={14} style={{ transform: "scaleX(-1)" }} />
          </button>
          <button type="button" onClick={clearCanvas} disabled={disabled} title="Limpiar todo">
            <Trash2 size={14} /> Limpiar
          </button>
          <label className="board-painter-upload" title="Importar imagen como base">
            <Upload size={14} /> Importar
            <input type="file" accept="image/*" onChange={handleImportImage} disabled={disabled} hidden />
          </label>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="board-painter-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerLeave={finishStroke}
      />
      <p className="board-painter-hint">
        Dibuja libremente sobre el cuadro: este diseño se usa tal cual como textura del tablero (fondo + centro) dentro de la partida real, sin elementos extra.
      </p>
    </div>
  );
}
