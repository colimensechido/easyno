// ============================================================================
// Dice
// ----------------------------------------------------------------------------
// Dado animado reutilizable. Reutiliza las clases .die-face / .die-face.rolling
// (animacion dice-roll ya definida en index.css). Renderiza puntos clasicos
// para un aspecto mas de videojuego, con fallback al numero.
//
// Uso:
//   <Dice value={4} rolling={isRolling} />
//   <DicePair values={[3, 5]} rolling={isRolling} />
// ============================================================================

const PIP_LAYOUT = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

export function Dice({ value = 1, rolling = false, size = 64, label }) {
  const pips = PIP_LAYOUT[value] || PIP_LAYOUT[1];
  const style = { width: size, height: size };
  return (
    <div
      className={`die-face ${rolling ? "rolling" : ""}`}
      style={style}
      role="img"
      aria-label={label || `Dado: ${value}`}
    >
      {rolling ? (
        <span className="die-rolling-glyph">⚄</span>
      ) : (
        <span className="die-pip-grid" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => (
            <span key={index} className={`die-pip ${pips.includes(index) ? "on" : ""}`} />
          ))}
        </span>
      )}
    </div>
  );
}

export function DicePair({ values = [1, 1], rolling = false, size = 64 }) {
  return (
    <div className="dice-stage flex items-center gap-3">
      <Dice value={values[0]} rolling={rolling} size={size} />
      <Dice value={values[1]} rolling={rolling} size={size} />
    </div>
  );
}

export default Dice;
