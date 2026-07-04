import * as THREE from "three";
import { BOARD_3D, CARD_DECK_OBSTACLES } from "./board3dUtils";

const FACE_ROTATIONS = {
  // BoxGeometry material order is +X, -X, +Y, -Y, +Z, -Z.
  // Rotate the requested material face so its normal points upward.
  1: new THREE.Euler(0, 0, Math.PI / 2),
  2: new THREE.Euler(0, 0, -Math.PI / 2),
  3: new THREE.Euler(0, 0, 0),
  4: new THREE.Euler(Math.PI, 0, 0),
  5: new THREE.Euler(-Math.PI / 2, 0, 0),
  6: new THREE.Euler(Math.PI / 2, 0, 0)
};

const dieGeometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
dieGeometry.userData.shared = true;
const glowGeometry = new THREE.RingGeometry(1.15, 1.65, 48);
glowGeometry.userData.shared = true;
const faceTextureCache = new Map();
const materialCache = new Map();
const DIE_RADIUS = 0.48;
const DIE_FLOOR_Y = 0.55;
const DRAG_HEIGHT = 1.45;
const TABLE_LIMIT = BOARD_3D.centerSize / 2 - DIE_RADIUS - 0.12;
const GRAVITY = 18;
const PHYSICS_STEP_SECONDS = 1 / 120;
const MAX_PHYSICS_STEPS_PER_FRAME = 6;
const MAX_PHYSICS_DURATION_SECONDS = 4.2;
const RESULT_SETTLE_AIR_HEIGHT = 0.28;
const RESULT_SETTLE_ALIGNMENT_DISTANCE = 0.00008;
const RESULT_STAGES = new Set(["diceResult", "highlightDestination", "tokenMoving", "settle"]);

function pipLayout(value) {
  const p = 0.24;
  switch (value) {
    case 1: return [[0, 0]];
    case 2: return [[-p, -p], [p, p]];
    case 3: return [[-p, -p], [0, 0], [p, p]];
    case 4: return [[-p, -p], [p, -p], [-p, p], [p, p]];
    case 5: return [[-p, -p], [p, -p], [0, 0], [-p, p], [p, p]];
    default: return [[-p, -p], [p, -p], [-p, 0], [p, 0], [-p, p], [p, p]];
  }
}

function safeColor(value, fallback) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function normalizedNumber(value, fallback, min, max) {
  return THREE.MathUtils.clamp(safeNumber(value, fallback), min, max);
}

function deterministicNoise(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function drawStarPath(context, x, y, outerRadius, innerRadius = outerRadius * 0.48, points = 5) {
  context.beginPath();
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (index * Math.PI) / points;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
}

function drawPip(context, x, y, shape, radius) {
  context.beginPath();
  if (shape === "square") {
    context.rect(x - radius, y - radius, radius * 2, radius * 2);
    context.fill();
    return;
  }
  if (shape === "diamond") {
    context.moveTo(x, y - radius * 1.2);
    context.lineTo(x + radius * 1.2, y);
    context.lineTo(x, y + radius * 1.2);
    context.lineTo(x - radius * 1.2, y);
    context.closePath();
    context.fill();
    return;
  }
  if (shape === "ring") {
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.lineWidth = Math.max(4, radius * 0.34);
    context.stroke();
    return;
  }
  if (shape === "star") {
    drawStarPath(context, x, y, radius * 1.25, radius * 0.54, 5);
    context.fill();
    return;
  }
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function paintDicePattern(context, value, metadata) {
  const baseColor = safeColor(metadata.baseColor, "#fffdf6");
  const accentColor = safeColor(metadata.accentColor, baseColor);
  const pattern = metadata.pattern || "solid";
  const contrast = normalizedNumber(metadata.faceContrast, 0.35, 0, 1);

  if (pattern === "radial") {
    const gradient = context.createRadialGradient(128, 110, 18, 128, 128, 170);
    gradient.addColorStop(0, accentColor);
    gradient.addColorStop(0.52, baseColor);
    gradient.addColorStop(1, baseColor);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    return;
  }

  context.fillStyle = baseColor;
  context.fillRect(0, 0, 256, 256);

  if (pattern === "split") {
    context.globalAlpha = 0.82;
    context.fillStyle = accentColor;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(256, 0);
    context.lineTo(0, 256);
    context.closePath();
    context.fill();
    context.globalAlpha = 1;
  } else if (pattern === "stripes" || pattern === "danger") {
    context.save();
    context.translate(128, 128);
    context.rotate(pattern === "danger" ? -Math.PI / 4 : Math.PI / 5);
    context.globalAlpha = pattern === "danger" ? 0.86 : 0.22 + contrast * 0.5;
    context.fillStyle = accentColor;
    for (let offset = -260; offset <= 260; offset += pattern === "danger" ? 42 : 32) {
      context.fillRect(offset, -220, pattern === "danger" ? 20 : 12, 440);
    }
    context.restore();
    context.globalAlpha = 1;
  } else if (pattern === "checker") {
    context.globalAlpha = 0.22 + contrast * 0.45;
    context.fillStyle = accentColor;
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        if ((x + y + value) % 2 === 0) context.fillRect(x * 32, y * 32, 32, 32);
      }
    }
    context.globalAlpha = 1;
  } else if (pattern === "speckles") {
    context.globalAlpha = 0.18 + contrast * 0.38;
    context.fillStyle = accentColor;
    for (let index = 0; index < 96; index += 1) {
      const x = 18 + deterministicNoise(value * 40 + index) * 220;
      const y = 18 + deterministicNoise(value * 70 + index * 1.7) * 220;
      const radius = 1.4 + deterministicNoise(index * 3.1) * 4.8;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  } else if (pattern === "circuit") {
    context.globalAlpha = 0.5 + contrast * 0.38;
    context.strokeStyle = accentColor;
    context.lineWidth = 3;
    for (let index = 0; index < 8; index += 1) {
      const x = 24 + index * 30;
      context.beginPath();
      context.moveTo(x, 20);
      context.lineTo(x, 62 + (index % 3) * 28);
      context.lineTo(222 - index * 18, 62 + (index % 3) * 28);
      context.stroke();
      context.beginPath();
      context.arc(222 - index * 18, 62 + (index % 3) * 28, 5, 0, Math.PI * 2);
      context.stroke();
    }
    context.globalAlpha = 1;
  } else if (pattern === "stars") {
    context.globalAlpha = 0.26 + contrast * 0.5;
    context.fillStyle = accentColor;
    for (let index = 0; index < 28; index += 1) {
      const x = 22 + deterministicNoise(value * 9 + index * 2.3) * 212;
      const y = 22 + deterministicNoise(value * 13 + index * 3.7) * 212;
      drawStarPath(context, x, y, 3 + deterministicNoise(index) * 5, 1.6 + deterministicNoise(index + 7) * 2.4, 5);
      context.fill();
    }
    context.globalAlpha = 1;
  } else if (pattern === "marble") {
    context.globalAlpha = 0.2 + contrast * 0.36;
    context.strokeStyle = accentColor;
    context.lineWidth = 7;
    for (let row = 0; row < 8; row += 1) {
      context.beginPath();
      for (let x = -10; x <= 266; x += 14) {
        const y = 25 + row * 28 + Math.sin(x * 0.035 + row + value) * 12;
        if (x === -10) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    }
    context.globalAlpha = 1;
  }
}

function diceSkinSignature(skin) {
  const metadata = skin?.metadata || {};
  return [
    skin?.id || "default",
    metadata.baseColor || "",
    metadata.pipColor || "",
    metadata.accentColor || "",
    metadata.edgeColor || "",
    metadata.pattern || "",
    metadata.pipShape || "",
    metadata.pipScale ?? "",
    metadata.faceContrast ?? "",
    metadata.roughness ?? "",
    metadata.metalness ?? "",
    metadata.opacity ?? ""
  ].join(":");
}

function diceFxSignature(fx) {
  const metadata = fx?.metadata || {};
  return [
    fx?.id || "",
    metadata.effect || "",
    metadata.color || "",
    metadata.secondaryColor || "",
    metadata.intensity ?? "",
    metadata.speed ?? "",
    metadata.spread ?? "",
    metadata.particleSize ?? "",
    metadata.ringScale ?? "",
    metadata.beamJitter ?? "",
    metadata.gravity ?? "",
    metadata.sparkle ?? "",
    metadata.density ?? ""
  ].join(":");
}

function makeFaceTexture(value, skin = null) {
  const metadata = skin?.metadata || {};
  const baseColor = safeColor(metadata.baseColor, "#fffdf6");
  const pipColor = safeColor(metadata.pipColor, "#3f2b17");
  const edgeColor = safeColor(metadata.edgeColor, "#d8c39a");
  const pipShape = metadata.pipShape || "dot";
  const pipScale = normalizedNumber(metadata.pipScale, 1, 0.45, 1.9);
  const cacheKey = [
    value,
    baseColor,
    pipColor,
    safeColor(metadata.accentColor, baseColor),
    edgeColor,
    metadata.pattern || "solid",
    pipShape,
    pipScale,
    metadata.faceContrast ?? ""
  ].join(":");
  if (faceTextureCache.has(cacheKey)) {
    return faceTextureCache.get(cacheKey);
  }

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  paintDicePattern(context, value, metadata);
  context.strokeStyle = edgeColor;
  context.lineWidth = 10;
  context.strokeRect(8, 8, 240, 240);
  context.fillStyle = pipColor;
  context.strokeStyle = pipColor;

  pipLayout(value).forEach(([x, y]) => {
    drawPip(context, 128 + x * 150, 128 + y * 150, pipShape, 20 * pipScale);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.userData.shared = true;
  faceTextureCache.set(cacheKey, texture);
  return texture;
}

function materialForFace(value, skin = null) {
  const metadata = skin?.metadata || {};
  const cacheKey = [
    value,
    diceSkinSignature(skin),
    metadata.roughness ?? "",
    metadata.metalness ?? "",
    metadata.opacity ?? ""
  ].join(":");
  if (materialCache.has(cacheKey)) {
    return materialCache.get(cacheKey);
  }

  const material = new THREE.MeshStandardMaterial({
    map: makeFaceTexture(value, skin),
    roughness: Number.isFinite(Number(metadata.roughness)) ? Number(metadata.roughness) : 0.34,
    metalness: Number.isFinite(Number(metadata.metalness)) ? Number(metadata.metalness) : 0.04,
    opacity: Number.isFinite(Number(metadata.opacity)) ? Number(metadata.opacity) : 1,
    transparent: Boolean(metadata.transparent) || Number(metadata.opacity) < 1
  });
  material.userData.shared = true;
  materialCache.set(cacheKey, material);
  return material;
}

function normalizeFaceValue(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 6 ? number : 1;
}

function diceResultKey(diceFaces = []) {
  return [normalizeFaceValue(diceFaces[0]), normalizeFaceValue(diceFaces[1])].join(":");
}

function quaternionDistanceToTarget(die) {
  return 1 - Math.abs(die.quaternion.dot(die.userData.targetQuaternion));
}

function settlePhysicalDieTowardResult(die, delta) {
  const velocity = die.userData.velocity;
  const angularVelocity = die.userData.angularVelocity;
  const heightAboveFloor = Math.max(0, die.position.y - DIE_FLOOR_Y);
  const floorProximity = THREE.MathUtils.clamp(1 - heightAboveFloor / RESULT_SETTLE_AIR_HEIGHT, 0, 1);
  if (floorProximity <= 0) return;

  const linearSpeed = velocity.length();
  const spinSpeed = angularVelocity.length();
  const calm = THREE.MathUtils.clamp(1 - (linearSpeed + spinSpeed * 0.12 - 0.35) / 2.4, 0, 1);
  if (calm <= 0) return;

  const settleRate = 3.2 + calm * 10.5;
  const alpha = 1 - Math.exp(-settleRate * floorProximity * calm * delta);
  die.quaternion.slerp(die.userData.targetQuaternion, alpha);
}

function finishResultSettling(group) {
  group.userData.dice.forEach((die) => {
    die.position.y = DIE_FLOOR_Y;
    die.quaternion.copy(die.userData.targetQuaternion);
    die.userData.velocity.set(0, 0, 0);
    die.userData.angularVelocity.set(0, 0, 0);
    die.userData.physicsActive = false;
    die.userData.sleeping = true;
  });
  stabilizeRestingDice(group);
  group.userData.physicsActive = false;
  group.userData.resultSettling = false;
}

function createDie() {
  const mesh = new THREE.Mesh(
    dieGeometry,
    Array.from({ length: 6 }, (_, index) => materialForFace(index + 1))
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.targetQuaternion = new THREE.Quaternion();
  mesh.userData.velocity = new THREE.Vector3();
  mesh.userData.angularVelocity = new THREE.Vector3();
  mesh.userData.remotePosition = new THREE.Vector3();
  mesh.userData.remoteQuaternion = new THREE.Quaternion();
  mesh.userData.remoteInitialized = false;
  mesh.userData.physicsActive = false;
  mesh.userData.sleeping = true;
  return mesh;
}

export function createDice3D() {
  const group = new THREE.Group();
  group.position.set(0, 0, 0);

  const glow = new THREE.Mesh(
    glowGeometry,
    new THREE.MeshBasicMaterial({
      color: "#f4d45d",
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    })
  );
  glow.material.userData.shared = true;
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.13;
  group.add(glow);

  const left = createDie();
  left.position.set(-0.72, DIE_FLOOR_Y, 0.08);
  left.userData.home = left.position.clone();
  group.add(left);

  const right = createDie();
  right.position.set(0.72, DIE_FLOOR_Y, -0.08);
  right.userData.home = right.position.clone();
  group.add(right);

  group.userData.glow = glow;
  group.userData.dice = [left, right];
  group.userData.rollingDice = false;
  group.userData.cinematicPhase = null;
  group.userData.visualStage = "idle";
  group.userData.heat = 0;
  group.userData.idleLift = 0;
  group.userData.rollEnergy = 0;
  group.userData.drag = {
    active: false,
    target: new THREE.Vector3(),
    samples: [],
    offsets: [new THREE.Vector3(-0.72, 0, 0.08), new THREE.Vector3(0.72, 0, -0.08)]
  };
  group.userData.physicsActive = false;
  group.userData.physicsAccumulator = 0;
  group.userData.physicsElapsed = 0;
  group.userData.landed = false;
  group.userData.remoteMotionActive = false;
  group.userData.remoteMotionSettled = false;
  group.userData.remoteResultLocked = false;
  group.userData.resultKey = diceResultKey([1, 1]);
  group.userData.resultSettling = false;
  group.userData.skinId = "default";
  const fxGeometry = new THREE.BufferGeometry();
  const fxPositions = new Float32Array(72 * 3);
  fxGeometry.setAttribute("position", new THREE.BufferAttribute(fxPositions, 3));
  const fxMaterial = new THREE.PointsMaterial({
    color: "#fbbf24",
    size: 0.075,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const fxPoints = new THREE.Points(fxGeometry, fxMaterial);
  fxPoints.visible = false;
  group.add(fxPoints);
  group.userData.fxPoints = fxPoints;
  const fxRings = new THREE.Group();
  for (let index = 0; index < 3; index += 1) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.52, 0.58, 48),
      new THREE.MeshBasicMaterial({
        color: "#fbbf24",
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    fxRings.add(ring);
  }
  group.add(fxRings);
  group.userData.fxRings = fxRings;
  const beamGeometry = new THREE.BufferGeometry();
  beamGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(14 * 3), 3));
  const fxBeam = new THREE.Line(
    beamGeometry,
    new THREE.LineBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  fxBeam.visible = false;
  group.add(fxBeam);
  group.userData.fxBeam = fxBeam;
  const fxLight = new THREE.PointLight("#fbbf24", 0, 5, 2);
  fxLight.position.y = 1;
  group.add(fxLight);
  group.userData.fxLight = fxLight;
  group.userData.fxId = "";
  group.userData.fxMetadata = null;
  group.visible = true;
  return group;
}

function clampToTable(value) {
  return THREE.MathUtils.clamp(value, -TABLE_LIMIT, TABLE_LIMIT);
}

function vectorPayload(vector) {
  return { x: vector.x, y: vector.y, z: vector.z };
}

function diePayload(die) {
  return {
    position: vectorPayload(die.position),
    quaternion: {
      x: die.quaternion.x,
      y: die.quaternion.y,
      z: die.quaternion.z,
      w: die.quaternion.w
    },
    velocity: vectorPayload(die.userData.velocity),
    angularVelocity: vectorPayload(die.userData.angularVelocity),
    sleeping: Boolean(die.userData.sleeping)
  };
}

export function captureDiceMotion(group, phase = "state") {
  if (!group?.userData?.dice) return null;
  return {
    phase,
    active: Boolean(group.userData.physicsActive),
    dice: group.userData.dice.map(diePayload)
  };
}

function pushDragSample(group, point, time) {
  const samples = group.userData.drag.samples;
  samples.push({ point: point.clone(), time });
  while (samples.length > 6 || (samples.length > 1 && time - samples[0].time > 140)) {
    samples.shift();
  }
}

export function beginDiceDrag(group, point, time = performance.now()) {
  const drag = group.userData.drag;
  group.userData.remoteMotionActive = false;
  group.userData.remoteMotionSettled = false;
  group.userData.remoteResultLocked = false;
  group.userData.resultSettling = false;
  drag.active = true;
  drag.target.set(clampToTable(point.x), DRAG_HEIGHT, clampToTable(point.z));
  drag.samples = [];
  pushDragSample(group, drag.target, time);
  group.userData.physicsActive = false;
  group.userData.physicsAccumulator = 0;
  group.userData.physicsElapsed = 0;
  group.userData.dice.forEach((die) => {
    die.userData.physicsActive = false;
    die.userData.sleeping = false;
    die.userData.velocity.set(0, 0, 0);
    die.userData.angularVelocity.set(0, 0, 0);
  });
  return {
    phase: "grab",
    point: vectorPayload(drag.target)
  };
}

export function updateDiceDrag(group, point, time = performance.now()) {
  const drag = group.userData.drag;
  if (!drag.active) return null;
  drag.target.set(clampToTable(point.x), DRAG_HEIGHT, clampToTable(point.z));
  pushDragSample(group, drag.target, time);
  return {
    phase: "move",
    point: vectorPayload(drag.target)
  };
}

export function cancelDiceDrag(group) {
  group.userData.drag.active = false;
  group.userData.physicsActive = false;
  group.userData.physicsAccumulator = 0;
  group.userData.physicsElapsed = 0;
  group.userData.dice.forEach((die) => {
    die.userData.physicsActive = false;
    die.userData.sleeping = true;
    die.userData.velocity.set(0, 0, 0);
    die.userData.angularVelocity.set(0, 0, 0);
  });
  return { phase: "cancel" };
}

export function releaseDiceDrag(group, time = performance.now()) {
  const drag = group.userData.drag;
  if (!drag.active) return null;

  pushDragSample(group, drag.target, time);
  const first = drag.samples[0];
  const last = drag.samples[drag.samples.length - 1];
  const elapsed = Math.max(0.035, ((last?.time || time) - (first?.time || time - 35)) / 1000);
  const gestureVelocity = last && first
    ? last.point.clone().sub(first.point).divideScalar(elapsed)
    : new THREE.Vector3();
  const horizontalSpeed = Math.hypot(gestureVelocity.x, gestureVelocity.z);

  if (horizontalSpeed < 1.2) {
    gestureVelocity.set(2.8, 0, -2.3);
  } else {
    gestureVelocity.multiplyScalar(1.25);
  }
  gestureVelocity.x = THREE.MathUtils.clamp(gestureVelocity.x, -11, 11);
  gestureVelocity.z = THREE.MathUtils.clamp(gestureVelocity.z, -11, 11);

  drag.active = false;
  group.userData.physicsActive = true;
  group.userData.physicsAccumulator = 0;
  group.userData.physicsElapsed = 0;
  group.userData.landed = true;
  group.userData.dice.forEach((die, index) => {
    const side = index === 0 ? -1 : 1;
    die.userData.physicsActive = true;
    die.userData.sleeping = false;
    die.userData.velocity.set(
      gestureVelocity.x + side * 0.85,
      4.2 + Math.min(2.8, horizontalSpeed * 0.18) + index * 0.35,
      gestureVelocity.z - side * 0.65
    );
    die.userData.angularVelocity.set(
      7.5 + Math.abs(gestureVelocity.z) * 0.45 + index,
      5.5 + Math.abs(gestureVelocity.x) * 0.35,
      (side * 7.2) + gestureVelocity.x * 0.25
    );
  });
  return {
    phase: "release",
    active: true,
    dice: group.userData.dice.map(diePayload)
  };
}

export function isDiceDragging(group) {
  return Boolean(group?.userData?.drag?.active);
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function applyVector(target, payload, fallbackY = 0) {
  target.set(
    safeNumber(payload?.x),
    safeNumber(payload?.y, fallbackY),
    safeNumber(payload?.z)
  );
}

export function applyRemoteDiceMotion(group, motion, time = performance.now()) {
  if (!group || !motion) return;

  if (motion.phase === "grab" || motion.phase === "move") {
    const point = new THREE.Vector3(
      safeNumber(motion.point?.x),
      DRAG_HEIGHT,
      safeNumber(motion.point?.z)
    );
    if (motion.phase === "grab" || !group.userData.drag.active) {
      beginDiceDrag(group, point, time);
    } else {
      updateDiceDrag(group, point, time);
    }
    group.userData.remoteMotionActive = true;
    group.userData.remoteMotionSettled = false;
    return;
  }

  if (motion.phase === "cancel") {
    group.userData.remoteMotionActive = false;
    group.userData.remoteMotionSettled = false;
    group.userData.remoteResultLocked = false;
    cancelDiceDrag(group);
    return;
  }

  if (!["release", "state", "settled"].includes(motion.phase) || !Array.isArray(motion.dice)) return;

  group.userData.drag.active = false;
  const settled = motion.phase === "settled";
  if (motion.phase === "release") {
    group.userData.remoteResultLocked = false;
  }
  group.userData.remoteMotionActive = true;
  group.userData.remoteMotionSettled = settled;
  // Remote clients are render-only for dice physics. Re-simulating between
  // snapshots makes collisions diverge immediately under latency or jitter.
  group.userData.physicsActive = false;
  group.userData.physicsAccumulator = 0;
  group.userData.physicsElapsed = 0;
  group.userData.landed = true;
  group.userData.dice.forEach((die, index) => {
    const state = motion.dice[index];
    if (!state) return;
    applyVector(die.userData.remotePosition, state.position, DIE_FLOOR_Y);
    die.userData.remotePosition.x = clampToTable(die.userData.remotePosition.x);
    die.userData.remotePosition.z = clampToTable(die.userData.remotePosition.z);
    die.userData.remotePosition.y = Math.max(DIE_FLOOR_Y, die.userData.remotePosition.y);
    if (settled) {
      die.userData.remotePosition.y = DIE_FLOOR_Y;
    }
    die.userData.remoteQuaternion.set(
      safeNumber(state.quaternion?.x),
      safeNumber(state.quaternion?.y),
      safeNumber(state.quaternion?.z),
      safeNumber(state.quaternion?.w, 1)
    ).normalize();
    if (!die.userData.remoteInitialized) {
      die.position.copy(die.userData.remotePosition);
      die.quaternion.copy(die.userData.remoteQuaternion);
      die.userData.remoteInitialized = true;
    }
    applyVector(die.userData.velocity, state.velocity);
    applyVector(die.userData.angularVelocity, state.angularVelocity);
    die.userData.physicsActive = false;
    die.userData.sleeping = settled || Boolean(state.sleeping);
    if (die.userData.sleeping) {
      die.userData.velocity.set(0, 0, 0);
      die.userData.angularVelocity.set(0, 0, 0);
    }
  });
}

export function syncDice3D(group, {
  diceFaces = [1, 1],
  rollingDice = false,
  cinematicPhase = null,
  visualStage = "idle",
  diceSkin = null,
  diceFx = null
}) {
  group.userData.rollingDice = rollingDice;
  group.userData.cinematicPhase = cinematicPhase;
  group.userData.visualStage = visualStage;
  const nextSkinId = diceSkin ? diceSkinSignature(diceSkin) : "default";
  if (group.userData.skinId !== nextSkinId) {
    group.userData.skinId = nextSkinId;
    group.userData.dice.forEach((die) => {
      die.material = Array.from({ length: 6 }, (_, index) => materialForFace(index + 1, diceSkin));
    });
  }
  const nextFxId = diceFx ? diceFxSignature(diceFx) : "";
  if (group.userData.fxId !== nextFxId) {
    group.userData.fxId = nextFxId;
    group.userData.fxMetadata = diceFx?.metadata || null;
    if (group.userData.fxPoints) {
      group.userData.fxPoints.material.color.set(group.userData.fxMetadata?.color || "#fbbf24");
    }
    group.userData.fxRings?.children.forEach((ring) => {
      ring.material.color.set(group.userData.fxMetadata?.color || "#fbbf24");
    });
    group.userData.fxBeam?.material.color.set(group.userData.fxMetadata?.secondaryColor || "#ffffff");
    group.userData.fxLight?.color.set(group.userData.fxMetadata?.color || "#fbbf24");
  }
  if (
    group.userData.remoteMotionActive &&
    RESULT_STAGES.has(visualStage)
  ) {
    group.userData.remoteResultLocked = true;
  }
  const nextResultKey = diceResultKey(diceFaces);
  if (group.userData.resultKey !== nextResultKey) {
    group.userData.resultKey = nextResultKey;
    group.userData.resultSettling = true;
    if (group.userData.remoteMotionActive) {
      group.userData.remoteResultLocked = true;
    }
  }
  group.userData.dice.forEach((die, index) => {
    const target = FACE_ROTATIONS[normalizeFaceValue(diceFaces[index])] || FACE_ROTATIONS[1];
    die.userData.targetQuaternion.setFromEuler(target);
  });
}

function animateDraggedDice(group, delta, elapsed) {
  const drag = group.userData.drag;
  group.userData.dice.forEach((die, index) => {
    const offset = drag.offsets[index];
    const targetX = clampToTable(drag.target.x + offset.x);
    const targetZ = clampToTable(drag.target.z + offset.z);
    const follow = Math.min(1, delta * 18);
    die.position.x = THREE.MathUtils.lerp(die.position.x, targetX, follow);
    die.position.y = THREE.MathUtils.lerp(die.position.y, DRAG_HEIGHT + Math.sin(elapsed * 5 + index) * 0.08, follow);
    die.position.z = THREE.MathUtils.lerp(die.position.z, targetZ, follow);
    die.rotation.x += delta * (1.5 + index * 0.4);
    die.rotation.z += delta * (1.2 - index * 0.3);
  });
}

function resolveDieCollision(left, right) {
  const offsetX = right.position.x - left.position.x;
  const offsetZ = right.position.z - left.position.z;
  const horizontalDistance = Math.hypot(offsetX, offsetZ);
  const verticalDistance = Math.abs(right.position.y - left.position.y);
  const minimumDistance = DIE_RADIUS * 2;

  if (horizontalDistance >= minimumDistance || verticalDistance >= minimumDistance) return;

  let normalX;
  let normalZ;
  if (horizontalDistance > 0.001) {
    normalX = offsetX / horizontalDistance;
    normalZ = offsetZ / horizontalDistance;
  } else {
    const relativeX = right.userData.velocity.x - left.userData.velocity.x;
    const relativeZ = right.userData.velocity.z - left.userData.velocity.z;
    const relativeLength = Math.hypot(relativeX, relativeZ);
    normalX = relativeLength > 0.001 ? relativeX / relativeLength : 1;
    normalZ = relativeLength > 0.001 ? relativeZ / relativeLength : 0;
  }

  // Always eject sideways so one die can never settle on top of the other.
  const penetration = minimumDistance - horizontalDistance + 0.018;
  left.position.x -= normalX * penetration * 0.5;
  left.position.z -= normalZ * penetration * 0.5;
  right.position.x += normalX * penetration * 0.5;
  right.position.z += normalZ * penetration * 0.5;
  left.position.x = clampToTable(left.position.x);
  left.position.z = clampToTable(left.position.z);
  right.position.x = clampToTable(right.position.x);
  right.position.z = clampToTable(right.position.z);

  const relativeNormalSpeed =
    (right.userData.velocity.x - left.userData.velocity.x) * normalX +
    (right.userData.velocity.z - left.userData.velocity.z) * normalZ;
  const impactSpeed = Math.abs(relativeNormalSpeed);

  if (relativeNormalSpeed < -0.05) {
    const impulse = -(1 + 0.68) * relativeNormalSpeed * 0.5;
    left.userData.velocity.x -= impulse * normalX;
    left.userData.velocity.z -= impulse * normalZ;
    right.userData.velocity.x += impulse * normalX;
    right.userData.velocity.z += impulse * normalZ;
    const bounceLift = Math.min(1.7, 0.55 + impactSpeed * 0.12);
    left.userData.velocity.y = Math.max(left.userData.velocity.y, bounceLift);
    right.userData.velocity.y = Math.max(right.userData.velocity.y, bounceLift);
    left.userData.angularVelocity.x += normalZ * 2.2;
    left.userData.angularVelocity.z -= normalX * 2.2;
    right.userData.angularVelocity.x -= normalZ * 2.2;
    right.userData.angularVelocity.z += normalX * 2.2;
    left.userData.physicsActive = true;
    right.userData.physicsActive = true;
    left.userData.sleeping = false;
    right.userData.sleeping = false;
  }
}

function resolveDeckCollision(die, obstacle) {
  if (die.position.y - DIE_RADIUS > obstacle.topY + 0.08) return;

  const cos = Math.cos(obstacle.rotation);
  const sin = Math.sin(obstacle.rotation);
  const offsetX = die.position.x - obstacle.x;
  const offsetZ = die.position.z - obstacle.z;
  const localX = cos * offsetX + sin * offsetZ;
  const localZ = -sin * offsetX + cos * offsetZ;
  const limitX = obstacle.width * 0.5 + DIE_RADIUS;
  const limitZ = obstacle.depth * 0.5 + DIE_RADIUS;

  if (Math.abs(localX) >= limitX || Math.abs(localZ) >= limitZ) return;

  const penetrationX = limitX - Math.abs(localX);
  const penetrationZ = limitZ - Math.abs(localZ);
  let normalLocalX = 0;
  let normalLocalZ = 0;

  if (penetrationX < penetrationZ) {
    normalLocalX = localX < 0 ? -1 : 1;
  } else {
    normalLocalZ = localZ < 0 ? -1 : 1;
  }

  const normalX = cos * normalLocalX - sin * normalLocalZ;
  const normalZ = sin * normalLocalX + cos * normalLocalZ;
  const penetration = Math.min(penetrationX, penetrationZ) + 0.015;
  die.position.x += normalX * penetration;
  die.position.z += normalZ * penetration;

  const velocity = die.userData.velocity;
  const incomingSpeed = velocity.x * normalX + velocity.z * normalZ;
  if (incomingSpeed < 0) {
    velocity.x -= 1.62 * incomingSpeed * normalX;
    velocity.z -= 1.62 * incomingSpeed * normalZ;
  } else if (Math.hypot(velocity.x, velocity.z) < 0.35) {
    velocity.x += normalX * 1.4;
    velocity.z += normalZ * 1.4;
  }

  if (velocity.y < 0) {
    velocity.y = Math.max(0.7, Math.abs(velocity.y) * 0.28);
  }
  die.userData.angularVelocity.x += normalZ * 1.8;
  die.userData.angularVelocity.z -= normalX * 1.8;
}

function stabilizeRestingDice(group) {
  const [left, right] = group.userData.dice;
  const offset = right.position.clone().sub(left.position);
  offset.y = 0;
  const horizontalDistance = offset.length();
  const minimumDistance = DIE_RADIUS * 2 + 0.035;

  left.position.y = DIE_FLOOR_Y;
  right.position.y = DIE_FLOOR_Y;
  left.position.x = clampToTable(left.position.x);
  left.position.z = clampToTable(left.position.z);
  right.position.x = clampToTable(right.position.x);
  right.position.z = clampToTable(right.position.z);

  // Preserve the natural landing positions. Only separate the dice when they
  // actually overlap; never pull already-separated dice back together.
  if (horizontalDistance >= minimumDistance) {
    return;
  }

  if (horizontalDistance < 0.001) {
    offset.set(1, 0, 0);
  } else {
    offset.divideScalar(horizontalDistance);
  }

  const correction = (minimumDistance - horizontalDistance) * 0.5 + 0.002;
  left.position.x = clampToTable(left.position.x - offset.x * correction);
  left.position.z = clampToTable(left.position.z - offset.z * correction);
  right.position.x = clampToTable(right.position.x + offset.x * correction);
  right.position.z = clampToTable(right.position.z + offset.z * correction);
}

function stopPhysicalDice(group, snapToResult) {
  group.userData.dice.forEach((die) => {
    die.userData.physicsActive = false;
    die.userData.sleeping = true;
    die.position.y = DIE_FLOOR_Y;
    if (snapToResult) {
      die.quaternion.copy(die.userData.targetQuaternion);
    } else {
      die.quaternion.normalize();
    }
    die.userData.velocity.set(0, 0, 0);
    die.userData.angularVelocity.set(0, 0, 0);
  });
  stabilizeRestingDice(group);
  group.userData.physicsActive = false;
  group.userData.physicsAccumulator = 0;
  if (snapToResult) {
    group.userData.resultSettling = false;
  }
}

function animatePhysicalDiceStep(group, delta, settleToResult) {
  group.userData.dice.forEach((die) => {
    if (!die.userData.physicsActive) return;
    const velocity = die.userData.velocity;
    const angularVelocity = die.userData.angularVelocity;

    velocity.y -= GRAVITY * delta;
    die.position.addScaledVector(velocity, delta);
    die.rotateX(angularVelocity.x * delta);
    die.rotateY(angularVelocity.y * delta);
    die.rotateZ(angularVelocity.z * delta);

    if (die.position.x < -TABLE_LIMIT || die.position.x > TABLE_LIMIT) {
      die.position.x = clampToTable(die.position.x);
      velocity.x *= -0.58;
      angularVelocity.z *= -0.82;
    }
    if (die.position.z < -TABLE_LIMIT || die.position.z > TABLE_LIMIT) {
      die.position.z = clampToTable(die.position.z);
      velocity.z *= -0.58;
      angularVelocity.x *= -0.82;
    }

    CARD_DECK_OBSTACLES.forEach((obstacle) => resolveDeckCollision(die, obstacle));

    if (die.position.y <= DIE_FLOOR_Y) {
      die.position.y = DIE_FLOOR_Y;
      if (Math.abs(velocity.y) > 0.7) {
        velocity.y = Math.abs(velocity.y) * 0.48;
        velocity.x *= 0.83;
        velocity.z *= 0.83;
        angularVelocity.multiplyScalar(0.76);
      } else {
        velocity.y = 0;
        velocity.x *= settleToResult ? 0.72 : 0.88;
        velocity.z *= settleToResult ? 0.72 : 0.88;
        angularVelocity.multiplyScalar(settleToResult ? 0.58 : 0.82);
      }
    }

    if (settleToResult) {
      settlePhysicalDieTowardResult(die, delta);
    }

    const linearSpeed = velocity.length();
    const spinSpeed = angularVelocity.length();
    const resultAligned =
      !settleToResult ||
      quaternionDistanceToTarget(die) <= RESULT_SETTLE_ALIGNMENT_DISTANCE;
    if (die.position.y <= DIE_FLOOR_Y + 0.001 && linearSpeed < 0.14 && spinSpeed < 0.18 && resultAligned) {
      die.userData.physicsActive = false;
      die.userData.sleeping = true;
      die.position.y = DIE_FLOOR_Y;
      if (settleToResult) {
        die.quaternion.copy(die.userData.targetQuaternion);
      } else {
        die.quaternion.normalize();
      }
      velocity.set(0, 0, 0);
      angularVelocity.set(0, 0, 0);
    } else if (settleToResult && die.position.y <= DIE_FLOOR_Y + 0.001 && linearSpeed < 0.18 && spinSpeed < 0.24) {
      velocity.set(0, 0, 0);
      angularVelocity.multiplyScalar(0.25);
    }
  });

  resolveDieCollision(group.userData.dice[0], group.userData.dice[1]);
  group.userData.physicsActive = group.userData.dice.some((die) => die.userData.physicsActive);
  if (!group.userData.physicsActive) {
    stopPhysicalDice(group, settleToResult);
  }
}

function animateRemoteDice(group, delta, settleToResult, visualStage) {
  const positionRate = group.userData.remoteMotionSettled ? 20 : 15;
  const rotationRate = group.userData.remoteMotionSettled ? 22 : 17;
  const positionAlpha = 1 - Math.exp(-positionRate * delta);
  const rotationAlpha = 1 - Math.exp(-rotationRate * delta);
  let converged = true;

  group.userData.dice.forEach((die) => {
    const targetPosition = die.userData.remotePosition;
    const shouldShowResult =
      group.userData.remoteMotionSettled &&
      (settleToResult || group.userData.remoteResultLocked || group.userData.resultSettling || visualStage === "idle");
    const targetQuaternion =
      shouldShowResult
        ? die.userData.targetQuaternion
        : die.userData.remoteQuaternion;
    die.position.lerp(targetPosition, positionAlpha);
    die.position.y = THREE.MathUtils.lerp(die.position.y, group.userData.remoteMotionSettled ? DIE_FLOOR_Y : targetPosition.y, positionAlpha);
    die.quaternion.slerp(targetQuaternion, rotationAlpha);
    if (die.position.distanceToSquared(targetPosition) > 0.000025 || 1 - Math.abs(die.quaternion.dot(targetQuaternion)) > 0.000025) {
      converged = false;
    }
  });

  if (group.userData.remoteMotionSettled && visualStage === "idle" && converged) {
    group.userData.dice.forEach((die) => {
      die.position.copy(die.userData.remotePosition);
      die.position.y = DIE_FLOOR_Y;
      die.quaternion.copy(
        (group.userData.remoteResultLocked || group.userData.resultSettling || visualStage === "idle")
          ? die.userData.targetQuaternion
          : die.userData.remoteQuaternion
      );
      die.userData.remoteInitialized = false;
    });
    stabilizeRestingDice(group);
    group.userData.remoteMotionActive = false;
    group.userData.remoteMotionSettled = false;
    group.userData.remoteResultLocked = false;
    group.userData.resultSettling = false;
  }
}

function animateDiceFx(group, elapsed) {
  const points = group.userData.fxPoints;
  const rings = group.userData.fxRings;
  const beam = group.userData.fxBeam;
  const light = group.userData.fxLight;
  const metadata = group.userData.fxMetadata;
  if (!points || !metadata) {
    if (points) points.visible = false;
    if (rings) rings.visible = false;
    if (beam) beam.visible = false;
    if (light) light.intensity = 0;
    return;
  }

  const active =
    group.userData.physicsActive ||
    group.userData.remoteMotionActive ||
    group.userData.drag.active ||
    ["cameraFocusDice", "diceRolling", "diceResult"].includes(group.userData.visualStage);
  points.visible = active;
  rings.visible = false;
  beam.visible = false;
  light.intensity = 0;
  if (!active) {
    points.material.opacity = 0;
    return;
  }

  const effect = metadata.effect || "sparks";
  const intensity = normalizedNumber(metadata.intensity, 1, 0.1, 3);
  const speed = normalizedNumber(metadata.speed, 1, 0.1, 4);
  const spread = normalizedNumber(metadata.spread, 1, 0.1, 3.5);
  const particleSize = normalizedNumber(metadata.particleSize, 1, 0.35, 3);
  const ringScale = normalizedNumber(metadata.ringScale, 1, 0.2, 3.5);
  const beamJitter = normalizedNumber(metadata.beamJitter, 1, 0, 3);
  const gravity = normalizedNumber(metadata.gravity, 0.55, 0, 2);
  const sparkle = normalizedNumber(metadata.sparkle, 0.55, 0, 1.8);
  const density = normalizedNumber(metadata.density, 1, 0.15, 1);
  const positions = points.geometry.attributes.position.array;
  const [left, right] = group.userData.dice;
  const midpointX = (left.position.x + right.position.x) * 0.5;
  const midpointY = (left.position.y + right.position.y) * 0.5;
  const midpointZ = (left.position.z + right.position.z) * 0.5;
  const resultStage = group.userData.visualStage === "diceResult";
  const particleCount = positions.length / 3;
  const activeParticleCount = Math.max(1, Math.floor(particleCount * density));
  for (let index = 0; index < particleCount; index += 1) {
    if (index >= activeParticleCount) {
      positions[index * 3] = midpointX;
      positions[index * 3 + 1] = -100;
      positions[index * 3 + 2] = midpointZ;
      continue;
    }
    const die = index % 2 === 0 ? left : right;
    const seed = index * 12.9898;
    const phase = elapsed * speed * (2 + intensity * 0.7) + seed;
    const radius = (0.18 + (index % 9) * 0.045) * spread;
    let x = die.position.x + Math.sin(phase * 1.7) * radius;
    let y = die.position.y + ((index % 9) / 9) * 0.8 + Math.cos(phase) * 0.08;
    let z = die.position.z + Math.cos(phase * 1.35) * radius;

    if (effect === "sparks") {
      const fall = (elapsed * speed * 2.8 + (index % 11) / 11) % 1;
      x = die.position.x + Math.sin(seed) * (0.18 + fall * 0.55 * spread);
      y = die.position.y + 0.72 - fall * (0.72 + gravity * 0.6);
      z = die.position.z + Math.cos(seed * 1.4) * (0.18 + fall * 0.55 * spread);
    } else if (effect === "trail") {
      const tail = (index % 18) / 18;
      x = die.position.x - Math.cos(elapsed * speed * 4 + index) * tail * 0.65 * spread;
      y = die.position.y - 0.2 + Math.sin(seed + elapsed * speed * 8) * 0.16 + tail * 0.22;
      z = die.position.z - Math.sin(elapsed * speed * 3.4 + index) * tail * 0.65 * spread;
    } else if (effect === "flakes") {
      const drift = (elapsed * speed * 0.7 + (index % 13) / 13) % 1;
      x = die.position.x + Math.sin(seed + elapsed) * (0.25 + drift * 0.6 * spread);
      y = die.position.y + 0.65 - drift * (0.5 + gravity * 0.45);
      z = die.position.z + Math.cos(seed * 0.7 + elapsed) * (0.25 + drift * 0.6 * spread);
    } else if (effect === "glitch") {
      const tick = Math.floor(elapsed * speed * 14 + index);
      x = die.position.x + (((tick * 17) % 7) - 3) * 0.11 * spread;
      y = die.position.y + (((tick * 13) % 8) - 2) * 0.1 * spread;
      z = die.position.z + (((tick * 11) % 7) - 3) * 0.11 * spread;
    } else if (effect === "waves") {
      const wave = (elapsed * speed * 1.45 + (index % 18) / 18) % 1;
      const angle = seed;
      x = midpointX + Math.cos(angle) * wave * 1.8 * spread;
      y = 0.13 + Math.sin(wave * Math.PI) * 0.06;
      z = midpointZ + Math.sin(angle) * wave * 1.8 * spread;
    } else if (effect === "electric") {
      const t = (index % 36) / 35;
      x = THREE.MathUtils.lerp(left.position.x, right.position.x, t);
      y = THREE.MathUtils.lerp(left.position.y, right.position.y, t) + Math.sin(seed + elapsed * speed * 18) * 0.16 * beamJitter;
      z = THREE.MathUtils.lerp(left.position.z, right.position.z, t) + Math.cos(seed + elapsed * speed * 14) * 0.12 * beamJitter;
    } else if (effect === "orbit" || effect === "galaxy") {
      const orbitRadius = (effect === "galaxy" ? 0.45 + (index % 12) * 0.045 : 0.28 + (index % 8) * 0.04) * spread;
      x = midpointX + Math.cos(phase * (index % 2 ? 0.8 : -0.65)) * orbitRadius;
      y = midpointY + Math.sin(phase * 0.7 + index) * (effect === "galaxy" ? 0.55 : 0.34);
      z = midpointZ + Math.sin(phase * (index % 2 ? 0.8 : -0.65)) * orbitRadius;
    } else if (effect === "confetti") {
      const fall = (elapsed * speed * (resultStage ? 1.8 : 0.7) + (index % 17) / 17) % 1;
      x = midpointX + Math.sin(seed) * 1.35 * spread;
      y = 1.75 - fall * (1.05 + gravity);
      z = midpointZ + Math.cos(seed * 1.7) * 1.25 * spread;
    } else if (effect === "flash") {
      const burst = (elapsed * speed * (resultStage ? 3.5 : 1.2) + (index % 12) / 12) % 1;
      x = midpointX + Math.cos(seed) * burst * 1.5 * spread;
      y = midpointY + Math.sin(seed * 1.3) * burst * 1.3 * spread;
      z = midpointZ + Math.sin(seed) * burst * 1.5 * spread;
    } else if (effect === "flames") {
      const rise = (elapsed * speed * 1.8 + (index % 19) / 19) % 1;
      const flameRadius = (0.12 + Math.sin(rise * Math.PI) * 0.34) * spread;
      x = die.position.x + Math.sin(seed + elapsed * speed * 5) * flameRadius;
      y = die.position.y - 0.35 + rise * (1.35 + intensity * 0.18) - gravity * rise * 0.18;
      z = die.position.z + Math.cos(seed * 0.8 + elapsed * speed * 4.2) * flameRadius;
    } else if (effect === "smoke") {
      const rise = (elapsed * speed * 0.62 + (index % 23) / 23) % 1;
      const swirl = (0.2 + rise * 0.75) * spread;
      x = die.position.x + Math.sin(seed + rise * 5) * swirl;
      y = die.position.y + 0.18 + rise * (1.35 + intensity * 0.18);
      z = die.position.z + Math.cos(seed * 1.2 + rise * 5) * swirl;
    } else if (effect === "embers") {
      const rise = (elapsed * speed * 1.15 + (index % 29) / 29) % 1;
      x = die.position.x + Math.sin(seed) * (0.2 + rise * 0.75 * spread);
      y = die.position.y + 0.1 + rise * 1.1 - gravity * rise * rise * 0.25;
      z = die.position.z + Math.cos(seed) * (0.2 + rise * 0.75 * spread);
    } else if (effect === "coins") {
      const arc = (elapsed * speed * 1.3 + (index % 24) / 24) % 1;
      const angle = seed + arc * Math.PI * 2;
      x = midpointX + Math.cos(angle) * (0.35 + arc * spread);
      y = midpointY + Math.sin(arc * Math.PI) * (0.85 + intensity * 0.1) - gravity * arc * 0.28;
      z = midpointZ + Math.sin(angle) * (0.35 + arc * spread);
    } else if (effect === "hearts") {
      const float = (elapsed * speed * 0.8 + (index % 17) / 17) % 1;
      x = die.position.x + Math.sin(seed) * 0.6 * spread;
      y = die.position.y + float * 1.25 + Math.sin(elapsed * speed * 3 + seed) * 0.08;
      z = die.position.z + Math.cos(seed * 1.3) * 0.6 * spread;
    } else if (effect === "portal") {
      const t = (index % 36) / 36;
      const portalRadius = (0.45 + Math.sin(elapsed * speed * 2 + t * Math.PI * 2) * 0.12) * spread;
      const angle = t * Math.PI * 2 + elapsed * speed * 2.6;
      x = midpointX + Math.cos(angle) * portalRadius;
      y = 0.2 + Math.sin(t * Math.PI * 2 + elapsed * speed) * 0.16 + (index % 2) * 0.34;
      z = midpointZ + Math.sin(angle) * portalRadius;
    } else if (effect === "laser") {
      const t = (index % 36) / 35;
      x = THREE.MathUtils.lerp(left.position.x, right.position.x, t) + Math.sin(seed + elapsed * speed * 30) * 0.025 * beamJitter;
      y = THREE.MathUtils.lerp(left.position.y, right.position.y, t) + Math.cos(seed + elapsed * speed * 24) * 0.06 * beamJitter;
      z = THREE.MathUtils.lerp(left.position.z, right.position.z, t) + Math.cos(seed + elapsed * speed * 26) * 0.025 * beamJitter;
    } else if (effect === "bubbles") {
      const rise = (elapsed * speed * 0.75 + (index % 31) / 31) % 1;
      const wobble = Math.sin(elapsed * speed * 4 + seed) * 0.16;
      x = die.position.x + (Math.sin(seed) * 0.42 + wobble) * spread;
      y = die.position.y + rise * (1.25 + intensity * 0.24);
      z = die.position.z + (Math.cos(seed * 1.4) * 0.42 + wobble) * spread;
    } else if (effect === "storm") {
      const storm = (elapsed * speed * 1.9 + (index % 21) / 21) % 1;
      const angle = seed + storm * Math.PI * 4;
      x = midpointX + Math.cos(angle) * (0.22 + storm * 1.15 * spread);
      y = midpointY + Math.sin(seed + elapsed * speed * 12) * 0.55 + storm * 0.65;
      z = midpointZ + Math.sin(angle) * (0.22 + storm * 1.15 * spread);
    } else if (effect === "runes") {
      const slot = index % 12;
      const orbit = 0.65 * spread;
      const angle = (slot / 12) * Math.PI * 2 + Math.floor(index / 12) * 0.2 + elapsed * speed * 0.45;
      x = midpointX + Math.cos(angle) * orbit;
      y = 0.18 + Math.floor(index / 12) * 0.18 + Math.sin(elapsed * speed * 2 + slot) * 0.05;
      z = midpointZ + Math.sin(angle) * orbit;
    }

    positions[index * 3] = x;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = z;
  }
  points.geometry.attributes.position.needsUpdate = true;
  points.material.opacity = Math.min(0.96, (0.3 + intensity * 0.24) * (0.7 + density * 0.3));
  points.material.size = (
    effect === "glitch" ? 0.11 :
      effect === "galaxy" || effect === "embers" ? 0.06 :
        effect === "smoke" || effect === "bubbles" ? 0.085 :
          0.055 + intensity * 0.025
  ) * particleSize * (1 + sparkle * 0.08);

  if (["waves", "flash", "galaxy", "portal", "storm", "runes"].includes(effect) && rings) {
    rings.visible = true;
    rings.children.forEach((ring, index) => {
      const cycle = (elapsed * speed * (effect === "flash" ? 2.4 : effect === "portal" ? 1.8 : 1.2) + index / 3) % 1;
      ring.visible = true;
      ring.position.set(midpointX, 0.14 + index * 0.015, midpointZ);
      ring.scale.setScalar((0.55 + cycle * (effect === "galaxy" || effect === "portal" ? 2.4 : 3.1)) * ringScale);
      ring.material.opacity = (1 - cycle) * (effect === "flash" && resultStage ? 0.85 : 0.48) * (0.7 + sparkle * 0.22);
    });
  }

  if (["electric", "laser", "storm"].includes(effect) && beam) {
    beam.visible = true;
    const beamPositions = beam.geometry.attributes.position.array;
    for (let index = 0; index < beamPositions.length / 3; index += 1) {
      const t = index / (beamPositions.length / 3 - 1);
      beamPositions[index * 3] = THREE.MathUtils.lerp(left.position.x, right.position.x, t);
      beamPositions[index * 3 + 1] = THREE.MathUtils.lerp(left.position.y, right.position.y, t) + Math.sin(elapsed * speed * 22 + index * 4.7) * 0.13 * beamJitter;
      beamPositions[index * 3 + 2] = THREE.MathUtils.lerp(left.position.z, right.position.z, t) + Math.cos(elapsed * speed * 19 + index * 3.2) * 0.1 * beamJitter;
    }
    beam.geometry.attributes.position.needsUpdate = true;
    beam.material.opacity = (effect === "laser" ? 0.84 : 0.65) + Math.sin(elapsed * speed * 28) * 0.18;
  }

  if (light) {
    light.position.set(midpointX, midpointY, midpointZ);
    light.intensity = ["flash", "electric", "trail", "galaxy", "flames", "portal", "laser", "storm"].includes(effect)
      ? intensity * (resultStage && effect === "flash" ? 5.5 : 2.4)
      : intensity * 0.65;
  }
}

export function animateDice3D(group, delta, elapsed) {
  const visualStage = group.userData.visualStage || "idle";
  const hovered = Boolean(group.userData.hovered);
  const dragging = Boolean(group.userData.drag.active);
  const readyToRoll = visualStage === "rollReady";
  const isActive = dragging || ["rollReady", "cameraFocusDice", "diceRolling", "diceResult"].includes(visualStage);
  const heatTarget = dragging ? 1 : hovered ? 0.8 : readyToRoll ? 0.55 : isActive ? 0.65 : 0;
  const remoteMotionActive = Boolean(group.userData.remoteMotionActive);
  const rollTarget = visualStage === "diceRolling" && !remoteMotionActive ? 1 : 0;
  const rollDamping = visualStage === "diceResult" ? 8.5 : 3.8;
  group.userData.heat = THREE.MathUtils.lerp(group.userData.heat, heatTarget, Math.min(1, delta * 4.6));
  group.userData.rollEnergy = THREE.MathUtils.lerp(group.userData.rollEnergy, rollTarget, Math.min(1, delta * rollDamping));
  group.userData.idleLift = Math.sin(elapsed * (readyToRoll ? 4.4 : 1.8)) * (readyToRoll ? 0.02 : 0.004);
  const hoverPulse = hovered ? Math.sin(elapsed * 8) * 0.01 : 0;
  const readyPulse = readyToRoll ? Math.sin(elapsed * 6.2) * 0.016 : 0;
  group.scale.setScalar(1 + group.userData.heat * 0.04 + hoverPulse + readyPulse);
  group.userData.glow.material.opacity = 0.14 + group.userData.heat * 0.28 + (hovered ? 0.16 : 0);
  group.userData.glow.scale.setScalar(1 + group.userData.heat * 0.14 + (hovered ? Math.sin(elapsed * 7) * 0.035 : 0) + (readyToRoll ? Math.sin(elapsed * 5.8) * 0.045 : 0));

  const averageX = (group.userData.dice[0].position.x + group.userData.dice[1].position.x) * 0.5;
  const averageZ = (group.userData.dice[0].position.z + group.userData.dice[1].position.z) * 0.5;
  group.userData.glow.position.x = averageX;
  group.userData.glow.position.z = averageZ;
  animateDiceFx(group, elapsed);

  if (dragging) {
    animateDraggedDice(group, delta, elapsed);
    return;
  }

  const settleToResult = RESULT_STAGES.has(visualStage) || group.userData.resultSettling;
  if (remoteMotionActive) {
    animateRemoteDice(group, delta, settleToResult, visualStage);
    return;
  }

  if (group.userData.physicsActive) {
    group.userData.physicsElapsed += delta;
    group.userData.physicsAccumulator = Math.min(
      group.userData.physicsAccumulator + delta,
      PHYSICS_STEP_SECONDS * MAX_PHYSICS_STEPS_PER_FRAME
    );
    let steps = 0;
    while (
      group.userData.physicsActive &&
      group.userData.physicsAccumulator >= PHYSICS_STEP_SECONDS &&
      steps < MAX_PHYSICS_STEPS_PER_FRAME
    ) {
      animatePhysicalDiceStep(group, PHYSICS_STEP_SECONDS, settleToResult);
      group.userData.physicsAccumulator -= PHYSICS_STEP_SECONDS;
      steps += 1;
    }
    if (group.userData.physicsActive && group.userData.physicsElapsed >= MAX_PHYSICS_DURATION_SECONDS) {
      stopPhysicalDice(group, settleToResult);
    }
    return;
  }

  let allResultsSettled = true;
  group.userData.dice.forEach((die, index) => {
    const wobble = Math.sin(elapsed * (hovered ? 5.4 : readyToRoll ? 7.2 : 2.8) + index * 0.65) * (hovered ? 0.018 : readyToRoll ? 0.04 : 0.004);
    const shouldSettleFace =
      group.userData.resultSettling ||
      group.userData.rollEnergy > 0.02 ||
      RESULT_STAGES.has(visualStage) ||
      (visualStage === "idle" && group.userData.landed);

    if (
      !remoteMotionActive &&
      !group.userData.landed &&
      visualStage === "diceRolling" &&
      group.userData.rollEnergy > 0.02
    ) {
      const energy = group.userData.rollEnergy;
      die.rotation.x += (2.2 + index * 0.35 + energy * 4.1) * delta;
      die.rotation.y += (2.5 + index * 0.3 + energy * 4.6) * delta;
      die.rotation.z += (1.6 + index * 0.18 + energy * 3.2) * delta;
      die.position.x = die.userData.home.x + Math.sin(elapsed * (4.2 + energy * 3.6) + index) * (0.03 + energy * 0.075);
      die.position.z = die.userData.home.z + Math.cos(elapsed * (3.9 + energy * 3.2) + index * 0.7) * (0.024 + energy * 0.06);
      die.position.y = DIE_FLOOR_Y + Math.abs(Math.sin(elapsed * (4.5 + energy * 4.4) + index)) * (0.018 + energy * 0.13);
      return;
    }

    if (!group.userData.landed) {
      die.position.x = THREE.MathUtils.lerp(die.position.x, die.userData.home.x, Math.min(1, delta * 8));
      die.position.z = THREE.MathUtils.lerp(die.position.z, die.userData.home.z, Math.min(1, delta * 8));
    }
    die.position.y = THREE.MathUtils.lerp(
      die.position.y,
      shouldSettleFace ? DIE_FLOOR_Y : DIE_FLOOR_Y + wobble,
      Math.min(1, delta * 7)
    );
    if (shouldSettleFace) {
      die.quaternion.slerp(die.userData.targetQuaternion, Math.min(1, delta * 12));
      if (quaternionDistanceToTarget(die) > 0.00008 || Math.abs(die.position.y - DIE_FLOOR_Y) > 0.002) {
        allResultsSettled = false;
      }
    }
  });
  if (group.userData.resultSettling && allResultsSettled) {
    finishResultSettling(group);
  }
}
