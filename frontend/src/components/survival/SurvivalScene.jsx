import * as THREE from "three";
import { useEffect, useRef } from "react";

const VIEW_SIZE = 14;
const MAX_PARTICLES = 200;
const PLAYER_COLORS = ["#38bdf8", "#f472b6", "#facc15", "#a78bfa"];
const ZOMBIE_COLORS = {
  normal: "#708b50",
  fast: "#a6b95e",
  tank: "#4d6540",
  spitter: "#77b966"
};
const TERRAIN_COLORS = {
  "dark-grass": "#263c2c",
  "forest-dirt": "#3d382b",
  asphalt: "#2c3134",
  sidewalk: "#696862",
  "ruined-ground": "#554c42",
  concrete: "#68635a",
  "light-grass": "#667a45",
  "field-dirt": "#756346"
};

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  });
}

function setOccluderMaterial(root, faded) {
  root.traverse((child) => {
    if (!child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (material.userData.baseOpacity == null) material.userData.baseOpacity = material.opacity ?? 1;
      material.transparent = faded || material.userData.baseOpacity < 1;
      material.opacity = faded ? Math.min(0.3, material.userData.baseOpacity) : material.userData.baseOpacity;
      material.depthWrite = !faded;
      material.needsUpdate = true;
    });
    child.renderOrder = faded ? 100 : 0;
  });
}

function createShadow(radius = 0.55, opacity = 0.28) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 18),
    new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.018;
  return mesh;
}

function terrainColor(tile) {
  const base = new THREE.Color(TERRAIN_COLORS[tile.terrain] || "#526044");
  const forest = new THREE.Color("#2b3e2d");
  const city = new THREE.Color("#575957");
  const field = new THREE.Color("#71804d");
  const [forestWeight, cityWeight, fieldWeight] = tile.weights || [0, 0, 1];
  const blended = forest.multiplyScalar(forestWeight)
    .add(city.multiplyScalar(cityWeight))
    .add(field.multiplyScalar(fieldWeight));
  return base.lerp(blended, 0.32);
}

function createChunkGroup(chunk) {
  const group = new THREE.Group();
  group.userData.kind = "chunk";
  group.userData.chunkKey = chunk.key;

  const tileGeometry = new THREE.BoxGeometry(1.02, 0.08, 1.02);
  const tileMaterial = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, vertexColors: true });
  const tiles = new THREE.InstancedMesh(tileGeometry, tileMaterial, chunk.tiles.length);
  tiles.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  chunk.tiles.forEach((tile, index) => {
    matrix.makeTranslation(tile.x + 0.5, -0.04, tile.z + 0.5);
    tiles.setMatrixAt(index, matrix);
    tiles.setColorAt(index, terrainColor(tile));
  });
  tiles.instanceMatrix.needsUpdate = true;
  tiles.instanceColor.needsUpdate = true;
  group.add(tiles);

  const occluders = [];
  chunk.obstacles.forEach((obstacle) => {
    const object = createObstacleMesh(obstacle);
    object.position.set(obstacle.x, 0, obstacle.z);
    object.rotation.y = obstacle.rotation || 0;
    object.userData.obstacle = obstacle;
    if (obstacle.solid && ["tree", "building", "vehicle"].includes(obstacle.type)) {
      object.userData.isOccluderRoot = true;
      object.traverse((child) => {
        if (child.isMesh) {
          child.userData.occluderRoot = object;
          occluders.push(child);
        }
      });
    }
    group.add(object);
  });
  group.userData.occluders = occluders;
  return group;
}

function createObstacleMesh(obstacle) {
  const group = new THREE.Group();
  if (obstacle.type === "tree") {
    group.add(createShadow(0.72, 0.28));
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.26, obstacle.height * 0.56, 7),
      new THREE.MeshStandardMaterial({ color: "#62462f", roughness: 1 })
    );
    trunk.position.y = obstacle.height * 0.28;
    trunk.castShadow = true;
    group.add(trunk);
    const canopyMaterial = new THREE.MeshStandardMaterial({ color: "#284e30", roughness: 0.95 });
    const canopy = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.78 + obstacle.height * 0.07, 1),
      canopyMaterial
    );
    canopy.position.set(0.08, obstacle.height * 0.7, 0);
    canopy.scale.y = 1.22;
    canopy.castShadow = true;
    group.add(canopy);
  } else if (obstacle.type === "bush") {
    const material = new THREE.MeshStandardMaterial({
      color: "#3f6a3d",
      transparent: true,
      opacity: 0.72,
      roughness: 1,
      depthWrite: false
    });
    for (let index = 0; index < 3; index += 1) {
      const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 1), material);
      leaf.position.set((index - 1) * 0.28, 0.35 + (index % 2) * 0.12, (index % 2) * 0.2);
      leaf.castShadow = true;
      group.add(leaf);
    }
  } else if (obstacle.type === "rock" || obstacle.type === "rubble") {
    group.add(createShadow(obstacle.radius + 0.12, 0.2));
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(obstacle.radius * 1.15, 0),
      new THREE.MeshStandardMaterial({ color: obstacle.type === "rock" ? "#686b66" : "#5f5145", roughness: 1 })
    );
    rock.position.y = obstacle.height * 0.5;
    rock.scale.y = obstacle.height / Math.max(0.2, obstacle.radius * 2);
    rock.castShadow = true;
    group.add(rock);
  } else if (obstacle.type === "vehicle") {
    group.add(createShadow(0.9, 0.3));
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(obstacle.width, obstacle.height * 0.7, obstacle.depth),
      new THREE.MeshStandardMaterial({ color: "#75473e", roughness: 0.88, metalness: 0.15 })
    );
    body.position.y = obstacle.height * 0.48;
    body.rotation.x = 0.17;
    body.castShadow = true;
    group.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(obstacle.width * 0.48, obstacle.height * 0.48, obstacle.depth * 0.86),
      new THREE.MeshStandardMaterial({ color: "#31383a", roughness: 0.62, metalness: 0.2 })
    );
    cabin.position.set(-obstacle.width * 0.08, obstacle.height * 0.88, 0);
    cabin.rotation.x = 0.17;
    group.add(cabin);
  } else if (obstacle.type === "building") {
    group.add(createShadow(Math.max(obstacle.width, obstacle.depth) * 0.66, 0.34));
    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(obstacle.width, obstacle.height, obstacle.depth),
      new THREE.MeshStandardMaterial({ color: obstacle.color || "#786755", roughness: 0.96 })
    );
    walls.position.y = obstacle.height / 2;
    walls.castShadow = true;
    walls.receiveShadow = true;
    group.add(walls);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(obstacle.width + 0.14, 0.16, obstacle.depth + 0.14),
      new THREE.MeshStandardMaterial({ color: "#363937", roughness: 0.9 })
    );
    roof.position.y = obstacle.height + 0.08;
    roof.castShadow = true;
    group.add(roof);
    const damage = new THREE.Mesh(
      new THREE.BoxGeometry(obstacle.width * 0.35, obstacle.height * 0.22, 0.05),
      new THREE.MeshBasicMaterial({ color: "#171a19" })
    );
    damage.position.set(obstacle.width * 0.18, obstacle.height * 0.7, obstacle.depth / 2 + 0.03);
    damage.rotation.z = 0.22;
    group.add(damage);
  }
  return group;
}

function createPlayerMesh(index, local) {
  const group = new THREE.Group();
  const color = PLAYER_COLORS[index % PLAYER_COLORS.length];
  group.add(createShadow(0.6, 0.33));
  const legs = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.33, 0.38, 8),
    new THREE.MeshStandardMaterial({ color: "#e7eef5", roughness: 0.72 })
  );
  legs.position.y = 0.28;
  legs.castShadow = true;
  group.add(legs);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.7, 0.48),
    new THREE.MeshStandardMaterial({ color, emissive: local ? color : "#000", emissiveIntensity: local ? 0.15 : 0, roughness: 0.7 })
  );
  body.position.y = 0.8;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 14, 10),
    new THREE.MeshStandardMaterial({ color: "#e5d0b3", roughness: 0.88 })
  );
  head.position.y = 1.35;
  head.castShadow = true;
  group.add(head);
  const weaponPivot = new THREE.Group();
  weaponPivot.position.y = 0.92;
  const weapon = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.14, 0.18),
    new THREE.MeshStandardMaterial({ color: "#dbeafe", roughness: 0.45, metalness: 0.38 })
  );
  weapon.position.x = 0.42;
  weapon.castShadow = true;
  weaponPivot.add(weapon);
  group.add(weaponPivot);
  group.userData.weaponPivot = weaponPivot;
  if (local) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 0.76, 30),
      new THREE.MeshBasicMaterial({ color: "#67e8f9", transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    group.add(ring);
  }
  return group;
}

function createZombieMesh(type, forestBorn) {
  const group = new THREE.Group();
  const tank = type === "tank";
  const fast = type === "fast";
  group.scale.setScalar(tank ? 1.32 : fast ? 0.82 : 1);
  group.add(createShadow(tank ? 0.68 : 0.5, 0.28));
  const skin = new THREE.MeshStandardMaterial({
    color: forestBorn ? "#5e873e" : ZOMBIE_COLORS[type] || ZOMBIE_COLORS.normal,
    roughness: 0.95
  });
  const cloth = new THREE.MeshStandardMaterial({ color: type === "spitter" ? "#564266" : "#58493d", roughness: 0.94 });
  const body = new THREE.Mesh(
    tank ? new THREE.BoxGeometry(0.7, 0.82, 0.58) : new THREE.CylinderGeometry(0.24, 0.31, 0.75, 7),
    cloth
  );
  body.position.y = 0.72;
  body.rotation.z = 0.08;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(tank ? 0.48 : 0.39, tank ? 0.43 : 0.38, 0.38), skin);
  head.position.set(0.04, 1.28, 0);
  head.rotation.z = -0.14;
  head.castShadow = true;
  group.add(head);
  if (type === "spitter") {
    const sac = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshStandardMaterial({ color: "#a3e635", emissive: "#65a30d", emissiveIntensity: 0.3 })
    );
    sac.position.set(-0.16, 0.82, -0.28);
    group.add(sac);
  }
  return group;
}

function createLootMesh(item) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: item.color || "#f8fafc",
    emissive: item.color || "#f8fafc",
    emissiveIntensity: 0.65,
    roughness: 0.4,
    metalness: 0.12
  });
  const mesh = new THREE.Mesh(
    item.itemId.startsWith("weapon_") ? new THREE.BoxGeometry(0.72, 0.16, 0.25) : new THREE.OctahedronGeometry(0.25, 0),
    material
  );
  mesh.position.y = 0.38;
  mesh.castShadow = true;
  group.add(mesh);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.46, 20),
    new THREE.MeshBasicMaterial({ color: item.color || "#fff", transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);
  group.userData.floating = true;
  return group;
}

function syncEntities(map, data, scene, create, update, onRemove) {
  const ids = new Set();
  data.forEach((item, index) => {
    const id = String(item.id);
    ids.add(id);
    let object = map.get(id);
    if (!object) {
      object = create(item, index);
      object.position.set(item.x, 0, item.z);
      object.userData.targetX = item.x;
      object.userData.targetZ = item.z;
      object.userData.snapshot = item;
      scene.add(object);
      map.set(id, object);
    }
    object.userData.targetX = item.x;
    object.userData.targetZ = item.z;
    object.userData.snapshot = item;
    update?.(object, item, index);
  });
  for (const [id, object] of map) {
    if (ids.has(id)) continue;
    onRemove?.(object.userData.snapshot);
    scene.remove(object);
    disposeObject(object);
    map.delete(id);
  }
}

function shortestAngleDelta(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export default function SurvivalScene({
  gameState,
  currentUserId,
  chunks,
  cameraQuarter,
  onAim,
  onMouseAction
}) {
  const containerRef = useRef(null);
  const stateRef = useRef(gameState);
  const chunksRef = useRef(chunks);
  const cameraQuarterRef = useRef(cameraQuarter);
  const onAimRef = useRef(onAim);
  const onMouseActionRef = useRef(onMouseAction);

  useEffect(() => { stateRef.current = gameState; }, [gameState]);
  useEffect(() => { chunksRef.current = chunks; }, [chunks]);
  useEffect(() => { cameraQuarterRef.current = cameraQuarter; }, [cameraQuarter]);
  useEffect(() => { onAimRef.current = onAim; }, [onAim]);
  useEffect(() => { onMouseActionRef.current = onMouseAction; }, [onMouseAction]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#171c1b");
    scene.fog = new THREE.Fog("#171c1b", 25, 46);
    const camera = new THREE.OrthographicCamera(-VIEW_SIZE, VIEW_SIZE, VIEW_SIZE, -VIEW_SIZE, 0.1, 180);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.sortObjects = true;
    renderer.domElement.className = "survival-canvas";
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight("#d9e2d0", "#25271f", 1.35));
    const sun = new THREE.DirectionalLight("#ffe4b5", 2.1);
    sun.position.set(-10, 22, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    scene.add(sun);

    const chunkGroups = new Map();
    const players = new Map();
    const zombies = new Map();
    const projectiles = new Map();
    const loot = new Map();
    const particles = [];
    const cameraTarget = new THREE.Vector3();
    const clock = new THREE.Clock();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const aimPoint = new THREE.Vector3();
    let currentCameraAngle = Math.PI / 4;
    let fadedRoots = new Set();
    let frameId = 0;

    const syncChunks = () => {
      const wanted = new Set(chunksRef.current.map((chunk) => chunk.key));
      chunksRef.current.forEach((chunk) => {
        if (chunkGroups.has(chunk.key)) return;
        const group = createChunkGroup(chunk);
        chunkGroups.set(chunk.key, group);
        scene.add(group);
      });
      for (const [key, group] of chunkGroups) {
        if (wanted.has(key)) continue;
        scene.remove(group);
        disposeObject(group);
        chunkGroups.delete(key);
      }
    };

    const updatePointer = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(groundPlane, aimPoint)) {
        onAimRef.current?.({ x: aimPoint.x, z: aimPoint.z });
      }
    };
    const pointerMove = (event) => updatePointer(event);
    const pointerDown = (event) => {
      updatePointer(event);
      onMouseActionRef.current?.(`Mouse${event.button}`, true);
    };
    const pointerUp = (event) => onMouseActionRef.current?.(`Mouse${event.button}`, false);
    const contextMenu = (event) => event.preventDefault();
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    window.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("contextmenu", contextMenu);

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const aspect = width / height;
      camera.left = -VIEW_SIZE * aspect;
      camera.right = VIEW_SIZE * aspect;
      camera.top = VIEW_SIZE;
      camera.bottom = -VIEW_SIZE;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const deathParticles = (snapshot) => {
      if (!snapshot || particles.length >= MAX_PARTICLES) return;
      const amount = Math.min(9, MAX_PARTICLES - particles.length);
      for (let index = 0; index < amount; index += 1) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.08 + Math.random() * 0.1, 0.08 + Math.random() * 0.1, 0.08 + Math.random() * 0.1),
          new THREE.MeshBasicMaterial({ color: ZOMBIE_COLORS[snapshot.type] || "#708b50", transparent: true })
        );
        mesh.position.set(snapshot.x, 0.7 + Math.random() * 0.6, snapshot.z);
        mesh.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 3.4, 1.2 + Math.random() * 2.4, (Math.random() - 0.5) * 3.4);
        mesh.userData.life = 0.55 + Math.random() * 0.55;
        particles.push(mesh);
        scene.add(mesh);
      }
    };

    const render = () => {
      frameId = requestAnimationFrame(render);
      const dt = Math.min(clock.getDelta(), 0.05);
      const state = stateRef.current;
      if (!state) return;
      syncChunks();

      syncEntities(players, state.players || [], scene,
        (player, index) => createPlayerMesh(index, String(player.id) === String(currentUserId)),
        (mesh, player) => {
          mesh.userData.weaponPivot.rotation.y = -Math.atan2(player.aimZ || 0, player.aimX || 1);
          mesh.visible = player.alive;
        });
      syncEntities(zombies, state.zombies || [], scene,
        (zombie) => createZombieMesh(zombie.type, zombie.forestBorn),
        (mesh, zombie) => { mesh.visible = !zombie.sleeping; },
        deathParticles);
      syncEntities(projectiles, state.projectiles || [], scene,
        (projectile) => {
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(projectile.kind === "acid" ? 0.17 : projectile.radius || 0.09, 8, 6),
            new THREE.MeshBasicMaterial({ color: projectile.color || "#fde68a" })
          );
          mesh.position.y = projectile.hostile ? 0.72 : 0.82;
          return mesh;
        });
      syncEntities(loot, state.loot || [], scene, createLootMesh);

      const local = state.players?.find((player) => String(player.id) === String(currentUserId));
      if (local) {
        cameraTarget.x += (local.x - cameraTarget.x) * Math.min(1, dt * 6.5);
        cameraTarget.z += (local.z - cameraTarget.z) * Math.min(1, dt * 6.5);
      }
      const targetAngle = Math.PI / 4 + cameraQuarterRef.current * (Math.PI / 2);
      currentCameraAngle += shortestAngleDelta(currentCameraAngle, targetAngle) * Math.min(1, dt * 7);
      const distance = 18.5;
      camera.position.set(
        cameraTarget.x + Math.cos(currentCameraAngle) * distance,
        21,
        cameraTarget.z + Math.sin(currentCameraAngle) * distance
      );
      camera.lookAt(cameraTarget.x, 0, cameraTarget.z);

      for (const collection of [players, zombies, projectiles, loot]) {
        for (const object of collection.values()) {
          const amount = collection === projectiles ? 0.74 : 0.36;
          object.position.x += (object.userData.targetX - object.position.x) * amount;
          object.position.z += (object.userData.targetZ - object.position.z) * amount;
          if (object.userData.floating) {
            object.position.y = 0.08 + Math.sin(performance.now() * 0.004 + object.position.x) * 0.08;
            object.rotation.y += dt * 1.6;
          }
        }
      }

      fadedRoots.forEach((root) => setOccluderMaterial(root, false));
      fadedRoots = new Set();
      const localMesh = players.get(String(currentUserId));
      if (localMesh) {
        const playerPoint = new THREE.Vector3(localMesh.position.x, 0.9, localMesh.position.z);
        const direction = playerPoint.clone().sub(camera.position);
        const distanceToPlayer = direction.length();
        direction.normalize();
        raycaster.set(camera.position, direction);
        raycaster.far = Math.max(0, distanceToPlayer - 0.25);
        const occluderMeshes = [];
        chunkGroups.forEach((group) => occluderMeshes.push(...(group.userData.occluders || [])));
        raycaster.intersectObjects(occluderMeshes, false).forEach((hit) => {
          const root = hit.object.userData.occluderRoot;
          if (root) fadedRoots.add(root);
        });
        fadedRoots.forEach((root) => setOccluderMaterial(root, true));
      }

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        particle.userData.life -= dt;
        particle.userData.velocity.y -= 5.8 * dt;
        particle.position.addScaledVector(particle.userData.velocity, dt);
        particle.material.opacity = Math.max(0, particle.userData.life * 1.5);
        if (particle.userData.life <= 0) {
          scene.remove(particle);
          disposeObject(particle);
          particles.splice(index, 1);
        }
      }

      renderer.render(scene, camera);
    };
    render();

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("contextmenu", contextMenu);
      onMouseActionRef.current?.("Mouse0", false);
      [...chunkGroups.values(), ...players.values(), ...zombies.values(), ...projectiles.values(), ...loot.values(), ...particles].forEach(disposeObject);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [currentUserId]);

  return <div ref={containerRef} className="survival-scene" />;
}
