// ============================================================================
// GameLayout
// ----------------------------------------------------------------------------
// Estructura comun para las mesas de juego: cabecera (titulo + estado/turno),
// area principal (tablero/mesa) y panel lateral opcional (jugadores, historial
// de eventos). Pensada como contenedor presentacional reutilizable entre
// Blackjack y Monopoly para dar consistencia visual.
//
// Uso:
//   <GameLayout title="Monopoly" status={<TurnBadge/>} sidebar={<Players/>}>
//     <Board/>
//   </GameLayout>
// ============================================================================

export function GameLayout({ title, status = null, toolbar = null, sidebar = null, footer = null, children }) {
  return (
    <section className="game-layout">
      <header className="game-layout-header">
        <div className="flex items-center gap-3">
          {title ? <h1 className="game-layout-title">{title}</h1> : null}
          {status ? <div className="game-layout-status">{status}</div> : null}
        </div>
        {toolbar ? <div className="game-layout-toolbar">{toolbar}</div> : null}
      </header>

      <div className={`game-layout-body ${sidebar ? "has-sidebar" : ""}`}>
        <main className="game-layout-main">{children}</main>
        {sidebar ? <aside className="game-layout-sidebar">{sidebar}</aside> : null}
      </div>

      {footer ? <footer className="game-layout-footer">{footer}</footer> : null}
    </section>
  );
}

export default GameLayout;
