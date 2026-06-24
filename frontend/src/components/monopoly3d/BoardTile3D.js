import * as THREE from "three";
import {
  BOARD_3D,
  boardPositionForIndex,
  compactSpaceLabel,
  playerColors3D,
  priceOrTypeLabel,
  tileSizeForSpace,
  tileTone
} from "./board3dUtils";

function fitText(context, text, maxWidth, startSize, minSize = 18) {
  let size = startSize;
  do {
    context.font = `950 ${size}px Inter, Arial, sans-serif`;
    if (context.measureText(text).width <= maxWidth) return size;
    size -= 2;
  } while (size >= minSize);
  return minSize;
}

function wrapText(context, text, maxWidth, maxLines = 2) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (context.measureText(next).width <= maxWidth || !current) {
      current = next;
      return;
    }
    lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  visible[maxLines - 1] = `${visible[maxLines - 1].replace(/\s+\S+$/, "") || visible[maxLines - 1]}`.slice(0, 18) + "...";
  return visible;
}

function isDeckSpace(space) {
  return space?.type === "CASUALIDAD" || space?.type === "ARCA_COMUNAL";
}

function isGoSpace(space) {
  return space?.type === "SALIDA";
}

function deckThemeForSpace(space) {
  if (space?.type === "ARCA_COMUNAL") {
    return {
      title: "ARCA",
      subtitle: "COMUNAL",
      mark: "!",
      color: "#78d4c8",
      ink: "#064e3b",
      glow: "rgba(15, 118, 110, 0.18)"
    };
  }

  return {
    title: "CASUALIDAD",
    subtitle: "SORPRESA",
    mark: "?",
    color: "#f7c948",
    ink: "#7c3f00",
    glow: "rgba(247, 201, 72, 0.24)"
  };
}

function drawDeckTileTexture(context, canvas, space) {
  const theme = deckThemeForSpace(space);

  context.fillStyle = "#fff8e9";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = theme.color;
  context.globalAlpha = 0.16;
  context.beginPath();
  context.arc(canvas.width / 2, canvas.height / 2 - 8, 150, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  context.fillStyle = theme.color;
  context.fillRect(0, 0, canvas.width, 68);
  context.fillStyle = "rgba(255,255,255,0.35)";
  context.fillRect(0, 68, canvas.width, 8);
  context.strokeStyle = theme.ink;
  context.globalAlpha = 0.28;
  context.lineWidth = 12;
  context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
  context.globalAlpha = 1;

  context.fillStyle = theme.ink;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "950 56px Inter, Arial, sans-serif";
  context.fillText(String(space?.index ?? 0).padStart(2, "0"), 76, 34);

  context.globalAlpha = 0.82;
  context.font = "950 138px Inter, Arial, sans-serif";
  context.fillText(theme.mark, canvas.width / 2, 162);
  context.globalAlpha = 1;

  context.font = "950 54px Inter, Arial, sans-serif";
  context.fillText(theme.title, canvas.width / 2, 278);

  context.fillStyle = "#7b5b34";
  context.font = "900 30px Inter, Arial, sans-serif";
  context.fillText(theme.subtitle, canvas.width / 2, 326);
}

function drawGoTileTexture(context, canvas, space) {
  context.fillStyle = "#fff8e9";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#fef3c7");
  gradient.addColorStop(0.5, "#fbbf24");
  gradient.addColorStop(1, "#0f766e");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, 92);

  context.strokeStyle = "#0f5f58";
  context.lineWidth = 16;
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

  context.fillStyle = "rgba(15, 118, 110, 0.11)";
  context.beginPath();
  context.arc(canvas.width * 0.72, canvas.height * 0.5, 148, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.translate(canvas.width / 2, 182);
  context.fillStyle = "#0f766e";
  context.beginPath();
  context.moveTo(148, -32);
  context.lineTo(-64, -32);
  context.lineTo(-64, -82);
  context.lineTo(-178, 0);
  context.lineTo(-64, 82);
  context.lineTo(-64, 32);
  context.lineTo(148, 32);
  context.closePath();
  context.fill();
  context.restore();

  context.fillStyle = "#24180d";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "950 48px Inter, Arial, sans-serif";
  context.fillText(String(space?.index ?? 0).padStart(2, "0"), 70, 46);

  context.fillStyle = "#fffdf7";
  context.font = "950 46px Inter, Arial, sans-serif";
  context.fillText("CASILLA DE", canvas.width / 2, 45);

  context.fillStyle = "#24180d";
  context.font = "950 76px Inter, Arial, sans-serif";
  context.fillText("SALIDA", canvas.width / 2, 286);

  context.fillStyle = "#0f5f58";
  context.font = "950 34px Inter, Arial, sans-serif";
  context.fillText("PASA Y COBRA $200", canvas.width / 2, 338);
}

function makeLabelTexture(space, owner = null) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 384;
  const context = canvas.getContext("2d");
  const title = compactSpaceLabel(space);
  const meta = priceOrTypeLabel(space);
  const tone = tileTone(space);

  if (isDeckSpace(space)) {
    drawDeckTileTexture(context, canvas, space);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }

  if (isGoSpace(space)) {
    drawGoTileTexture(context, canvas, space);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }

  context.fillStyle = "#fff8e9";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#24180d";
  context.globalAlpha = 0.055;
  for (let x = -canvas.height; x < canvas.width; x += 34) {
    context.fillRect(x, 0, 10, canvas.height);
  }
  context.globalAlpha = 1;

  context.fillStyle = tone;
  context.fillRect(0, 0, canvas.width, 64);
  context.fillStyle = "rgba(255,255,255,0.32)";
  context.fillRect(0, 64, canvas.width, 8);

  context.strokeStyle = space.ownerId ? "#1f6f59" : "rgba(36,24,13,0.24)";
  context.lineWidth = 14;
  context.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);

  context.fillStyle = "#24180d";
  context.textAlign = "center";
  context.textBaseline = "middle";

  context.font = "950 42px Inter, Arial, sans-serif";
  context.fillStyle = space.colorGroup ? "#fffaf0" : "#24180d";
  context.fillText(String(space.index).padStart(2, "0"), 76, 34);

  context.fillStyle = "#24180d";
  const titleSize = fitText(context, title, canvas.width - 112, 56, 30);
  context.font = `950 ${titleSize}px Inter, Arial, sans-serif`;
  const titleLines = wrapText(context, title, canvas.width - 112, 2);
  titleLines.forEach((line, index) => {
    context.fillText(line, canvas.width / 2, 144 + index * (titleSize + 8));
  });

  context.font = "900 36px Inter, Arial, sans-serif";
  context.fillStyle = "#7b5b34";
  context.fillText(meta.slice(0, 28), canvas.width / 2, 292);

  if (space.ownerId) {
    context.fillStyle = owner?.color || "#0f766e";
    context.roundRect(72, 304, canvas.width - 144, 40, 20);
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = "950 24px Inter, Arial, sans-serif";
    context.fillText(`DUENO: ${String(owner?.name || "Jugador").slice(0, 18)}`.toUpperCase(), canvas.width / 2, 324);
  }

  if (space.price) {
    context.fillStyle = space.ownerId ? "#1f2937" : "#14532d";
    context.roundRect(canvas.width / 2 - 122, 348, 244, 46, 22);
    context.fill();
    context.fillStyle = "#f0fff4";
    context.font = "950 30px Inter, Arial, sans-serif";
    context.fillText(`$${space.price}`, canvas.width / 2, 372);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createHouseMarker(x, z, { color = "#16a34a", roofColor = "#0f7a35", hotel = false } = {}) {
  const group = new THREE.Group();
  const houseMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.34,
    metalness: 0.04,
    emissive: color,
    emissiveIntensity: 0.04
  });
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: roofColor,
    roughness: 0.38,
    metalness: 0.03,
    emissive: roofColor,
    emissiveIntensity: 0.035
  });
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(hotel ? 0.26 : 0.18, hotel ? 0.18 : 0.14, hotel ? 0.18 : 0.17),
    houseMaterial
  );
  walls.position.y = hotel ? 0.09 : 0.07;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(hotel ? 0.2 : 0.15, hotel ? 0.14 : 0.11, 4),
    roofMaterial
  );
  roof.position.y = hotel ? 0.25 : 0.2;
  roof.rotation.y = Math.PI / 4;

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(hotel ? 0.052 : 0.04, hotel ? 0.075 : 0.055, 0.012),
    new THREE.MeshBasicMaterial({ color: hotel ? "#fee2e2" : "#dcfce7" })
  );
  door.position.set(0, hotel ? 0.065 : 0.048, hotel ? 0.097 : 0.091);

  group.add(walls, roof, door);
  group.position.set(x, BOARD_3D.tileHeight + 0.02, z);
  group.traverse((child) => {
    child.castShadow = true;
    child.userData.spaceIndex = group.userData.spaceIndex;
  });
  return group;
}

function addBuildingMarkers(group, space, width, depth) {
  const count = Math.min(4, Number(space.houses || 0));
  const z = depth * 0.36;

  if (space.hasHotel) {
    const hotel = createHouseMarker(0, z, { color: "#dc2626", roofColor: "#7f1d1d", hotel: true });
    hotel.scale.set(1.35, 1.28, 1.35);
    hotel.userData.spaceIndex = space.index;
    hotel.userData.spaceId = space.id;
    group.add(hotel);
    return;
  }

  if (!count) return;
  const spacing = Math.min(0.2, (width * 0.58) / Math.max(1, count - 1));
  const start = -spacing * (count - 1) * 0.5;
  Array.from({ length: count }).forEach((_, index) => {
    const house = createHouseMarker(start + spacing * index, z, { color: "#16a34a", roofColor: "#047857" });
    house.userData.spaceIndex = space.index;
    house.userData.spaceId = space.id;
    group.add(house);
  });
}

function addOwnerMarker(group, space, ownerColor, width, depth) {
  if (!space.ownerId) return;
  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.64, 0.08, 0.12),
    new THREE.MeshStandardMaterial({
      color: ownerColor || "#1f6f59",
      roughness: 0.42,
      metalness: 0.08,
      emissive: ownerColor || "#1f6f59",
      emissiveIntensity: 0.06
    })
  );
  marker.position.set(0, BOARD_3D.tileHeight + 0.04, depth * 0.48);
  marker.castShadow = true;
  marker.userData.spaceIndex = space.index;
  marker.userData.spaceId = space.id;
  group.add(marker);
}

export function createBoardTile3D(space, players = []) {
  const position = boardPositionForIndex(space.index);
  const { width, depth } = tileSizeForSpace(space.index);
  const deckSpace = isDeckSpace(space);
  const goSpace = isGoSpace(space);
  const ownerIndex = players.findIndex((player) => player.id === space.ownerId);
  const owner = ownerIndex >= 0 ? players[ownerIndex] : null;
  const ownerColor = owner
    ? owner.color || playerColors3D[ownerIndex % playerColors3D.length]
    : null;
  const group = new THREE.Group();
  group.position.set(position.x, -0.02, position.z);
  group.rotation.y = position.rotationY;
  group.userData.spaceIndex = space.index;
  group.userData.spaceId = space.id;

  const tileGeometry = new THREE.BoxGeometry(width, BOARD_3D.tileHeight, depth);
  const tileMaterial = new THREE.MeshStandardMaterial({
    color: "#f4ead8",
    roughness: 0.72,
    metalness: 0.02
  });
  const tile = new THREE.Mesh(tileGeometry, tileMaterial);
  tile.position.y = BOARD_3D.tileHeight / 2;
  tile.castShadow = true;
  tile.receiveShadow = true;
  tile.userData.spaceIndex = space.index;
  tile.userData.spaceId = space.id;
  group.add(tile);
  group.userData.baseMesh = tile;

  if (!deckSpace && !goSpace) {
    const bandGeometry = new THREE.BoxGeometry(width * 0.86, BOARD_3D.tileHeight + 0.035, Math.max(0.14, depth * 0.14));
    const bandMaterial = new THREE.MeshStandardMaterial({
      color: tileTone(space),
      roughness: 0.54,
      metalness: 0.04
    });
    const band = new THREE.Mesh(bandGeometry, bandMaterial);
    band.position.set(0, BOARD_3D.tileHeight + 0.01, -depth * 0.36);
    band.userData.spaceIndex = space.index;
    band.userData.spaceId = space.id;
    group.add(band);
    group.userData.bandMesh = band;
  }

  const labelTexture = makeLabelTexture(space, owner ? { name: owner.name, color: ownerColor } : null);
  const labelGeometry = new THREE.PlaneGeometry(width * (deckSpace || goSpace ? 0.9 : 0.86), depth * (deckSpace || goSpace ? 0.72 : 0.56));
  const labelMaterial = new THREE.MeshBasicMaterial({
    map: labelTexture,
    transparent: true
  });
  const label = new THREE.Mesh(labelGeometry, labelMaterial);
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, BOARD_3D.tileHeight + 0.006, deckSpace || goSpace ? depth * 0.02 : depth * 0.08);
  label.userData.spaceIndex = space.index;
  label.userData.spaceId = space.id;
  group.add(label);
  group.userData.labelMesh = label;

  addOwnerMarker(group, space, ownerColor, width, depth);
  addBuildingMarkers(group, space, width, depth);

  return group;
}
