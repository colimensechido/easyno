// ============================================================================
// AnimatedButton
// ----------------------------------------------------------------------------
// Boton con feedback visual (press), estado de carga y proteccion contra
// doble clic. Si recibe un onClick async, se deshabilita hasta resolverlo.
// Respeta la compuerta de animaciones global (useAnimationGate) salvo que se
// indique `ignoreGate`, asi los botones se bloquean mientras corre una
// animacion importante del juego.
//
// Estilos:
//  - por defecto usa las clases .game-btn / .game-btn-<variant> (libreria UI),
//  - o pasa `baseClassName` para reutilizar un estilo existente del proyecto
//    (p.ej. "arcade-button w-full") conservando solo el COMPORTAMIENTO.
//
// Uso:
//   <AnimatedButton variant="primary" onClick={async () => await jugar()}>
//     Tirar dados
//   </AnimatedButton>
//   <AnimatedButton baseClassName="arcade-button w-full" onClick={...}>...</AnimatedButton>
// ============================================================================

import { useState } from "react";
import { useAnimationGate } from "./AnimationGate.jsx";

const VARIANT_CLASS = {
  primary: "game-btn game-btn-primary",
  secondary: "game-btn game-btn-secondary",
  ghost: "game-btn game-btn-ghost",
  danger: "game-btn game-btn-danger"
};

export function AnimatedButton({
  children,
  onClick,
  variant = "primary",
  baseClassName = null,
  type = "button",
  disabled = false,
  loading = false,
  ignoreGate = false,
  showSpinner = true,
  className = "",
  ...rest
}) {
  const { isBusy } = useAnimationGate();
  const [pending, setPending] = useState(false);

  const isLoading = loading || pending;
  const blockedByGate = !ignoreGate && isBusy;
  const isDisabled = disabled || isLoading || blockedByGate;

  const handleClick = async (event) => {
    if (isDisabled) return;
    if (typeof onClick !== "function") return;
    const result = onClick(event);
    if (result && typeof result.then === "function") {
      try {
        setPending(true);
        await result;
      } finally {
        setPending(false);
      }
    }
  };

  // Si se provee baseClassName, se respeta el estilo existente del proyecto;
  // si no, se usan las clases de la libreria UI segun la variante.
  const base = baseClassName || VARIANT_CLASS[variant] || VARIANT_CLASS.primary;

  return (
    <button
      type={type}
      className={`${base} ${isLoading ? "is-loading" : ""} ${className}`.trim()}
      onClick={handleClick}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {isLoading && showSpinner ? <span className="game-btn-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export default AnimatedButton;
