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

function makeFaceTexture(value) {
  if (faceTextureCache.has(value)) {
    return faceTextureCache.get(value);
  }

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#fffdf6");
  gradient.addColorStop(1, "#f1dfbb");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  context.strokeStyle = "#d8c39a";
  context.lineWidth = 10;
  context.strokeRect(8, 8, 240, 240);
  context.fillStyle = "#3f2b17";

  pipLayout(value).forEach(([x, y]) => {
    context.beginPath();
    context.arc(128 + x * 150, 128 + y * 150, 20, 0, Math.PI * 2);
    context.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.userData.shared = true;
  faceTextureCache.set(value, texture);
  return texture;
}

function materialForFace(value) {
  if (materialCache.has(value)) {
    return materialCache.get(value);
  }

  const material = new THREE.MeshStandardMaterial({
    map: makeFaceTexture(value),
    roughness: 0.34,
    metalness: 0.04
  });
  material.userData.shared = true;
  materialCache.set(value, material);
  return material;
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
  group.userData.landed = false;
  group.userData.remoteMotionActive = false;
  group.userData.remoteMotionSettled = false;
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
  drag.active = true;
  drag.target.set(clampToTable(point.x), DRAG_HEIGHT, clampToTable(point.z));
  drag.samples = [];
  pushDragSample(group, drag.target, time);
  group.userData.physicsActive = false;
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
    group.userData.remoteMotionActive = true;
    group.userData.remoteMotionSettled = false;
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
    return;
  }

  if (motion.phase === "cancel") {
    group.userData.remoteMotionActive = false;
    group.userData.remoteMotionSettled = false;
    cancelDiceDrag(group);
    return;
  }

  if (!["release", "state", "settled"].includes(motion.phase) || !Array.isArray(motion.dice)) return;

  group.userData.drag.active = false;
  const settled = motion.phase === "settled";
  group.userData.remoteMotionActive = true;
  group.userData.remoteMotionSettled = settled;
  group.userData.physicsActive = settled ? false : motion.active !== false;
  group.userData.landed = true;
  group.userData.dice.forEach((die, index) => {
    const state = motion.dice[index];
    if (!state) return;
    applyVector(die.position, state.position, DIE_FLOOR_Y);
    die.position.x = clampToTable(die.position.x);
    die.position.z = clampToTable(die.position.z);
    die.position.y = Math.max(DIE_FLOOR_Y, die.position.y);
    die.quaternion.set(
      safeNumber(state.quaternion?.x),
      safeNumber(state.quaternion?.y),
      safeNumber(state.quaternion?.z),
      safeNumber(state.quaternion?.w, 1)
    ).normalize();
    applyVector(die.userData.velocity, state.velocity);
    applyVector(die.userData.angularVelocity, state.angularVelocity);
    die.userData.physicsActive = !settled && motion.active !== false && !state.sleeping;
    die.userData.sleeping = settled || Boolean(state.sleeping);
    if (die.userData.sleeping) {
      die.userData.velocity.set(0, 0, 0);
      die.userData.angularVelocity.set(0, 0, 0);
    }
  });
  group.userData.physicsActive = group.userData.dice.some((die) => die.userData.physicsActive);
}

export function syncDice3D(group, { diceFaces = [1, 1], rollingDice = false, cinematicPhase = null, visualStage = "idle" }) {
  group.userData.rollingDice = rollingDice;
  group.userData.cinematicPhase = cinematicPhase;
  group.userData.visualStage = visualStage;
  group.userData.dice.forEach((die, index) => {
    const target = FACE_ROTATIONS[diceFaces[index] || 1] || FACE_ROTATIONS[1];
    die.userData.targetQuaternion.setFromEuler(target);
  });
  if (
    group.userData.remoteMotionSettled &&
    visualStage === "idle" &&
    !rollingDice &&
    !cinematicPhase
  ) {
    group.userData.remoteMotionActive = false;
    group.userData.remoteMotionSettled = false;
  }
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
  const offset = right.position.clone().sub(left.position);
  const distance = offset.length();
  const minimumDistance = DIE_RADIUS * 2;
  if (distance <= 0.001 || distance >= minimumDistance) return;

  const normal = offset.divideScalar(distance);
  const correction = normal.clone().multiplyScalar((minimumDistance - distance) * 0.5);
  left.position.sub(correction);
  right.position.add(correction);

  const relativeVelocity = right.userData.velocity.clone().sub(left.userData.velocity);
  const separatingSpeed = relativeVelocity.dot(normal);
  if (separatingSpeed >= 0) return;

  const impulse = normal.multiplyScalar(-separatingSpeed * 0.72);
  left.userData.velocity.sub(impulse);
  right.userData.velocity.add(impulse);
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

function animatePhysicalDice(group, delta, settleToResult) {
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
      die.quaternion.slerp(die.userData.targetQuaternion, Math.min(1, delta * 13));
    }

    const linearSpeed = velocity.length();
    const spinSpeed = angularVelocity.length();
    if (settleToResult && die.position.y <= DIE_FLOOR_Y + 0.001 && linearSpeed < 0.18 && spinSpeed < 0.22) {
      die.userData.physicsActive = false;
      die.userData.sleeping = true;
      die.position.y = DIE_FLOOR_Y;
      die.quaternion.copy(die.userData.targetQuaternion);
      velocity.set(0, 0, 0);
      angularVelocity.set(0, 0, 0);
    }
  });

  resolveDieCollision(group.userData.dice[0], group.userData.dice[1]);
  group.userData.physicsActive = group.userData.dice.some((die) => die.userData.physicsActive);
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

  if (dragging) {
    animateDraggedDice(group, delta, elapsed);
    return;
  }

  const settleToResult = ["diceResult", "highlightDestination", "tokenMoving", "settle"].includes(visualStage);
  if (group.userData.physicsActive) {
    animatePhysicalDice(group, delta, settleToResult);
    return;
  }

  if (remoteMotionActive) {
    if (group.userData.remoteMotionSettled && settleToResult) {
      group.userData.dice.forEach((die) => {
        die.quaternion.slerp(die.userData.targetQuaternion, Math.min(1, delta * 8.4));
      });
    }
    return;
  }

  group.userData.dice.forEach((die, index) => {
    const wobble = Math.sin(elapsed * (hovered ? 5.4 : readyToRoll ? 7.2 : 2.8) + index * 0.65) * (hovered ? 0.018 : readyToRoll ? 0.04 : 0.004);
    const shouldSettleFace =
      group.userData.rollEnergy > 0.02 ||
      ["diceResult", "highlightDestination", "tokenMoving", "settle"].includes(visualStage);

    if (!remoteMotionActive && visualStage === "diceRolling" && group.userData.rollEnergy > 0.02) {
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
    die.position.y = THREE.MathUtils.lerp(die.position.y, DIE_FLOOR_Y + wobble, Math.min(1, delta * 7));
    if (shouldSettleFace) {
      die.quaternion.slerp(die.userData.targetQuaternion, Math.min(1, delta * 8.4));
    }
  });
}
