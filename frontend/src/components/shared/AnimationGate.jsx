// ============================================================================
// AnimationGate
// ----------------------------------------------------------------------------
// Coordina el "ritmo visual" de los juegos: mientras una animacion importante
// esta corriendo (reparto de cartas, tirada de dados, movimiento de fichas,
// transicion de turno) se BLOQUEAN los clics para que el jugador no rompa la
// secuencia ni dispare acciones a destiempo.
//
// Uso:
//   <AnimationGateProvider>
//     ...tu juego...
//   </AnimationGateProvider>
//
//   const { isBusy, runGated, gate } = useAnimationGate();
//   await runGated(async () => { ...animacion/await... }, 600);
//
// `isBusy` permite deshabilitar botones; <AnimatedButton> lo respeta solo.
// ============================================================================

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const AnimationGateContext = createContext(null);

export function AnimationGateProvider({ children, overlay = true }) {
  const [busyCount, setBusyCount] = useState(0);
  const timeouts = useRef(new Set());

  const gate = useCallback(() => {
    setBusyCount((count) => count + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setBusyCount((count) => Math.max(0, count - 1));
    };
  }, []);

  // Ejecuta una funcion (sincrona o async) manteniendo la compuerta cerrada.
  // `minDuration` garantiza un tiempo minimo de bloqueo aunque la funcion
  // termine antes, para que la animacion alcance a verse.
  const runGated = useCallback(
    async (fn, minDuration = 0) => {
      const release = gate();
      const start = Date.now();
      try {
        return await fn();
      } finally {
        const remaining = minDuration - (Date.now() - start);
        if (remaining > 0) {
          await new Promise((resolve) => {
            const id = setTimeout(() => {
              timeouts.current.delete(id);
              resolve();
            }, remaining);
            timeouts.current.add(id);
          });
        }
        release();
      }
    },
    [gate]
  );

  const value = useMemo(
    () => ({ isBusy: busyCount > 0, busyCount, gate, runGated }),
    [busyCount, gate, runGated]
  );

  return (
    <AnimationGateContext.Provider value={value}>
      {children}
      {overlay && busyCount > 0 ? <div className="animation-gate-veil" aria-hidden="true" /> : null}
    </AnimationGateContext.Provider>
  );
}

export function useAnimationGate() {
  const ctx = useContext(AnimationGateContext);
  if (!ctx) {
    // Fallback inerte: permite usar los componentes fuera del provider sin romper.
    return {
      isBusy: false,
      busyCount: 0,
      gate: () => () => {},
      runGated: async (fn) => fn()
    };
  }
  return ctx;
}

export default AnimationGateProvider;
