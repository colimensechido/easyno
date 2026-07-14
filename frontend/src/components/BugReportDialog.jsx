import { Bug, Camera, CheckCircle2, ImageOff, Lightbulb, LoaderCircle, Send, X } from "lucide-react";
import html2canvas from "html2canvas";
import { useEffect, useState } from "react";
import { api } from "../api";

async function captureVisibleScreen() {
  const canvas = await html2canvas(document.body, {
    backgroundColor: "#07141d",
    logging: false,
    useCORS: true,
    scale: Math.min(window.devicePixelRatio || 1, 1.25),
    x: window.scrollX,
    y: window.scrollY,
    width: window.innerWidth,
    height: window.innerHeight,
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
    ignoreElements: (element) => element.hasAttribute?.("data-report-exclude")
  });
  return canvas.toDataURL("image/jpeg", 0.72);
}

export default function BugReportDialog({ open, onClose, token, context }) {
  const [reportType, setReportType] = useState("BUG");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function takeScreenshot() {
    setCapturing(true);
    setError("");
    try {
      setScreenshot(await captureVisibleScreen());
    } catch {
      setScreenshot("");
      setError("No pudimos tomar la captura en este dispositivo; puedes enviar el reporte sin ella.");
    } finally {
      setCapturing(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setSent(false);
    setError("");
    const timer = window.setTimeout(takeScreenshot, 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/reports", {
        method: "POST",
        token,
        body: { reportType, title, description, screenshot, context }
      });
      setSent(true);
      setTitle("");
      setDescription("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo enviar el reporte");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="report-dialog-overlay" data-report-exclude onMouseDown={() => !busy && onClose()}>
      <section className="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <span><Bug size={20} /> Ayúdanos a mejorar</span>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>

        {sent ? (
          <div className="report-success">
            <CheckCircle2 size={42} />
            <h2 id="report-dialog-title">Reporte enviado</h2>
            <p>Guardamos la captura y el contexto técnico para que administración pueda investigarlo.</p>
            <button type="button" onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="report-type-switch">
              <button type="button" className={reportType === "BUG" ? "is-active" : ""} onClick={() => setReportType("BUG")}><Bug size={16} /> Bug</button>
              <button type="button" className={reportType === "SUGGESTION" ? "is-active" : ""} onClick={() => setReportType("SUGGESTION")}><Lightbulb size={16} /> Sugerencia</button>
            </div>
            <label>
              <span>Título</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="¿Qué ocurrió?" required minLength={4} />
            </label>
            <label>
              <span>Cuéntanos qué estabas haciendo</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={3000} minLength={10} rows={5} placeholder="Pasos, resultado esperado y qué viste..." required />
            </label>
            <div className="report-screenshot-card">
              <div>
                {capturing ? <LoaderCircle className="spin" size={24} /> : screenshot ? <img src={screenshot} alt="Captura que se adjuntará" /> : <ImageOff size={26} />}
              </div>
              <span>
                <strong>{capturing ? "Tomando captura..." : screenshot ? "Captura lista" : "Sin captura"}</strong>
                <small>Incluye solo la vista visible; nunca contraseñas ni datos de pago.</small>
              </span>
              <button type="button" onClick={takeScreenshot} disabled={capturing}><Camera size={15} /> Repetir</button>
            </div>
            {error && <p className="report-error">{error}</p>}
            <footer>
              <small>También enviaremos la pantalla actual, sala, navegador y errores recientes de la sesión.</small>
              <button type="submit" disabled={busy || capturing}><Send size={16} /> {busy ? "Enviando..." : "Enviar reporte"}</button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
