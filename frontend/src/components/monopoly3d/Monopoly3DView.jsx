import { Dice5, MoveRight, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClassicBoard } from "../../../../shared/monopoly-engine/data/board-data.mjs";
import Monopoly3DScene from "./Monopoly3DScene";
import { createMockPlayers, movePlayerBySteps } from "./board3dUtils";

function actionClassName(action) {
  if (action?.tone === "success") return "is-primary";
  if (action?.tone === "danger") return "is-danger";
  return "";
}

function Monopoly3DSpaceCard({ info, onAction }) {
  if (!info) return null;

  const stats = [
    ["Tipo", info.type || "Informacion no disponible"],
    ["Dueno", info.ownerName || "Banco"],
    ["Precio", info.priceLabel || "No aplica"],
    ["Renta base", info.baseRentLabel || "No aplica"],
    ["Renta actual", info.rentPreviewLabel || "No aplica"],
    ["Hipoteca", info.mortgageLabel || "No aplica"],
    ["Estado", info.buildLabel || info.statusLabel || "Informacion no disponible"],
    ["Fichas", info.visitorLabel || "Sin visitas"]
  ];
  const actions = Array.isArray(info.actions) ? info.actions : [];

  return (
    <section className="monopoly-3d-space-card" aria-label={`Informacion de ${info.name || "casilla"}`}>
      <header className="monopoly-3d-space-card-head">
        <span>
          <em>Casilla {String(info.index ?? 0).padStart(2, "0")}</em>
          <h3>{info.name || "Informacion no disponible"}</h3>
        </span>
        <i style={{ background: info.accent || "#fbbf24" }} aria-hidden="true" />
        <button
          type="button"
          className="monopoly-3d-space-card-close"
          onClick={() => onAction?.({ type: "close" })}
          title="Cerrar"
        >
          <X size={16} />
        </button>
      </header>

      <p className="monopoly-3d-space-card-description">
        {info.description || "Informacion no disponible para esta casilla."}
      </p>

      <div className="monopoly-3d-space-card-stats">
        {stats.map(([label, value]) => (
          <span key={label}>
            {label}
            <strong>{value}</strong>
          </span>
        ))}
      </div>

      <div className="monopoly-3d-space-card-actions">
        {actions.length > 0 ? (
          actions.map((action, index) => (
            <button
              key={`${action.type || "action"}-${action.actionName || action.intent || index}`}
              type="button"
              className={actionClassName(action)}
              onClick={() => onAction?.(action)}
            >
              <span>{action.label || "Accion"}</span>
              {action.detail && <small>{action.detail}</small>}
            </button>
          ))
        ) : (
          <span className="monopoly-3d-space-card-empty">Sin acciones disponibles en esta casilla.</span>
        )}
      </div>
    </section>
  );
}

export default function Monopoly3DView({
  currentUser,
  gameState = null,
  players = null,
  currentPlayerId = null,
  selectedSpaceId = null,
  onSelectSpaceId,
  sidePanel = null,
  rollingDice = false,
  diceFaces = [1, 1],
  onRemoteDiceMotionSink,
  cinematic = null,
  moneyBursts = [],
  pendingCard = null,
  selectedSpaceInfo = null,
  cameraFocus = null,
  cameraAutoFollow = false,
  canRollDice = false,
  onRollDice,
  onDiceMotion,
  onSelectionAction,
  statusTitle = "",
  statusBody = ""
}) {
  const board = useMemo(() => gameState?.board || createClassicBoard(), [gameState?.board]);
  const fallbackPlayers = useMemo(() => createMockPlayers(currentUser), [currentUser?.id, currentUser?.username]);
  const [mockPlayers, setMockPlayers] = useState(fallbackPlayers);
  const [internalSelectedSpaceId, setInternalSelectedSpaceId] = useState("go");
  const [activePlayerId, setActivePlayerId] = useState("");
  const [diceGestureActive, setDiceGestureActive] = useState(false);
  const connectedPlayers = players || gameState?.players || [];
  const isConnected = Boolean(connectedPlayers.length);
  const displayPlayers = isConnected ? connectedPlayers : mockPlayers;
  const authoritativePlayers = gameState?.players || connectedPlayers;
  const resolvedSelectedSpaceId = selectedSpaceId || internalSelectedSpaceId;
  const selectedSpace =
    board.find((space) => space.id === resolvedSelectedSpaceId) ||
    board.find((space) => space.index === 0) ||
    board[0];
  const cinematicPlayer = cinematic?.playerId
    ? authoritativePlayers.find((player) => player.id === cinematic.playerId)
    : null;
  const destinationSpace =
    board.find((space) => space.index === cinematicPlayer?.position) ||
    selectedSpace;
  const activePlayer = displayPlayers.find((player) => player.id === activePlayerId) || displayPlayers[0];
  const diceRollingVisual = rollingDice || cinematic?.phase === "diceRolling";
  const stageStatus = diceRollingVisual
    ? "Tirando dados..."
    : cinematic?.phase === "cameraFocusDice"
      ? "Enfocando dados..."
      : cinematic?.phase === "dice"
      ? `Resultado: ${diceFaces[0]} + ${diceFaces[1]} = ${(diceFaces[0] || 0) + (diceFaces[1] || 0)}`
      : cinematic?.phase === "highlightTarget"
        ? `Destino: ${destinationSpace?.name || "casilla final"}`
      : cinematic?.phase === "move"
        ? "Moviendo ficha..."
        : cinematic?.phase === "settle"
          ? `Llegaste a ${destinationSpace?.name || "la casilla"}`
          : statusTitle || "Esperando tu decision";
  const stageBody = cinematic?.phase === "cameraFocusDice"
    ? "La camara entra a dados y la tirada arranca enseguida."
    : cinematic?.phase === "move"
    ? `La ficha avanza hacia ${destinationSpace?.name || "su destino"}.`
    : diceRollingVisual
      ? "Los dados ruedan en el centro del tablero."
      : cinematic?.phase === "dice"
        ? "Resultado listo, preparando movimiento."
    : cinematic?.phase === "highlightTarget"
      ? "La casilla destino se ilumina."
    : cinematic?.phase === "settle"
      ? "Resolviendo el evento final de la casilla seleccionada."
      : statusBody || "La mesa esta sincronizada con el estado real de la partida.";

  useEffect(() => {
    if (!displayPlayers.length) {
      setActivePlayerId("");
      return;
    }

    if (isConnected && currentPlayerId && displayPlayers.some((player) => player.id === currentPlayerId)) {
      setActivePlayerId(currentPlayerId);
      return;
    }

    if (!displayPlayers.some((player) => player.id === activePlayerId)) {
      setActivePlayerId(displayPlayers[0].id);
    }
  }, [activePlayerId, currentPlayerId, displayPlayers, isConnected]);

  function resetMock() {
    const nextPlayers = createMockPlayers(currentUser);
    setMockPlayers(nextPlayers);
    setActivePlayerId(nextPlayers[0]?.id || "");
    setInternalSelectedSpaceId("go");
  }

  function advanceActivePlayer(steps = 1) {
    if (isConnected || !activePlayer) return;
    setMockPlayers((current) => movePlayerBySteps(current, activePlayer.id, steps, board.length));
  }

  function rollMockMove() {
    const steps = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
    advanceActivePlayer(steps);
  }

  function handleSelectSpaceIndex(spaceIndex) {
    const nextSpace = board.find((space) => space.index === spaceIndex);
    if (!nextSpace) return;

    if (onSelectSpaceId) {
      onSelectSpaceId(nextSpace.id);
      return;
    }

    setInternalSelectedSpaceId(nextSpace.id);
  }

  function handleFocusPlayer(playerId) {
    setActivePlayerId(playerId);

    const player = displayPlayers.find((entry) => entry.id === playerId);
    const nextSpace = board.find((space) => space.index === player?.position);
    if (!nextSpace) return;

    if (onSelectSpaceId) {
      onSelectSpaceId(nextSpace.id);
      return;
    }

    setInternalSelectedSpaceId(nextSpace.id);
  }

  return (
    <section className="monopoly-3d-view">
      <div className="monopoly-3d-layout">
        <div className="monopoly-3d-stage">
          <div className={`monopoly-3d-stage-banner ${diceRollingVisual || cinematic ? "is-live" : ""}`}>
            <p>{stageStatus}</p>
            <span>{stageBody}</span>
          </div>
          {canRollDice && !diceRollingVisual && !diceGestureActive && (
            <div className="monopoly-3d-dice-hint">
              <Dice5 size={18} />
              <span>
                <strong>Tu tirada</strong>
                Arrastra y suelta los dados
              </span>
            </div>
          )}
          <Monopoly3DScene
            board={board}
            players={displayPlayers}
            selectedSpaceIndex={selectedSpace?.index ?? 0}
            onSelectSpace={handleSelectSpaceIndex}
            currentPlayerId={currentPlayerId}
            rollingDice={rollingDice}
            diceFaces={diceFaces}
            onRemoteDiceMotionSink={onRemoteDiceMotionSink}
            cinematic={cinematic}
            moneyBursts={moneyBursts}
            pendingCard={pendingCard}
            selectedSpaceInfo={null}
            cameraFocus={cameraFocus}
            destinationSpaceIndex={destinationSpace?.index ?? null}
            canRollDice={canRollDice}
            onRollDice={onRollDice}
            onDiceGestureChange={setDiceGestureActive}
            onDiceMotion={onDiceMotion}
            onSelectionAction={onSelectionAction}
            cameraAutoFollow={cameraAutoFollow}
          />
          {sidePanel}
          <Monopoly3DSpaceCard info={selectedSpaceInfo} onAction={onSelectionAction} />
        </div>
      </div>

      {!sidePanel && (
        <div className="monopoly-3d-bottom-panel">
          <section className="monopoly-3d-info-panel">
            <div className="monopoly-3d-panel-head">
              <span>
                <strong>{selectedSpace?.name || "Salida"}</strong>
                <em>Casilla {selectedSpace?.index ?? 0} - {selectedSpace?.type || "SALIDA"}</em>
              </span>
            </div>
            {!isConnected && (
              <div className="monopoly-3d-mock-controls">
                <select
                  className="monopoly-3d-select"
                  value={activePlayer?.id || ""}
                  onChange={(event) => setActivePlayerId(event.target.value)}
                  title="Ficha activa"
                >
                  {displayPlayers.map((player) => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
                <button type="button" className="monopoly-3d-button" onClick={() => advanceActivePlayer(1)}>
                  <MoveRight size={16} />
                  Avanzar
                </button>
                <button type="button" className="monopoly-3d-button is-primary" onClick={rollMockMove}>
                  <Dice5 size={16} />
                  Dados
                </button>
                <button type="button" className="monopoly-3d-button" onClick={resetMock}>
                  <RotateCcw size={16} />
                  Reset
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
