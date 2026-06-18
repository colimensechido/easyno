import * as THREE from "three";
import { piecePositionForPlayer, playerColors3D } from "./board3dUtils";

function makeNameSprite(player) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext("2d");

  context.fillStyle = "rgba(9, 12, 16, 0.82)";
  context.roundRect(8, 16, 240, 58, 16);
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.26)";
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = "#f8fafc";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "800 26px Inter, Arial, sans-serif";
  context.fillText((player.name || "Jugador").slice(0, 16), 128, 45);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.8, 0.68, 1);
  sprite.position.y = 1.1;
  return sprite;
}

export function createPlayerPiece3D(player, index = 0, players = []) {
  const color = player.color || playerColors3D[index % playerColors3D.length];
  const group = new THREE.Group();
  const start = piecePositionForPlayer(player, players);
  group.position.set(start.x, start.y, start.z);
  group.userData.playerId = player.id;
  group.userData.targetPosition = new THREE.Vector3(start.x, start.y, start.z);

  const baseMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.38,
    metalness: 0.2
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: "#111827",
    roughness: 0.55,
    metalness: 0.12
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.18, 32), baseMaterial);
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.21, 0.46, 32), baseMaterial);
  body.position.y = 0.28;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 32, 18), baseMaterial);
  head.position.y = 0.64;
  head.castShadow = true;
  group.add(head);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.025, 10, 32), darkMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.12;
  group.add(ring);

  group.add(makeNameSprite(player));
  return group;
}

export function setPlayerPieceTarget(piece, player, players = []) {
  const next = piecePositionForPlayer(player, players);
  piece.userData.targetPosition = new THREE.Vector3(next.x, next.y, next.z);
}

export function animatePlayerPiece(piece, delta, elapsed) {
  const target = piece.userData.targetPosition;
  if (!target) return;

  const distance = piece.position.distanceTo(target);
  const speed = Math.min(1, delta * (distance > 1 ? 10.5 : 12.5));
  piece.position.lerp(target, speed);
  piece.rotation.y += delta * (distance > 0.04 ? 1.55 : 0.55);
  const hop = distance > 0.04 ? Math.sin(Math.min(1, distance / 0.74) * Math.PI) * 0.17 : 0;
  piece.position.y = target.y + hop + Math.sin(elapsed * 4 + piece.position.x) * 0.02;
}
