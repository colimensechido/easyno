// ============================================================================
// GameModal
// ----------------------------------------------------------------------------
// Modal reutilizable para eventos importantes (compra, pago de renta, casillas
// especiales, pasar por GO, resultado de mano de Blackjack, etc.).
// Reutiliza .monopoly-modal-backdrop / .monopoly-modal y los tonos existentes.
//
// Caracteristicas:
//  - animacion de entrada (modal-in via CSS),
//  - cierre con ESC y clic en el backdrop (configurable),
//  - bloqueo de scroll del body mientras esta abierto,
//  - foco inicial automatico y restauracion del foco previo.
//
// Uso:
//   <GameModal open={open} tone="success" title="¡Compra!" onClose={...}
//     actions={<AnimatedButton onClick={...}>Aceptar</AnimatedButton>}>
//     Compraste Avenida Mediterraneo por $60.
//   </GameModal>
// ============================================================================

import { useCallback, useEffect, useRef } from "react";

export function GameModal({
  open,
  title,
  tone = "info",
  children,
  actions = null,
  onClose,
  closeOnBackdrop = true,
  closeOnEsc = true,
  dismissable = true
}) {
  const dialogRef = useRef(null);
  const lastFocused = useRef(null);

  const handleClose = useCallback(() => {
    if (dismissable && typeof onClose === "function") onClose();
  }, [dismissable, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    lastFocused.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape" && closeOnEsc) {
        event.stopPropagation();
        handleClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    // Foco inicial dentro del modal.
    const focusTarget = dialogRef.current?.querySelector(
      "[data-autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    focusTarget?.focus?.();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (lastFocused.current && typeof lastFocused.current.focus === "function") {
        lastFocused.current.focus();
      }
    };
  }, [open, closeOnEsc, handleClose]);

  if (!open) return null;

  return (
    <div
      className="monopoly-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && closeOnBackdrop) handleClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`monopoly-modal tone-${tone}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
      >
        {title ? (
          <header className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-xl font-black leading-tight">{title}</h2>
            {dismissable ? (
              <button type="button" className="toast-close" onClick={handleClose} aria-label="Cerrar">
                ×
              </button>
            ) : null}
          </header>
        ) : null}

        <div className="game-modal-body text-sm leading-relaxed">{children}</div>

        {actions ? <footer className="mt-6 flex flex-wrap justify-end gap-3">{actions}</footer> : null}
      </div>
    </div>
  );
}

export default GameModal;
