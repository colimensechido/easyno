import * as THREE from "three";
import { createBoardTile3D } from "./BoardTile3D";
import { animatePlayerPiece, createPlayerPiece3D, setPlayerPieceTarget } from "./PlayerPiece3D";
import { BOARD_3D, CARD_DECK_OBSTACLES } from "./board3dUtils";

function clampText(text, maxLength) {
  const value = String(text || "");
  return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 3))}...` : value;
}

function readableText(value, fallback = "Informacion no disponible") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeSelectionCardInfo(info = {}) {
  return {
    ...info,
    index: Number.isInteger(info?.index) ? info.index : 0,
    name: readableText(info?.name, "Casilla"),
    type: readableText(info?.type, "Especial"),
    groupLabel: readableText(info?.groupLabel, "Especial"),
    ownerName: readableText(info?.ownerName, "Banco"),
    statusLabel: readableText(info?.statusLabel, "Estado no disponible"),
    description: readableText(info?.description, "Informacion no disponible para esta casilla."),
    priceLabel: readableText(info?.priceLabel, "No aplica"),
    baseRentLabel: readableText(info?.baseRentLabel, "No aplica"),
    rentPreviewLabel: readableText(info?.rentPreviewLabel, "No aplica"),
    mortgageLabel: readableText(info?.mortgageLabel, "No aplica"),
    buildLabel: readableText(info?.buildLabel || info?.statusLabel, "Estado no disponible"),
    visitorLabel: readableText(info?.visitorLabel, "Sin visitas"),
    accent: readableText(info?.accent, "#fbbf24"),
    actions: Array.isArray(info?.actions) ? info.actions : [],
    rentRows: Array.isArray(info?.rentRows) ? info.rentRows : []
  };
}

function drawCanvasText(context, text, x, y, {
  color = "#f8fafc",
  font = "bold 24px Arial, sans-serif",
  align = "left",
  baseline = "middle",
  maxLength = null,
  shadow = true,
  stroke = false
} = {}) {
  const value = clampText(readableText(text), maxLength || 200);
  context.save();
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.textAlign = align;
  context.textBaseline = baseline;
  context.font = font;
  if (shadow) {
    context.shadowColor = "rgba(0, 0, 0, 0.72)";
    context.shadowBlur = 4;
    context.shadowOffsetY = 2;
  }
  if (stroke) {
    context.lineWidth = 4;
    context.strokeStyle = "rgba(0, 0, 0, 0.72)";
    context.strokeText(value, x, y);
  }
  context.fillStyle = color;
  context.fillText(value, x, y);
  context.restore();
}

function createSelectionInfoTexture(info) {
  const canvas = document.createElement("canvas");
  canvas.width = 896;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const accent = info?.accent || "#fbbf24";

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(6, 12, 11, 0.92)";
  context.roundRect(18, 18, canvas.width - 36, canvas.height - 36, 34);
  context.fill();
  context.strokeStyle = accent;
  context.lineWidth = 10;
  context.stroke();

  context.fillStyle = accent;
  context.roundRect(44, 44, canvas.width - 88, 38, 18);
  context.fill();

  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillStyle = "#fef3c7";
  context.font = "950 34px Inter, Arial, sans-serif";
  context.fillText(`CASILLA ${String(info?.index ?? 0).padStart(2, "0")}`, 58, 118);

  context.fillStyle = "#f8fafc";
  context.font = "950 62px Inter, Arial, sans-serif";
  context.fillText(clampText(info?.name || "Casilla", 22), 58, 188);

  context.fillStyle = "rgba(226, 232, 240, 0.86)";
  context.font = "850 30px Inter, Arial, sans-serif";
  context.fillText(clampText(`${info?.type || "Especial"} · ${info?.ownerName || "Banco"}`, 42), 58, 248);

  if (info?.ownerColor) {
    context.fillStyle = info.ownerColor;
    context.roundRect(654, 104, 168, 48, 24);
    context.fill();
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.font = "950 22px Inter, Arial, sans-serif";
    context.fillText("DUENO", 738, 128);
    context.textAlign = "left";
  }

  const stats = [
    ["Precio", info?.priceLabel || "--"],
    ["Construccion", info?.buildLabel || "Base"],
    ["Fichas", info?.visitorLabel || "Sin visitas"]
  ];

  stats.forEach(([label, value], index) => {
    const x = 58 + index * 260;
    context.fillStyle = "rgba(255, 255, 255, 0.08)";
    context.roundRect(x, 308, 232, 116, 20);
    context.fill();
    context.fillStyle = "rgba(226, 232, 240, 0.68)";
    context.font = "900 22px Inter, Arial, sans-serif";
    context.fillText(label.toUpperCase(), x + 20, 344);
    context.fillStyle = "#f8fafc";
    context.font = "950 30px Inter, Arial, sans-serif";
    context.fillText(clampText(value, 16), x + 20, 386);
  });

  const actions = (info?.actions || []).slice(0, 4);
  if (actions.length > 0) {
    context.fillStyle = "rgba(8, 145, 178, 0.28)";
    context.roundRect(58, 438, canvas.width - 116, 42, 18);
    context.fill();
    context.fillStyle = "#ccfbf1";
    context.font = "900 22px Inter, Arial, sans-serif";
    context.fillText(`ACCIONES: ${actions.map((action) => action.label).join("  /  ")}`, 82, 459);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createSelectionBillboard() {
  const group = new THREE.Group();
  group.visible = false;

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.05, 1.05, 14),
    new THREE.MeshStandardMaterial({ color: "#f5d16c", roughness: 0.42, metalness: 0.2 })
  );
  pole.position.y = 0.72;
  pole.castShadow = true;
  group.add(pole);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.018, 10, 44),
    new THREE.MeshBasicMaterial({ color: "#fbbf24", transparent: true, opacity: 0.72, depthWrite: false })
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 0.07;
  group.add(halo);
  group.userData.halo = halo;

  const panelMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    opacity: 1,
    side: THREE.DoubleSide
  });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.55), panelMaterial);
  panel.position.y = 2.08;
  panel.renderOrder = 18;
  panel.userData.selectionPanel = true;
  group.add(panel);

  group.userData.panel = panel;
  group.userData.currentKey = "";
  group.userData.baseY = 0;
  group.userData.activeTab = "info";
  group.userData.hoverKey = "";
  return group;
}

function createSelectionActionTexture(action, index, active = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const danger = action.tone === "danger";
  const bg = danger ? "#7f1d1d" : active ? "#0f766e" : "#10231f";
  const border = danger ? "#fecaca" : active ? "#ccfbf1" : "#38bdf8";

  context.fillStyle = bg;
  context.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 24);
  context.fill();
  context.strokeStyle = border;
  context.lineWidth = 6;
  context.stroke();
  context.fillStyle = "#f8fafc";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "950 34px Inter, Arial, sans-serif";
  context.fillText(clampText(action.label || `Accion ${index + 1}`, 16).toUpperCase(), canvas.width / 2, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 6;
  return texture;
}

function createSelectionActionButton(action, index) {
  const material = new THREE.MeshBasicMaterial({
    map: createSelectionActionTexture(action, index),
    transparent: true,
    depthWrite: false,
    depthTest: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 0.44), material);
  mesh.renderOrder = 19;
  mesh.userData.selectionAction = action;
  mesh.userData.actionIndex = index;
  return mesh;
}

const SELECTION_CARD_WIDTH = 1024;
const SELECTION_CARD_HEIGHT = 704;

function drawSelectionCardButton(context, zone, label, { active = false, danger = false, hover = false } = {}) {
  const bg = danger ? "#8f2020" : active ? "#0f766e" : hover ? "#244f46" : "#15231f";
  const border = danger ? "#fecaca" : active ? "#99f6e4" : hover ? "#f4d45d" : "#37534b";
  const textColor = danger ? "#fff7f7" : active ? "#f4fffc" : "#f8fafc";

  context.fillStyle = bg;
  context.roundRect(zone.x, zone.y, zone.w, zone.h, Math.min(20, zone.h / 2));
  context.fill();
  context.strokeStyle = border;
  context.lineWidth = hover ? 5 : 3;
  context.stroke();
  drawCanvasText(context, String(label || "Accion").toUpperCase(), zone.x + zone.w / 2, zone.y + zone.h / 2, {
    color: textColor,
    font: "bold 30px Arial, sans-serif",
    align: "center",
    maxLength: 15,
    stroke: true
  });
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines = 2, options = {}) {
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

  lines.slice(0, maxLines).forEach((line, index) => {
    const visible = index === maxLines - 1 && lines.length > maxLines
      ? `${line.replace(/\s+\S+$/, "") || line}...`
      : line;
    drawCanvasText(context, visible, x, y + index * lineHeight, options);
  });
}

function createSelectionCardHitZones(info, activeTab = "info") {
  const zones = [
    { key: "tab-info", type: "tab", tab: "info", x: 48, y: 46, w: 176, h: 58 },
    { key: "tab-rents", type: "tab", tab: "rents", x: 240, y: 46, w: 196, h: 58 },
    { key: "close", type: "close", x: 790, y: 46, w: 184, h: 58 }
  ];

  if (activeTab === "info") {
    (info?.actions || []).slice(0, 4).forEach((action, index) => {
      zones.push({
        key: `action-${index}`,
        type: "action",
        action,
        x: 48 + index * 234,
        y: 606,
        w: 218,
        h: 62
      });
    });
  }

  return zones;
}

function createSelectionCardTexture(info, activeTab = "info", hoverKey = "") {
  const card = normalizeSelectionCardInfo(info);
  const canvas = document.createElement("canvas");
  canvas.width = SELECTION_CARD_WIDTH;
  canvas.height = SELECTION_CARD_HEIGHT;
  const context = canvas.getContext("2d");
  const accent = card.accent || "#fbbf24";
  const zones = createSelectionCardHitZones(card, activeTab);
  const ink = "#f8fafc";
  const mutedInk = "#c8d8d2";
  const panelFill = "#07120f";
  const softPanel = "#10231f";
  const softPanelAlt = "#142d27";
  const description = card.description || card.statusLabel || "Informacion no disponible.";

  context.clearRect(0, 0, SELECTION_CARD_WIDTH, SELECTION_CARD_HEIGHT);
  context.fillStyle = "rgba(0, 0, 0, 0.58)";
  context.roundRect(18, 22, SELECTION_CARD_WIDTH - 26, SELECTION_CARD_HEIGHT - 28, 34);
  context.fill();
  context.fillStyle = panelFill;
  context.roundRect(10, 10, SELECTION_CARD_WIDTH - 20, SELECTION_CARD_HEIGHT - 20, 34);
  context.fill();
  context.strokeStyle = accent;
  context.lineWidth = 7;
  context.stroke();

  context.fillStyle = "rgba(255,255,255,0.04)";
  context.roundRect(28, 28, SELECTION_CARD_WIDTH - 56, 96, 24);
  context.fill();

  zones.filter((zone) => zone.type === "tab").forEach((zone) => {
    drawSelectionCardButton(context, zone, zone.tab === "info" ? "Info" : "Rentas", {
      active: activeTab === zone.tab,
      hover: hoverKey === zone.key
    });
  });

  const closeZone = zones.find((zone) => zone.type === "close");
  drawSelectionCardButton(context, closeZone, "Cerrar X", {
    danger: true,
    hover: hoverKey === "close"
  });

  drawCanvasText(context, `CASILLA ${String(card.index).padStart(2, "0")}`, 54, 168, {
    color: "#f4d45d",
    font: "bold 34px Arial, sans-serif",
    maxLength: 18,
    stroke: true
  });

  drawCanvasText(context, card.name, 54, 240, {
    color: ink,
    font: "bold 72px Arial, sans-serif",
    maxLength: 19,
    stroke: true
  });

  drawCanvasText(context, `${card.type} - ${card.ownerName}`, 54, 302, {
    color: mutedInk,
    font: "bold 32px Arial, sans-serif",
    maxLength: 42,
    stroke: true
  });

  context.fillStyle = info?.ownerColor || "#2f4f46";
  context.roundRect(700, 154, 274, 62, 26);
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.22)";
  context.lineWidth = 2;
  context.stroke();
  drawCanvasText(context, card.ownerName.toUpperCase(), 837, 185, {
    color: "#ffffff",
    font: "bold 28px Arial, sans-serif",
    align: "center",
    maxLength: 16,
    stroke: true
  });

  context.fillStyle = softPanel;
  context.roundRect(48, 340, 928, 112, 22);
  context.fill();
  context.strokeStyle = "#37534b";
  context.lineWidth = 2;
  context.stroke();
  drawCanvasText(context, card.statusLabel.toUpperCase(), 76, 374, {
    color: "#f4d45d",
    font: "bold 25px Arial, sans-serif",
    maxLength: 34,
    stroke: true
  });
  context.font = "bold 29px Arial, sans-serif";
  drawWrappedText(context, description, 76, 416, 860, 34, 2, {
    color: "#e5f0ec",
    font: "bold 29px Arial, sans-serif",
    maxLength: 72,
    stroke: true
  });

  if (activeTab === "rents") {
    const rentRows = card.rentRows.slice(0, 8);
    const startY = 486;

    if (rentRows.length === 0) {
      context.fillStyle = softPanel;
      context.roundRect(48, startY, 928, 96, 20);
      context.fill();
      context.strokeStyle = "#37534b";
      context.lineWidth = 2;
      context.stroke();
      drawCanvasText(context, "Esta casilla no tiene tabla de renta.", 78, startY + 48, {
        color: ink,
        font: "bold 30px Arial, sans-serif",
        maxLength: 46,
        stroke: true
      });
    } else {
      rentRows.forEach((row, index) => {
        const col = index % 2;
        const line = Math.floor(index / 2);
        const x = 48 + col * 466;
        const y = startY + line * 50;
        context.fillStyle = row.active ? "#123f34" : softPanelAlt;
        context.roundRect(x, y, 440, 42, 14);
        context.fill();
        context.strokeStyle = row.active ? "#99f6e4" : "#37534b";
        context.lineWidth = row.active ? 3 : 2;
        context.stroke();
        drawCanvasText(context, row.label, x + 18, y + 22, {
          color: row.active ? "#ccfbf1" : mutedInk,
          font: "bold 22px Arial, sans-serif",
          maxLength: 20,
          stroke: true
        });
        drawCanvasText(context, row.value, x + 416, y + 22, {
          color: ink,
          font: "bold 24px Arial, sans-serif",
          align: "right",
          maxLength: 14,
          stroke: true
        });
      });
    }
  } else {
    const stats = [
      ["Precio", card.priceLabel],
      ["Renta base", card.baseRentLabel],
      ["Renta actual", card.rentPreviewLabel],
      ["Hipoteca", card.mortgageLabel],
      ["Estado", card.buildLabel],
      ["Fichas", card.visitorLabel]
    ];

    stats.forEach(([label, value], index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 48 + col * 466;
      const y = 470 + row * 44;
      context.fillStyle = softPanelAlt;
      context.roundRect(x, y, 440, 38, 14);
      context.fill();
      context.strokeStyle = "#37534b";
      context.lineWidth = 2;
      context.stroke();
      drawCanvasText(context, label.toUpperCase(), x + 18, y + 13, {
        color: mutedInk,
        font: "bold 15px Arial, sans-serif",
        baseline: "middle",
        maxLength: 18,
        shadow: false
      });
      drawCanvasText(context, value, x + 18, y + 30, {
        color: ink,
        font: "bold 22px Arial, sans-serif",
        maxLength: 24,
        stroke: true
      });
    });

    const actionZones = zones.filter((zone) => zone.type === "action");
    if (actionZones.length > 0) {
      actionZones.forEach((zone) => {
        drawSelectionCardButton(context, zone, zone.action?.label || "Accion", {
          danger: zone.action?.tone === "danger",
          active: zone.action?.tone === "success",
          hover: hoverKey === zone.key
        });
      });
    } else {
      context.fillStyle = softPanel;
      context.roundRect(48, 606, 458, 62, 18);
      context.fill();
      context.strokeStyle = "#37534b";
      context.lineWidth = 2;
      context.stroke();
      drawCanvasText(context, "Sin acciones disponibles en esta casilla.", 76, 637, {
        color: mutedInk,
        font: "bold 24px Arial, sans-serif",
        maxLength: 48,
        stroke: true
      });
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function createDeckTexture({ title, mark, color, ink }) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 720;
  const context = canvas.getContext("2d");

  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255,255,255,0.26)";
  context.fillRect(30, 30, canvas.width - 60, canvas.height - 60);
  context.strokeStyle = ink;
  context.lineWidth = 18;
  context.strokeRect(44, 44, canvas.width - 88, canvas.height - 88);

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = ink;
  context.font = "950 190px Inter, Arial, sans-serif";
  context.fillText(mark, canvas.width / 2, 276);
  context.font = "950 54px Inter, Arial, sans-serif";
  context.fillText(title, canvas.width / 2, 470);
  context.font = "900 28px Inter, Arial, sans-serif";
  context.fillText("TOCA PARA ROBAR", canvas.width / 2, 548);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createDeckStack({ deck, title, mark, color, ink, x, z, rotation = 0 }) {
  const group = new THREE.Group();
  group.position.set(x, 0.105, z);
  group.rotation.y = rotation;
  group.userData.deck = deck;
  group.userData.baseY = group.position.y;

  const texture = createDeckTexture({ title, mark, color, ink });
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.56,
    metalness: 0.04,
    emissive: ink,
    emissiveIntensity: 0.02
  });
  const sideMaterial = new THREE.MeshStandardMaterial({ color: "#f9f0d2", roughness: 0.72, metalness: 0.02 });

  for (let index = 0; index < 5; index += 1) {
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.035, 2.15),
      [sideMaterial, sideMaterial, material, sideMaterial, sideMaterial, sideMaterial]
    );
    card.position.y = index * 0.032;
    card.rotation.y = (index - 2) * 0.01;
    card.castShadow = true;
    card.receiveShadow = true;
    group.add(card);
  }

  const drawCard = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.035, 2.15),
    [sideMaterial, sideMaterial, material.clone(), sideMaterial, sideMaterial, sideMaterial]
  );
  drawCard.position.y = 0.17;
  drawCard.visible = false;
  drawCard.castShadow = true;
  drawCard.userData.isDrawCard = true;
  group.add(drawCard);
  group.userData.drawCard = drawCard;

  return group;
}

function resolveBoardTheme(theme = null) {
  const metadata = theme?.metadata || {};
  return {
    id: theme?.id || "default",
    baseColor: metadata.baseColor || "#2d2418",
    centerColor: metadata.centerColor || "#1f6f59",
    accentColor: metadata.accentColor || "#f4d45d",
    roughness: Number.isFinite(Number(metadata.roughness)) ? Number(metadata.roughness) : 0.68,
    metalness: Number.isFinite(Number(metadata.metalness)) ? Number(metadata.metalness) : 0.08
  };
}

export function createBoard3D({ board = [], players = [], boardTheme = null, hideCenterDecks = false }) {
  const group = new THREE.Group();
  const theme = resolveBoardTheme(boardTheme);
  const tileMeshes = [];
  const interactiveMeshes = [];
  const playerLayer = new THREE.Group();
  const playerPieces = new Map();
  const tileGroups = new Map();
  const cardDecks = new Map();
  const selectionBillboard = createSelectionBillboard();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_3D.track * 2 + 2.4, 0.22, BOARD_3D.track * 2 + 2.4),
    new THREE.MeshStandardMaterial({
      color: theme.baseColor,
      roughness: theme.roughness,
      metalness: theme.metalness
    })
  );
  base.position.y = -0.13;
  base.receiveShadow = true;
  group.add(base);

  const center = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD_3D.centerSize, 0.08, BOARD_3D.centerSize),
    new THREE.MeshStandardMaterial({
      color: theme.centerColor,
      roughness: Math.max(0.12, theme.roughness - 0.06),
      metalness: theme.metalness
    })
  );
  center.position.y = 0.04;
  center.receiveShadow = true;
  group.add(center);

  const centerRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.8, 0.045, 12, 96),
    new THREE.MeshStandardMaterial({
      color: theme.accentColor,
      roughness: 0.32,
      metalness: Math.max(0.35, theme.metalness)
    })
  );
  centerRing.rotation.x = Math.PI / 2;
  centerRing.position.y = 0.12;
  group.add(centerRing);

  if (!hideCenterDecks) {
    const chanceObstacle = CARD_DECK_OBSTACLES.find((obstacle) => obstacle.deck === "CASUALIDAD");
    const chestObstacle = CARD_DECK_OBSTACLES.find((obstacle) => obstacle.deck === "ARCA_COMUNAL");
    const chanceDeck = createDeckStack({
      deck: "CASUALIDAD",
      title: "CASUALIDAD",
      mark: "?",
      color: "#f7c948",
      ink: "#7c3f00",
      x: chanceObstacle.x,
      z: chanceObstacle.z,
      rotation: chanceObstacle.rotation
    });
    const chestDeck = createDeckStack({
      deck: "ARCA_COMUNAL",
      title: "ARCA",
      mark: "!",
      color: "#78d4c8",
      ink: "#064e3b",
      x: chestObstacle.x,
      z: chestObstacle.z,
      rotation: chestObstacle.rotation
    });
    cardDecks.set("CASUALIDAD", chanceDeck);
    cardDecks.set("ARCA_COMUNAL", chestDeck);
    group.add(chanceDeck, chestDeck);
  }
  group.add(selectionBillboard);

  board.forEach((space) => {
    const tile = createBoardTile3D(space, players);
    tile.userData.visualSignature = boardTileVisualSignature(space, players);
    group.add(tile);
    tileGroups.set(space.index, tile);
    tile.traverse((object) => {
      if (object.userData.spaceIndex !== undefined) tileMeshes.push(object);
    });
  });

  group.add(playerLayer);
  const model = {
    group,
    tileMeshes,
    interactiveMeshes,
    tileGroups,
    playerLayer,
    playerPieces,
    cardDecks,
    activeCardDeck: null,
    selectionBillboard,
    base,
    center,
    centerRing,
    boardThemeId: theme.id
  };
  syncPlayerPieces(model, players);
  return model;
}

export function syncBoardTheme(model, boardTheme = null) {
  if (!model) return;
  const theme = resolveBoardTheme(boardTheme);
  if (model.boardThemeId === theme.id) return;
  model.boardThemeId = theme.id;
  model.base?.material?.color.set(theme.baseColor);
  if (model.base?.material) {
    model.base.material.roughness = theme.roughness;
    model.base.material.metalness = theme.metalness;
    model.base.material.needsUpdate = true;
  }
  model.center?.material?.color.set(theme.centerColor);
  if (model.center?.material) {
    model.center.material.roughness = Math.max(0.12, theme.roughness - 0.06);
    model.center.material.metalness = theme.metalness;
    model.center.material.needsUpdate = true;
  }
  model.centerRing?.material?.color.set(theme.accentColor);
  if (model.centerRing?.material) {
    model.centerRing.material.metalness = Math.max(0.35, theme.metalness);
    model.centerRing.material.needsUpdate = true;
  }
}

function boardTileVisualSignature(space, players = []) {
  const owner = players.find((player) => player.id === space.ownerId) || null;
  return JSON.stringify({
    id: space.id,
    index: space.index,
    ownerId: space.ownerId || null,
    ownerName: owner?.name || "",
    ownerColor: owner?.color || "",
    houses: Number(space.houses || 0),
    hasHotel: Boolean(space.hasHotel),
    isMortgaged: Boolean(space.isMortgaged),
    price: space.price || 0
  });
}

function collectTileMeshes(tileGroup) {
  const meshes = [];
  tileGroup.traverse((object) => {
    if (object.userData.spaceIndex !== undefined) meshes.push(object);
  });
  return meshes;
}

export function syncBoardTiles(model, board = [], players = []) {
  if (!model) return;

  const liveIndexes = new Set(board.map((space) => space.index));

  for (const [tileIndex, tileGroup] of model.tileGroups.entries()) {
    if (liveIndexes.has(tileIndex)) continue;
    model.group.remove(tileGroup);
    disposeObject3D(tileGroup);
    model.tileGroups.delete(tileIndex);
  }

  board.forEach((space) => {
    const signature = boardTileVisualSignature(space, players);
    const currentTile = model.tileGroups.get(space.index);
    if (currentTile?.userData.visualSignature === signature) return;

    const nextTile = createBoardTile3D(space, players);
    nextTile.userData.visualSignature = signature;

    if (currentTile) {
      model.group.remove(currentTile);
      disposeObject3D(currentTile);
    }

    model.group.add(nextTile);
    model.tileGroups.set(space.index, nextTile);
  });

  model.tileMeshes.length = 0;
  for (const tileGroup of model.tileGroups.values()) {
    model.tileMeshes.push(...collectTileMeshes(tileGroup));
  }
}

function playerPieceVisualSignature(player, index) {
  return [
    player.color || index,
    player.tokenRing || "",
    player.cosmetics?.TOKEN?.id || ""
  ].join("|");
}

export function syncPlayerPieces(model, players = []) {
  const liveIds = new Set(players.map((player) => player.id));

  for (const [playerId, piece] of model.playerPieces) {
    if (!liveIds.has(playerId)) {
      model.playerLayer.remove(piece);
      disposeObject3D(piece);
      model.playerPieces.delete(playerId);
    }
  }

  players.forEach((player, index) => {
    let piece = model.playerPieces.get(player.id);
    const signature = playerPieceVisualSignature(player, index);

    if (piece && piece.userData.visualSignature !== signature) {
      model.playerLayer.remove(piece);
      disposeObject3D(piece);
      model.playerPieces.delete(player.id);
      piece = null;
    }

    if (!piece) {
      piece = createPlayerPiece3D(player, index, players);
      piece.userData.visualSignature = signature;
      model.playerPieces.set(player.id, piece);
      model.playerLayer.add(piece);
    }
    piece.visible = !player.bankrupt;
    setPlayerPieceTarget(piece, player, players);
  });
}

export function setActiveCardDeck(model, deckName = null) {
  model.activeCardDeck = deckName || null;
}

export function syncSelectionBillboard(model, info = null) {
  const billboard = model.selectionBillboard;
  if (!billboard) return;

  if (!info || !Number.isInteger(info.index)) {
    billboard.visible = false;
    billboard.userData.currentKey = "";
    billboard.userData.infoIndex = null;
    billboard.userData.hoverKey = "";
    model.interactiveMeshes = model.interactiveMeshes.filter((mesh) => !mesh.userData.selectionAction && !mesh.userData.selectionPanel);
    return;
  }

  const tileGroup = model.tileGroups.get(info.index);
  if (!tileGroup) {
    billboard.visible = false;
    return;
  }

  if (billboard.userData.infoIndex !== info.index) {
    billboard.userData.infoIndex = info.index;
    billboard.userData.activeTab = "info";
    billboard.userData.hoverKey = "";
    billboard.userData.currentKey = "";
  }

  const key = JSON.stringify({
    ...info,
    activeTab: billboard.userData.activeTab || "info",
    hoverKey: billboard.userData.hoverKey || "",
    actions: (info.actions || []).map((action) => ({ label: action.label, tone: action.tone })),
    rentRows: (info.rentRows || []).map((row) => ({ label: row.label, value: row.value, active: row.active }))
  });
  if (billboard.userData.currentKey !== key || !billboard.userData.panel?.material?.map) {
    const panel = billboard.userData.panel;
    const activeTab = billboard.userData.activeTab || "info";
    const hoverKey = billboard.userData.hoverKey || "";
    const nextTexture = createSelectionCardTexture(info, activeTab, hoverKey);
    if (panel.material.map) panel.material.map.dispose();
    panel.material.map = nextTexture;
    panel.material.color.set("#ffffff");
    panel.material.opacity = 1;
    panel.material.needsUpdate = true;
    billboard.userData.currentKey = key;
    billboard.userData.hitZones = createSelectionCardHitZones(info, activeTab);
  }

  const panel = billboard.userData.panel;
  model.interactiveMeshes = model.interactiveMeshes.filter((mesh) => !mesh.userData.selectionAction);
  if (panel && !model.interactiveMeshes.includes(panel)) {
    model.interactiveMeshes.push(panel);
  }

  billboard.visible = true;
  billboard.position.set(tileGroup.position.x, 0.08, tileGroup.position.z);
  billboard.userData.baseY = tileGroup.position.y || 0;
}

export function resolveSelectionPanelHit(model, intersection) {
  const billboard = model.selectionBillboard;
  if (!billboard?.visible || !intersection?.uv) return null;

  const zones = billboard.userData.hitZones || [];
  const x = intersection.uv.x * SELECTION_CARD_WIDTH;
  const y = (1 - intersection.uv.y) * SELECTION_CARD_HEIGHT;
  return zones.find((zone) => (
    x >= zone.x &&
    x <= zone.x + zone.w &&
    y >= zone.y &&
    y <= zone.y + zone.h
  )) || null;
}

export function setSelectionBillboardTab(model, tab) {
  const billboard = model.selectionBillboard;
  if (!billboard || !["info", "rents"].includes(tab)) return;
  if (billboard.userData.activeTab === tab) return;
  billboard.userData.activeTab = tab;
  billboard.userData.hoverKey = "";
  billboard.userData.currentKey = "";
}

export function setSelectionBillboardHover(model, hoverKey = "") {
  const billboard = model.selectionBillboard;
  if (!billboard || billboard.userData.hoverKey === hoverKey) return;
  billboard.userData.hoverKey = hoverKey;
  billboard.userData.currentKey = "";
}

export function animateBoard3D(model, delta, elapsed, camera = null) {
  for (const piece of model.playerPieces.values()) {
    animatePlayerPiece(piece, delta, elapsed);
  }

  const billboard = model.selectionBillboard;
  if (billboard?.visible) {
    billboard.position.y = (billboard.userData.baseY || 0) + Math.sin(elapsed * 3.2) * 0.035;
    const panel = billboard.userData.panel;
    if (panel && camera) panel.lookAt(camera.position);
    if (billboard.userData.halo) {
      billboard.userData.halo.scale.setScalar(1 + Math.sin(elapsed * 4.8) * 0.06);
      billboard.userData.halo.material.opacity = 0.55 + Math.sin(elapsed * 4.8) * 0.16;
    }
  }

  for (const [deckName, deckGroup] of model.cardDecks.entries()) {
    const active = deckName === model.activeCardDeck;
    const drawCard = deckGroup.userData.drawCard;
    deckGroup.position.y = deckGroup.userData.baseY + Math.sin(elapsed * 1.8 + deckGroup.position.x) * 0.004;
    deckGroup.rotation.z = active ? Math.sin(elapsed * 9) * 0.025 : 0;

    if (!drawCard) continue;
    drawCard.visible = active;
    if (active) {
      const t = (Math.sin(elapsed * 5.2) + 1) / 2;
      drawCard.position.y = 0.2 + t * 0.14;
      drawCard.position.z = -0.12 - t * 0.42;
      drawCard.rotation.x = -0.22 - t * 0.18;
      drawCard.material[2].emissiveIntensity = 0.08 + t * 0.08;
    } else {
      drawCard.position.set(0, 0.17, 0);
      drawCard.rotation.set(0, 0, 0);
      drawCard.material[2].emissiveIntensity = 0.02;
    }
  }
}

export function markSelectedTile(model, selectedIndex, options = {}) {
  const { moverIndex = null, currentIndex = null, destinationIndex = null } = options;

  model.tileGroups.forEach((tileGroup, tileIndex) => {
    const baseMesh = tileGroup.userData.baseMesh;
    const bandMesh = tileGroup.userData.bandMesh;
    const labelMesh = tileGroup.userData.labelMesh;

    const isSelected = tileIndex === selectedIndex;
    const isCurrent = tileIndex === currentIndex;
    const isMover = tileIndex === moverIndex;
    const isDestination = tileIndex === destinationIndex;
    const strength = isDestination ? 0.36 : isMover ? 0.28 : isSelected ? 0.2 : isCurrent ? 0.14 : 0;

    if (baseMesh?.material?.emissive) {
      baseMesh.material.emissive.set(isDestination ? "#f4d45d" : isMover ? "#9adbc5" : isSelected ? "#f5b942" : isCurrent ? "#7cc2eb" : "#000000");
      baseMesh.material.emissiveIntensity = strength;
    }

    if (bandMesh?.material?.emissive) {
      bandMesh.material.emissive.set(isDestination ? "#f4d45d" : isMover ? "#5fd4a1" : "#000000");
      bandMesh.material.emissiveIntensity = isDestination || isMover ? 0.22 : 0;
    }

    if (labelMesh?.material) {
      labelMesh.material.opacity = isSelected || isMover || isDestination ? 1 : 0.92;
    }

    tileGroup.position.y = isDestination ? 0.05 : isMover ? 0.03 : -0.02;
  });
}

export function disposeObject3D(object) {
  object.traverse((child) => {
    child.userData?.dispose?.();
    if (child.geometry && !child.geometry.userData?.shared) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material.map && !material.map.userData?.shared) material.map.dispose();
        if (!material.userData?.shared) material.dispose();
      });
    }
  });
}
