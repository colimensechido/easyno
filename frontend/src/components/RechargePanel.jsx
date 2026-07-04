import {
  AlertTriangle,
  Check,
  Crown,
  ExternalLink,
  Gem,
  Globe2,
  Loader2,
  PartyPopper,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { audio } from "../audio";
import BrandLogo from "./shared/BrandLogo";

const POLL_INTERVAL_MS = 4000;
const POLL_MAX_ATTEMPTS = 45; // ~3 minutos escuchando
const PENDING_STATUSES = new Set(["created", "waiting_payment", "pending"]);

function formatEycon(units = 0) {
  return `${(Number(units || 0) / 100).toFixed(2)} EyCon`;
}

function formatUsd(value = 0) {
  return `$${Number(value || 0).toFixed(2)} USD`;
}

const STATUS_LABELS = {
  created: "Creado",
  waiting_payment: "Esperando pago",
  pending: "En proceso",
  approved: "Aprobado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  processing_error: "Error"
};

const THANK_YOU_COPY = {
  starter: {
    title: "¡Gracias por tu granito de arena!",
    subtitle: "Cada aporte, por chiquito que sea, ayuda a que este proyecto siga vivo.",
    emoji: "🙌"
  },
  advanced: {
    title: "¡Wow, vaya apoyazo!",
    subtitle: "Con esto te llevas casi todo el catálogo. ¡A disfrutarlo!",
    emoji: "🎉"
  },
  vip: {
    title: "¡BIENVENIDO AL CLUB VIP!",
    subtitle: "Desbloqueaste el 100% del catálogo y tu nombre brillará dorado para siempre. Gracias de verdad.",
    emoji: "👑"
  }
};

function tierFor(pkg, grantsVip) {
  if (grantsVip || pkg?.vip) return "vip";
  if (pkg?.id === "pack_advanced") return "advanced";
  return "starter";
}

function ThankYouModal({ celebration, onClose }) {
  if (!celebration) return null;
  const { intent, pkg } = celebration;
  const tier = tierFor(pkg, intent.grantsVip);
  const copy = THANK_YOU_COPY[tier];

  return (
    <div className="thankyou-backdrop" role="dialog" aria-modal="true" aria-labelledby="thankyou-title">
      <div className={`thankyou-modal thankyou-modal--${tier}`}>
        {tier === "vip" && (
          <div className="thankyou-coin-rain" aria-hidden="true">
            {Array.from({ length: 16 }).map((_, index) => (
              <span
                key={index}
                className="thankyou-coin"
                style={{
                  left: `${(index * 6.3) % 100}%`,
                  animationDelay: `${(index % 6) * 0.28}s`,
                  animationDuration: `${2 + (index % 4) * 0.4}s`
                }}
              >
                🪙
              </span>
            ))}
          </div>
        )}

        <button type="button" className="thankyou-close-x" onClick={onClose} aria-label="Cerrar">
          <X size={16} />
        </button>

        <div className="thankyou-emoji">{copy.emoji}</div>
        <h2 id="thankyou-title">{copy.title}</h2>
        <p className="thankyou-subtitle">{copy.subtitle}</p>

        <div className="thankyou-amount">
          <Gem size={20} />
          +{formatEycon(intent.amountUnits)}
        </div>

        {tier === "vip" && (
          <div className="thankyou-vip-perks">
            <span><Crown size={14} /> Rol VIP permanente</span>
            <span><Sparkles size={14} /> Nombre dorado en las tablas</span>
          </div>
        )}

        <button type="button" className="thankyou-close" onClick={onClose}>
          <PartyPopper size={16} />
          ¡Genial, a jugar!
        </button>
      </div>
    </div>
  );
}

export default function RechargePanel({ token, onProfileChange, onUserRefresh }) {
  const [packages, setPackages] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [checkingId, setCheckingId] = useState("");
  const [activeIntentId, setActiveIntentId] = useState(null);
  const [polling, setPolling] = useState(false);
  const [celebration, setCelebration] = useState(null);

  const pollTimerRef = useRef(null);
  const tickRef = useRef(null);
  const packagesRef = useRef([]);
  const resumedRef = useRef(false);

  packagesRef.current = packages;

  async function loadAll() {
    setLoading(true);
    try {
      const [packagesData, historyData] = await Promise.all([
        api("/api/payments/packages"),
        api("/api/payments/history", { token })
      ]);
      setPackages(packagesData.packages || []);
      setHistory(historyData.payments || []);
      setError("");
      return historyData.payments || [];
    } catch (err) {
      setError(err.message || "No se pudo cargar la tienda de recargas");
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // La pestaña de Mercado Pago avisa a esta ventana cuando termina el checkout.
  useEffect(() => {
    async function onPaymentReturnMessage(event) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "easyno-payment-return") return;

      const paymentId = event.data.paymentId || null;
      const externalReference = event.data.externalReference || null;

      try {
        const result = await api("/api/payments/return-sync", {
          method: "POST",
          token,
          body: {
            paymentIntentId: activeIntentId || undefined,
            paymentId: paymentId || undefined,
            externalReference: externalReference || undefined
          }
        });
        if (result.paymentIntent?.status === "approved") {
          handleApproved(result.paymentIntent);
        } else {
          await loadAll();
        }
      } catch {
        // el polling normal sigue intentando
      }
    }

    window.addEventListener("message", onPaymentReturnMessage);
    return () => window.removeEventListener("message", onPaymentReturnMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeIntentId]);

  // Al entrar (o recargar la página) retoma automáticamente la escucha de
  // cualquier compra que haya quedado pendiente, sin que el usuario tenga que hacer nada.
  useEffect(() => {
    if (resumedRef.current || activeIntentId) return;
    const pending = history
      .filter((item) => PENDING_STATUSES.has(item.status))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
    if (pending) {
      resumedRef.current = true;
      setActiveIntentId(pending.id);
    }
  }, [history, activeIntentId]);

  async function refreshProfileAndRoles() {
    try {
      const profile = await api("/api/eycon/profile", { token });
      onProfileChange?.(profile);
    } catch {
      // el balance tambien se sincroniza por socket
    }
    try {
      await onUserRefresh?.();
    } catch {
      // silencioso
    }
  }

  function handleApproved(intent) {
    setPolling(false);
    setActiveIntentId(null);
    setNotice("");
    const pkg = packagesRef.current.find((item) => item.id === intent.packageId) || null;
    setCelebration({ intent, pkg });
    audio.play("win");
    refreshProfileAndRoles();
    loadAll();
  }

  // El "lector": mientras haya una compra pendiente, consulta el estado del pago
  // en segundo plano cada pocos segundos y revisa de inmediato al volver a la pestaña,
  // para no obligar al usuario a estar pulsando un botón.
  useEffect(() => {
    if (!activeIntentId) {
      setPolling(false);
      return undefined;
    }

    let attempts = 0;
    let cancelled = false;
    setPolling(true);

    async function tick() {
      if (cancelled) return;
      attempts += 1;
      try {
        const result = await api("/api/payments/return-sync", {
          method: "POST",
          token,
          body: { paymentIntentId: activeIntentId }
        });
        if (cancelled) return;
        const status = result.paymentIntent?.status;
        if (status === "approved") {
          handleApproved(result.paymentIntent);
          return;
        }
        if (status === "cancelled" || status === "rejected" || status === "refunded") {
          setPolling(false);
          setActiveIntentId(null);
          if (status === "cancelled") {
            setNotice("Esta compra fue cancelada porque iniciaste otra mas reciente.");
          } else {
            setNotice(status === "rejected" ? "El pago fue rechazado por Mercado Pago." : "El pago fue reembolsado.");
          }
          loadAll();
          return;
        }
      } catch {
        // silencioso: reintenta en el siguiente ciclo
      }

      if (attempts >= POLL_MAX_ATTEMPTS) {
        setPolling(false);
        setNotice("No detectamos el pago automáticamente todavía. Si ya pagaste, presiona \"Verificar ahora\" abajo.");
        return;
      }

      pollTimerRef.current = window.setTimeout(tick, POLL_INTERVAL_MS);
    }

    tickRef.current = () => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
      tick();
    };

    tick();

    function handleVisibility() {
      if (document.visibilityState === "visible") tickRef.current?.();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      cancelled = true;
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIntentId, token]);

  async function buyPackage(pkg) {
    setBusyId(pkg.id);
    setError("");
    setNotice("");
    try {
      const result = await api("/api/payments/checkout", {
        method: "POST",
        token,
        body: { packageId: pkg.id }
      });

      if (result.configurationMissing) {
        setError("Mercado Pago no esta configurado en el servidor todavia.");
        setActiveIntentId(null);
        await loadAll();
        return;
      }

      const checkoutUrl = result.paymentIntent?.initPoint || result.paymentIntent?.sandboxInitPoint;
      if (checkoutUrl) {
        window.open(checkoutUrl, "_blank", "noopener,noreferrer");
        const cancelledNote = Number(result.cancelledPrevious || 0) > 0
          ? ` Cerramos ${result.cancelledPrevious} compra(s) anterior(es) que seguian abiertas.`
          : "";
        setNotice(`Abrimos Mercado Pago en una pestaña nueva. Quédate tranquilo: en cuanto confirmes el pago lo detectamos solos y te avisamos aquí.${cancelledNote}`);
        resumedRef.current = true;
        setActiveIntentId(result.paymentIntent.id);
      } else {
        setActiveIntentId(null);
      }

      await loadAll();
    } catch (err) {
      setError(err.message || "No se pudo iniciar la compra");
    } finally {
      setBusyId("");
    }
  }

  async function checkPayment(intent) {
    setCheckingId(intent.id);
    setError("");
    setNotice("");
    try {
      const result = await api("/api/payments/return-sync", {
        method: "POST",
        token,
        body: { paymentIntentId: intent.id }
      });

      if (result.paymentIntent?.status === "approved") {
        handleApproved(result.paymentIntent);
      } else {
        setNotice("Todavia no detectamos el pago aprobado. Si ya pagaste, espera un momento y vuelve a intentar.");
      }
      await loadAll();
    } catch (err) {
      setError(err.message || "No se pudo verificar el pago");
    } finally {
      setCheckingId("");
    }
  }

  if (loading && packages.length === 0) {
    return (
      <section className="recharge-panel">
        <div className="recharge-loading">
          <Loader2 size={28} className="animate-spin" />
          <p>Cargando paquetes...</p>
        </div>
      </section>
    );
  }

  const pendingHistory = history
    .filter((item) => PENDING_STATUSES.has(item.status))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  return (
    <section className="recharge-panel">
      <ThankYouModal celebration={celebration} onClose={() => setCelebration(null)} />

      <header className="recharge-header">
        <div className="recharge-header-copy">
          <BrandLogo size="lg" className="recharge-logo" alt="EasyNo" />
          <div>
            <p className="recharge-eyebrow"><WalletCards size={15} /> Recarga con dinero real</p>
            <h2>Compra EyCon con Mercado Pago</h2>
            <p className="recharge-subtitle">
              <Globe2 size={13} />Recuerda que la compra de estos EyCon es una forma de donar al proyecto. Puedes obtener EyCon TOTALMENTE GRATIS cumpliendo tus misiones diarias. Solo mayores de 18 anos pueden recargar.
            </p>
          </div>
        </div>
        <div className="recharge-no-refund-notice">
          <AlertTriangle size={15} />
          <span>Todas las compras son <strong>finales</strong>: no existen devoluciones ni reembolsos una vez aprobado el pago.</span>
        </div>
      </header>

      {polling && (
        <div className="recharge-listening">
          <span className="recharge-listening-icon"><Radio size={15} /></span>
          <span>Escuchando tu pago en Mercado Pago... no necesitas hacer nada, te avisamos en cuanto se confirme.</span>
        </div>
      )}

      <div className="recharge-grid">
        {packages.map((pkg) => (
          <article key={pkg.id} className={`recharge-card ${pkg.vip ? "is-vip" : ""}`}>
            {pkg.vip && (
              <span className="recharge-card-badge">
                <Crown size={13} /> Incluye VIP
              </span>
            )}
            <h3>{pkg.name}</h3>
            <p className="recharge-card-description">{pkg.description}</p>
            <div className="recharge-card-amount">
              <Gem size={18} />
              {formatEycon(pkg.amountUnits)}
            </div>
            {pkg.vip && (
              <ul className="recharge-card-perks">
                <li><Check size={13} /> ¡Te alcanza para todo! ¡Eres rico!</li>
                <li><ShieldCheck size={13} /> Rol VIP permanente</li>
                <li><Sparkles size={13} /> Nombre dorado en las tablas de jugadores</li>
              </ul>
            )}
            <button
              type="button"
              className="recharge-card-buy"
              disabled={busyId === pkg.id}
              onClick={() => buyPackage(pkg)}
            >
              {busyId === pkg.id ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
              {formatUsd(pkg.priceUsd)} · Comprar
            </button>
          </article>
        ))}
      </div>

      {pendingHistory.length > 0 && (
        <div className="recharge-pending">
          <h3>Compras en proceso</h3>
          <div className="recharge-pending-list">
            {pendingHistory.map((intent) => (
              <div key={intent.id} className="recharge-pending-item">
                <div>
                  <strong>{formatUsd(intent.amountUsd)} · {formatEycon(intent.amountUnits)}</strong>
                  <span className={`recharge-pending-status status-${intent.status}`}>
                    {activeIntentId === intent.id && polling ? "Escuchando..." : STATUS_LABELS[intent.status] || intent.status}
                  </span>
                </div>
                <button
                  type="button"
                  className="recharge-pending-check"
                  disabled={checkingId === intent.id}
                  onClick={() => checkPayment(intent)}
                >
                  {checkingId === intent.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Verificar ahora
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {notice && <div className="recharge-notice">{notice}</div>}
      {error && <div className="recharge-error">{error}</div>}
    </section>
  );
}
