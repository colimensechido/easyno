export const BOARD_3D = {
  track: 6.4,
  tileStep: 1.28,
  tileHeight: 0.18,
  edgeWidth: 1.08,
  edgeDepth: 1.42,
  cornerSize: 1.52,
  centerSize: 10.0
};

export const colorGroupMeta3D = {
  brown: { color: "#7a4b2a", label: "Bolivia" },
  light_blue: { color: "#7cd4e8", label: "Ecuador" },
  pink: { color: "#d95db4", label: "Peru" },
  orange: { color: "#eb8f2d", label: "Chile" },
  red: { color: "#d4473b", label: "Argentina" },
  yellow: { color: "#f0d24f", label: "Colombia" },
  green: { color: "#30a44a", label: "Brasil" },
  dark_blue: { color: "#274fae", label: "Mexico" }
};

export const playerColors3D = [
  "#d94841",
  "#2f7ef0",
  "#20a56d",
  "#f0bc3f",
  "#7a58d7",
  "#ec4899"
];

export function boardPositionForIndex(index, y = BOARD_3D.tileHeight / 2) {
  const track = BOARD_3D.track;
  const step = BOARD_3D.tileStep;

  if (index === 0) return { x: track, y, z: track, side: "bottom", corner: true, rotationY: 0 };
  if (index > 0 && index < 10) return { x: track - step * index, y, z: track, side: "bottom", corner: false, rotationY: 0 };
  if (index === 10) return { x: -track, y, z: track, side: "left", corner: true, rotationY: Math.PI / 2 };
  if (index > 10 && index < 20) return { x: -track, y, z: track - step * (index - 10), side: "left", corner: false, rotationY: Math.PI / 2 };
  if (index === 20) return { x: -track, y, z: -track, side: "top", corner: true, rotationY: Math.PI };
  if (index > 20 && index < 30) return { x: -track + step * (index - 20), y, z: -track, side: "top", corner: false, rotationY: Math.PI };
  if (index === 30) return { x: track, y, z: -track, side: "right", corner: true, rotationY: -Math.PI / 2 };
  return { x: track, y, z: -track + step * (index - 30), side: "right", corner: false, rotationY: -Math.PI / 2 };
}

export function piecePositionForPlayer(player, players = []) {
  const base = boardPositionForIndex(player.position || 0, 0.42);
  const sameSpace = players.filter((candidate) => candidate.position === player.position && !candidate.bankrupt);
  const localIndex = Math.max(0, sameSpace.findIndex((candidate) => candidate.id === player.id));
  const offsets = [
    { x: -0.24, z: -0.24 },
    { x: 0.24, z: -0.24 },
    { x: -0.24, z: 0.24 },
    { x: 0.24, z: 0.24 },
    { x: 0, z: 0 }
  ];
  const offset = offsets[localIndex % offsets.length];

  return {
    x: base.x + offset.x,
    y: base.y,
    z: base.z + offset.z
  };
}

export function tileSizeForSpace(index) {
  if (index % 10 === 0) {
    return { width: BOARD_3D.cornerSize, depth: BOARD_3D.cornerSize };
  }

  return { width: BOARD_3D.edgeWidth, depth: BOARD_3D.edgeDepth };
}

export function tileTone(space) {
  if (space.colorGroup) return colorGroupMeta3D[space.colorGroup]?.color || "#e9dcc3";

  switch (space.type) {
    case "SALIDA":
      return "#f4d45d";
    case "FERROCARRIL":
      return "#dad5c8";
    case "SERVICIO_PUBLICO":
      return "#89cbb5";
    case "IMPUESTO":
      return "#f0a35e";
    case "CASUALIDAD":
      return "#d96bb3";
    case "ARCA_COMUNAL":
      return "#66b7dc";
    case "CARCEL_VISITA":
      return "#d8a45b";
    case "VAYASE_A_LA_CARCEL":
      return "#b8463e";
    case "PARADA_LIBRE":
      return "#7bcf83";
    default:
      return "#eadfc9";
  }
}

export function compactSpaceLabel(space) {
  return space.shortName || space.name || `Casilla ${space.index}`;
}

export function priceOrTypeLabel(space) {
  if (space.price) return `$${space.price}`;
  return space.type?.replaceAll("_", " ") || "";
}

export function movePlayerBySteps(players, playerId, steps, boardSize = 40) {
  return players.map((player) => {
    if (player.id !== playerId || player.bankrupt) return player;
    return {
      ...player,
      position: ((player.position || 0) + steps) % boardSize
    };
  });
}

export function createMockPlayers(currentUser) {
  return [
    {
      id: currentUser?.id || "mock-player-1",
      name: currentUser?.username || "Tu ficha",
      position: 0,
      cash: 1500
    },
    { id: "mock-player-2", name: "Ada", position: 7, cash: 1320 },
    { id: "mock-player-3", name: "Bruno", position: 14, cash: 980 },
    { id: "mock-player-4", name: "Cora", position: 28, cash: 1710 }
  ].map((player, index) => ({
    ...player,
    color: playerColors3D[index % playerColors3D.length],
    colorIndex: index
  }));
}
