import * as THREE from "three";

const FACE_ROTATIONS = {
  1: new THREE.Euler(0, 0, 0),
  2: new THREE.Euler(0, 0, Math.PI / 2),
  3: new THREE.Euler(0, 0, -Math.PI / 2),
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
  mesh.userData.rollOffset = new THREE.Vector3();
  return mesh;
}

export function createDice3D() {
  const group = new THREE.Group();
  group.position.set(0, 0.54, 0);

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
  glow.position.y = -0.405;
  group.add(glow);

  const left = createDie();
  left.position.set(-0.72, 0, 0.08);
  left.userData.home = left.position.clone();
  group.add(left);

  const right = createDie();
  right.position.set(0.72, 0, -0.08);
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
  group.visible = true;
  return group;
}

export function syncDice3D(group, { diceFaces = [1, 1], rollingDice = false, cinematicPhase = null, visualStage = "idle" }) {
  group.userData.rollingDice = rollingDice;
  group.userData.cinematicPhase = cinematicPhase;
  group.userData.visualStage = visualStage;
  group.userData.dice.forEach((die, index) => {
    const target = FACE_ROTATIONS[diceFaces[index] || 1] || FACE_ROTATIONS[1];
    die.userData.targetQuaternion.setFromEuler(target);
  });
}

export function animateDice3D(group, delta, elapsed) {
  const visualStage = group.userData.visualStage || "idle";
  const hovered = Boolean(group.userData.hovered);
  const readyToRoll = visualStage === "rollReady";
  const isActive = ["rollReady", "cameraFocusDice", "diceRolling", "diceResult"].includes(visualStage);
  const heatTarget = hovered ? 0.8 : readyToRoll ? 0.55 : isActive ? 0.65 : 0;
  const rollTarget = visualStage === "diceRolling" ? 1 : 0;
  const rollDamping = visualStage === "diceResult" ? 8.5 : 3.8;
  group.userData.heat = THREE.MathUtils.lerp(group.userData.heat, heatTarget, Math.min(1, delta * 4.6));
  group.userData.rollEnergy = THREE.MathUtils.lerp(group.userData.rollEnergy, rollTarget, Math.min(1, delta * rollDamping));
  group.userData.idleLift = Math.sin(elapsed * (readyToRoll ? 4.4 : 1.8)) * (readyToRoll ? 0.02 : 0.004);
  group.position.y = 0.54 + group.userData.idleLift + group.userData.heat * 0.016;
  const hoverPulse = hovered ? Math.sin(elapsed * 8) * 0.01 : 0;
  const readyPulse = readyToRoll ? Math.sin(elapsed * 6.2) * 0.016 : 0;
  group.scale.setScalar(1 + group.userData.heat * 0.04 + hoverPulse + readyPulse);
  group.userData.glow.material.opacity = 0.14 + group.userData.heat * 0.28 + (hovered ? 0.16 : 0);
  group.userData.glow.scale.setScalar(1 + group.userData.heat * 0.14 + (hovered ? Math.sin(elapsed * 7) * 0.035 : 0) + (readyToRoll ? Math.sin(elapsed * 5.8) * 0.045 : 0));

  group.userData.dice.forEach((die, index) => {
    const wobble = Math.sin(elapsed * (hovered ? 5.4 : readyToRoll ? 7.2 : 2.8) + index * 0.65) * (hovered ? 0.018 : readyToRoll ? 0.04 : 0.004);
    const shouldSettleFace =
      group.userData.rollEnergy > 0.02 ||
      ["diceResult", "highlightDestination", "tokenMoving", "settle"].includes(visualStage);

    if (visualStage === "diceRolling" && group.userData.rollEnergy > 0.02) {
      const energy = group.userData.rollEnergy;
      die.rotation.x += (2.2 + index * 0.35 + energy * 4.1) * delta;
      die.rotation.y += (2.5 + index * 0.3 + energy * 4.6) * delta;
      die.rotation.z += (1.6 + index * 0.18 + energy * 3.2) * delta;
      die.position.x = die.userData.home.x + Math.sin(elapsed * (4.2 + energy * 3.6) + index) * (0.03 + energy * 0.075);
      die.position.z = die.userData.home.z + Math.cos(elapsed * (3.9 + energy * 3.2) + index * 0.7) * (0.024 + energy * 0.06);
      die.position.y = Math.abs(Math.sin(elapsed * (4.5 + energy * 4.4) + index)) * (0.018 + energy * 0.13);
      return;
    }

    die.position.x = THREE.MathUtils.lerp(die.position.x, die.userData.home.x, Math.min(1, delta * 8));
    die.position.z = THREE.MathUtils.lerp(die.position.z, die.userData.home.z, Math.min(1, delta * 8));
    die.position.y = THREE.MathUtils.lerp(die.position.y, wobble, Math.min(1, delta * 7));
    if (shouldSettleFace) {
      die.quaternion.slerp(die.userData.targetQuaternion, Math.min(1, delta * 8.4));
    }
  });
}
