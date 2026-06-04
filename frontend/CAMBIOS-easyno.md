# Mejoras de frontend · easyno

## Iteración 2 — Limpieza visual + mesa cinematográfica

Foco: quitar la sensación de "gamer dashboard" (demasiados paneles, bordes y
glows compitiendo) y convertir Blackjack en un escenario de juego con jerarquía
clara. **Lógica de juego intacta.**

**Menos ruido visual (sistema):**
- `casino-panel` y `arcade-panel`: sin glow dorado, borde neutro `white/8`,
  sombra suave, bordes más redondeados.
- `felt-table`: se quitó el doble marco dorado y el arco punteado fuerte; ahora
  es fieltro cinematográfico con una sola línea tenue y viñeta suave.
- Botones (`arcade`/`danger`): sombra base discreta; el glow solo aparece, leve,
  en hover.
- `hud-pill`, `nav-tab` activo y `marquee-lights`: glows reducidos. El dorado se
  reserva como acento.

**Blackjack como escenario (no como columnas de panel):**
- Se eliminó el layout de 3 columnas (mesa + panel de control + sidebar). Ahora
  es un único escenario a todo lo ancho:
  - **Dealer** arriba/centro con total destacado.
  - Indicador de estado central único y sutil (turno/timer/fase).
  - **Jugador (tú)** abajo/centro, con tus cartas como protagonistas.
  - **Rivales** reducidos a fichas discretas en la esquina superior.
- **Barra de acciones inferior** compacta: saldo · (fichas+Apostar / Pedir+
  Plantarse) · apuesta · pozo. Las acciones quedan cerca del jugador.
- Apuesta convertida en **fichas de casino** (se quitó el input numérico).
- Estados claros con badges/acentos: turno activo (anillo dorado), total live,
  *bust* (rojo), BLACKJACK, dealer revelando, saldo con animación al cambiar.
- Cartas con reparto escalonado y mejor espaciado/superposición.

**Panel derecho menos invasivo:**
- El panel de Jugadores/Chat ahora es **colapsable**; se oculta por defecto en
  Blackjack para dar toda la pantalla a la mesa, con un botón flotante para
  reabrirlo. La mesa pasa a ancho completo cuando está oculto.

**Limpieza de código:**
- Eliminados componentes muertos: `PhaseBanner`, `CommandCenter`, `DealerHand`,
  `PlayerSeat` (reemplazados por el escenario + `StageHand`).
- Quitados imports/vars sin uso (`CircleDollarSign`, `myInstruction`).

---

## Iteración 1 — Base

Resumen de la primera entrega: rebrand a **easyno**, sistema de diseño premium y
rediseño del módulo de Blackjack para que se sienta como un videojuego web, no
como una página administrativa. **No se tocó la lógica de juego** (sockets,
estados, acks): todos los cambios son visuales o de estructura/JSX.

## 1. Rebrand a easyno
- `index.html`: título → `easyno · Casino`.
- `public/favicon.svg`: nuevo monograma "e" sobre fieltro con borde dorado y ♠.
- `App.jsx`: marca del navbar → wordmark `easyno`; clave de sesión en
  localStorage `economy-arcade-session` → `easyno-session`.
- `audio.js`: clave de mute `economy-arcade-muted` → `easyno-muted`.
- `AuthPanel.jsx`: hero → `easyno` + subtítulo "Casino & Arcade".
- `BlackjackTable.jsx`: "Casino Arcade" → `easyno`.
- `README.md` actualizado.

> Nota: cambiar las claves de localStorage cierra la sesión guardada una sola
> vez (no afecta cuentas ni datos del backend).

## 2. Sistema de diseño (index.css + tailwind.config.js)
- **Nuevas animaciones** (tailwind): `deal-in` (reparto de carta desde el
  mazo), `card-flip`, `turn-pulse` (anillo de turno), `count-pop` (saldo/apuesta
  al cambiar), `float-soft`, `pulse-ring`, `fade-in`, `pop-in`.
- **Botones**: estados `:active` (press) y `:focus-visible` (accesible) en
  `arcade-button`, `danger-button`, `ghost-button`.
- **Cartas** (`.playing-card`): brillo que cruza al repartirse y sombra mejor.
- **Fichas** (`.chip`): press 3D y estado `.is-selected` (halo dorado) para la
  ficha activa.
- **Mesa de fieltro real**: `.felt-table` (doble borde dorado, viñeta, arco de
  apuesta) y `.bet-spot`. `.felt-panel` con más profundidad.
- **Utilidades nuevas**: `.brand-mark`, `.brand-word`, `.hud-pill`
  (gold/emerald/muted), `.nav-tab` (pestañas con subrayado activo),
  `.stat-tile`, `.action-key` (botones grandes Pedir/Plantarse), `.turn-ring`,
  `.divider-fade`, `.tabnum` (números tabulares), `.scrollbar-slim`.
- Respeto a `prefers-reduced-motion`.

## 3. Shell global
- **Navbar** (`App.jsx`): marca + control segmentado central (Trabajo /
  Blackjack / Monopoly) con pestaña activa, píldoras de HUD para saldo (con
  `count-pop` al cambiar) y estado de conexión, acciones colapsables en móvil.
- **AuthPanel**: hero rebrandeado, jerarquía tipográfica más fuerte.
- **WorldSidebar**: scrollbars finos temáticos y montos con números tabulares.

## 4. Módulo Blackjack (foco principal)
- **Mesa de juego** vs IA reconstruida sobre `.felt-table`: dealer arriba al
  centro con identidad y total destacado, separador "Asientos" y rejilla de
  jugadores (hasta 3 columnas en desktop, mejor uso del espacio).
- **Cartas** con reparto escalonado (`deal-in` + retardo por índice) tanto en el
  dealer como en los abanicos de los jugadores.
- **Acciones siempre visibles**: se eliminó el toggle "Mostrar/Ocultar
  controles" (fricción) y se reemplazó por botones grandes `Pedir` / `Plantarse`
  (`.action-key`), deshabilitados cuando no es tu turno, en mesa IA y PvP.
- **Indicador de turno**: anillo dorado pulsante (`turn-ring`) en el asiento
  activo (IA y PvP).
- **HUD compacto** (`CommandCenter`) con `stat-tile` en lugar de cajas grandes,
  menos texto.
- **Fichas de apuesta** con estado seleccionado según el valor actual.
- **Saldo** con animación `count-pop` al actualizarse.
- Se conservan modales de resultado (victoria/derrota/empate), lluvia de
  monedas y sonidos existentes.

## Limpieza
- Eliminado estado muerto: `aiControlsOpen` y `controlsOpen` (y sus effects).
- Eliminado import sin uso `Club` en `App.jsx`.

## Verificación
Validado por inspección estática: JSX balanceado, sin referencias colgantes,
marca anterior eliminada por completo y todas las clases/animaciones nuevas
definidas. Recomendado correr `npm run build` (o `npm run dev`) en tu equipo
para la confirmación final.

## Fuera de alcance (esta entrega)
- Tablero de Monopoly (solo rebrand de marca, sin rediseño).
- Secciones de IA/AI.
- Acción "Doblar": el backend actual solo soporta `hit`/`stand`; añadirla
  requeriría cambios de lógica del servidor.
