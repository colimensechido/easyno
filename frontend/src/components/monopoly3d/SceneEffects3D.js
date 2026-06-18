import * as THREE from "three";
import { boardPositionForIndex } from "./board3dUtils";

const labelTextureCache = new Map();
const burstGeometry = new THREE.PlaneGeometry(1, 1);
burstGeometry.userData.shared = true;

function burstPalette(tone = "gain") {
  return tone === "loss"
    ? {
        text: "#fff2f2",
        accent: "#ff5353",
        outline: "rgba(255,120,120,0.96)",
        background: "rgba(32,5,7,0.88)",
        shadow: "rgba(12,0,0,0.52)"
      }
    : {
        text: "#f2fff6",
        accent: "#39d979",
        outline: "rgba(109,255,169,0.94)",
        background: "rgba(4,26,14,0.88)",
        shadow: "rgba(0,10,4,0.5)"
      };
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function createLabelTexture(label, tone) {
  const cacheKey = `${tone}:${label}`;
  if (labelTextureCache.has(cacheKey)) {
    return labelTextureCache.get(cacheKey);
  }

  const palette = burstPalette(tone);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext("2d");

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";

  context.shadowColor = palette.shadow;
  context.shadowBlur = 26;
  context.fillStyle = palette.background;
  roundedRect(context, 44, 34, 424, 124, 34);
  context.fill();

  context.shadowBlur = 0;
  context.lineWidth = 7;
  context.strokeStyle = palette.outline;
  roundedRect(context, 44, 34, 424, 124, 34);
  context.stroke();

  context.fillStyle = palette.accent;
  roundedRect(context, 58, 54, 18, 84, 9);
  context.fill();

  context.lineWidth = 8;
  context.strokeStyle = palette.outline;
  context.shadowColor = palette.shadow;
  context.shadowBlur = 18;
  context.fillStyle = palette.text;
  context.font = "900 80px Inter, Arial, sans-serif";
  context.strokeText(label || "", 256, 98);
  context.fillText(label || "", 256, 98);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.userData.shared = true;
  labelTextureCache.set(cacheKey, texture);
  return texture;
}

function resolveAnchorPosition(burst, playerPieces) {
  if (burst.playerId && playerPieces?.has(burst.playerId)) {
    const piece = playerPieces.get(burst.playerId);
    return new THREE.Vector3(piece.position.x, piece.position.y + 0.84, piece.position.z);
  }

  const base = boardPositionForIndex(burst.spaceIndex || 0, 0.92);
  return new THREE.Vector3(base.x, base.y, base.z);
}

function createMoneyBurstGroup(burst, playerPieces) {
  const group = new THREE.Group();
  const anchor = resolveAnchorPosition(burst, playerPieces);
  const laneOffset = (burst.slot || 0) * 0.42;
  group.position.copy(anchor);
  group.position.x += burst.tone === "loss" ? -0.18 - laneOffset : 0.18 + laneOffset;
  group.position.z += burst.tone === "loss" ? 0.1 + laneOffset * 0.35 : -0.1 - laneOffset * 0.35;

  const labelMaterial = new THREE.MeshBasicMaterial({
    map: createLabelTexture(burst.label, burst.tone),
    transparent: true,
    depthWrite: false,
    depthTest: false
  });
  const label = new THREE.Mesh(burstGeometry, labelMaterial);
  label.renderOrder = 12;
  label.scale.set(1.5, 0.56, 1);
  group.add(label);

  group.userData.burstId = burst.id;
  group.userData.burst = burst;
  group.userData.label = label;
  group.userData.life = 0;
  group.userData.maxLife = 2.45;
  group.userData.anchor = anchor.clone();
  group.userData.seed = Math.random() * Math.PI * 2;
  return group;
}

export function createSceneEffects3D() {
  const layer = new THREE.Group();
  const moneyBursts = new Map();
  return { layer, moneyBursts };
}

export function syncMoneyBursts3D(effects, bursts = [], playerPieces = null) {
  const visibleIds = new Set(bursts.map((burst) => burst.id));

  bursts.forEach((burst) => {
    if (effects.moneyBursts.has(burst.id)) return;
    const group = createMoneyBurstGroup(burst, playerPieces);
    effects.moneyBursts.set(burst.id, group);
    effects.layer.add(group);
  });

  for (const [burstId, group] of effects.moneyBursts.entries()) {
    if (visibleIds.has(burstId)) continue;
    effects.layer.remove(group);
    group.traverse((child) => {
      if (child.material?.map && !child.material.map.userData?.shared) {
        child.material.map.dispose();
      }
      if (child.material) child.material.dispose();
    });
    effects.moneyBursts.delete(burstId);
  }
}

export function animateSceneEffects3D(effects, delta, elapsed, playerPieces = null, camera = null) {
  for (const group of effects.moneyBursts.values()) {
    const burst = group.userData.burst;
    const nextAnchor = resolveAnchorPosition(burst, playerPieces);
    group.userData.anchor.lerp(nextAnchor, Math.min(1, delta * 5.5));
    group.userData.life += delta;
    const t = Math.min(1, group.userData.life / group.userData.maxLife);
    const easeOut = 1 - (1 - t) * (1 - t);
    const pop = Math.sin(Math.min(1, t * 0.8) * Math.PI);
    const laneOffset = (burst.slot || 0) * 0.44;
    const driftX = (burst.tone === "loss" ? -0.1 : 0.1) + Math.sin(elapsed * 0.7 + group.userData.seed) * 0.008;
    const driftZ = (burst.tone === "loss" ? 0.04 : -0.04) + Math.cos(elapsed * 0.65 + group.userData.seed) * 0.008;

    group.position.set(
      group.userData.anchor.x + driftX + laneOffset * (burst.tone === "loss" ? -0.5 : 0.5),
      group.userData.anchor.y + easeOut * 0.46 + pop * 0.018,
      group.userData.anchor.z + driftZ
    );

    const label = group.userData.label;
    const alpha = t < 0.08 ? t / 0.08 : 1 - Math.max(0, (t - 0.72) / 0.28);
    const labelScale = 1 + pop * 0.025;
    label.material.opacity = alpha;
    label.scale.set(1.5 * labelScale, 0.56 * labelScale, 1);

    if (camera) {
      group.lookAt(camera.position);
    }
  }
}
