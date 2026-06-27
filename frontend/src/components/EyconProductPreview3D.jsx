import { MousePointer2, RotateCcw, ScanSearch } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  animateDice3D,
  createDice3D,
  syncDice3D
} from "./monopoly3d/Dice3D";
import { createCosmeticTokenModel3D } from "./monopoly3d/CosmeticToken3D";

function material(color, { metalness = 0.18, roughness = 0.38, opacity = 1 } = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    opacity,
    transparent: opacity < 1
  });
}

function mesh(geometry, meshMaterial, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const result = new THREE.Mesh(geometry, meshMaterial);
  result.position.set(...position);
  result.rotation.set(...rotation);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function createTokenPreview(product, tokenColor = null) {
  const metadata = product?.metadata || {};
  const showcase = new THREE.Group();
  const pedestal = mesh(
    new THREE.CylinderGeometry(1.03, 1.12, 0.16, 64),
    material("#17342e", { metalness: 0.38, roughness: 0.36 }),
    [0, 0.01, 0]
  );
  const ring = mesh(
    new THREE.TorusGeometry(0.86, 0.026, 12, 64),
    material(tokenColor?.ring || metadata.ring || "#fbbf24", { metalness: 0.55, roughness: 0.28 }),
    [0, 0.105, 0],
    [Math.PI / 2, 0, 0]
  );
  const token = createCosmeticTokenModel3D(product, tokenColor);
  token.position.y = 0.12;
  token.scale.setScalar(0.86);
  showcase.add(pedestal, ring, token);
  showcase.userData.animatePreview = (delta, elapsed) => {
    token.rotation.y += delta * 0.42;
    token.position.y = 0.12 + Math.sin(elapsed * 1.8) * 0.02;
  };
  return showcase;
}

function createDicePreview(product) {
  const dice = createDice3D();
  dice.scale.setScalar(1.22);
  dice.position.y = 0.05;
  syncDice3D(dice, {
    diceFaces: [5, 2],
    rollingDice: true,
    visualStage: "diceRolling",
    diceSkin: product?.category === "DICE" ? product : null,
    diceFx: product?.category === "DICE_FX" ? product : null
  });
  dice.userData.animatePreview = (delta, elapsed) => {
    animateDice3D(dice, delta, elapsed);
  };
  return dice;
}

function createBoardPreview(product) {
  const metadata = product?.metadata || {};
  const baseColor = metadata.baseColor || "#2d2418";
  const centerColor = metadata.centerColor || "#1f6f59";
  const accentColor = metadata.accentColor || "#f4d45d";
  const roughness = Number(metadata.roughness ?? 0.58);
  const metalness = Number(metadata.metalness ?? 0.16);
  const group = new THREE.Group();
  const baseMaterial = material(baseColor, { roughness, metalness });
  const centerMaterial = material(centerColor, { roughness: Math.max(0.12, roughness - 0.08), metalness });
  const accentMaterial = material(accentColor, { roughness: 0.28, metalness: Math.max(0.35, metalness) });
  const tileMaterial = material("#f8f1dc", { roughness: 0.68, metalness: 0.04 });

  group.add(
    mesh(new THREE.BoxGeometry(3.35, 0.22, 3.35), baseMaterial, [0, 0.05, 0]),
    mesh(new THREE.BoxGeometry(2.15, 0.12, 2.15), centerMaterial, [0, 0.22, 0]),
    mesh(new THREE.TorusGeometry(0.72, 0.035, 10, 48), accentMaterial, [0, 0.32, 0], [Math.PI / 2, 0, 0])
  );

  const tileSize = 0.42;
  for (let side = 0; side < 4; side += 1) {
    for (let index = -3; index <= 3; index += 1) {
      const coordinate = index * 0.43;
      const position = side === 0
        ? [coordinate, 0.23, 1.43]
        : side === 1
          ? [1.43, 0.23, coordinate]
          : side === 2
            ? [coordinate, 0.23, -1.43]
            : [-1.43, 0.23, coordinate];
      const tile = mesh(new THREE.BoxGeometry(tileSize, 0.11, tileSize), tileMaterial, position);
      const band = mesh(
        new THREE.BoxGeometry(side % 2 ? 0.08 : 0.3, 0.025, side % 2 ? 0.3 : 0.08),
        index % 3 === 0 ? accentMaterial : centerMaterial,
        [position[0], 0.3, position[2]]
      );
      group.add(tile, band);
    }
  }
  group.rotation.x = -0.12;
  group.userData.animatePreview = (delta) => {
    group.rotation.y += delta * 0.22;
  };
  return group;
}

function createGenericPreview(product) {
  const group = new THREE.Group();
  const color = product?.metadata?.color || "#22d3ee";
  const core = mesh(
    new THREE.IcosahedronGeometry(0.9, 2),
    material(color, { metalness: 0.56, roughness: 0.18 }),
    [0, 1, 0]
  );
  const halo = mesh(
    new THREE.TorusGeometry(1.25, 0.05, 12, 64),
    material(color, { metalness: 0.72, roughness: 0.16 }),
    [0, 1, 0],
    [Math.PI / 2.6, 0, 0]
  );
  group.add(core, halo);
  group.userData.animatePreview = (delta) => {
    core.rotation.y += delta * 0.65;
    core.rotation.x += delta * 0.22;
    halo.rotation.z += delta * 0.48;
  };
  return group;
}

function createProductObject(product, tokenColor = null) {
  if (product?.category === "TOKEN") return createTokenPreview(product, tokenColor);
  if (product?.category === "DICE" || product?.category === "DICE_FX") return createDicePreview(product);
  if (product?.category === "BOARD_THEME") return createBoardPreview(product);
  return createGenericPreview(product);
}

function disposeObject(object) {
  object?.traverse((child) => {
    child.userData?.dispose?.();
    if (child.geometry && !child.geometry.userData?.shared) child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((item) => {
      if (item.userData?.shared) return;
      item.map?.dispose?.();
      item.dispose?.();
    });
  });
}

export default function EyconProductPreview3D({ product, tokenColor = null }) {
  const containerRef = useRef(null);
  const sceneStateRef = useRef(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [renderError, setRenderError] = useState(false);
  const previewBadgeLabel = product?.metadata?.renderer === "gltf" ? "Modelo 3D" : "Vista conceptual 3D";

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#101d1a");
    scene.fog = new THREE.Fog("#101d1a", 11, 24);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
    camera.position.set(3.35, 2.45, 4.05);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      setRenderError(false);
    } catch {
      setRenderError(true);
      return undefined;
    }
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.minDistance = 2.35;
    controls.maxDistance = 8.2;
    controls.minPolarAngle = 0.45;
    controls.maxPolarAngle = 1.48;
    controls.target.set(0, 0.54, 0);
    controls.autoRotateSpeed = 1.15;

    scene.add(new THREE.HemisphereLight("#fff8dc", "#223b33", 1.85));
    const keyLight = new THREE.DirectionalLight("#fff8e7", 2.65);
    keyLight.position.set(4, 6, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const rimLight = new THREE.PointLight("#5eead4", 8, 11, 2);
    rimLight.position.set(-3.5, 2.8, -2.5);
    scene.add(rimLight);
    const warmLight = new THREE.PointLight("#fbbf24", 5, 8, 2);
    warmLight.position.set(3, 1.5, -3);
    scene.add(warmLight);

    const floor = mesh(
      new THREE.CylinderGeometry(2.35, 2.55, 0.08, 64),
      material("#1b2c26", { metalness: 0.12, roughness: 0.62, opacity: 0.78 }),
      [0, -0.09, 0]
    );
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(5.4, 14, "#5f7659", "#264239");
    grid.position.y = -0.035;
    grid.material.transparent = true;
    grid.material.opacity = 0.24;
    scene.add(grid);

    const previewRoot = new THREE.Group();
    scene.add(previewRoot);

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const clock = new THREE.Clock();
    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      controls.autoRotate = sceneStateRef.current?.autoRotate ?? true;
      controls.update();
      previewRoot.children[0]?.userData?.animatePreview?.(delta, elapsed);
      renderer.render(scene, camera);
    };

    sceneStateRef.current = { autoRotate, camera, controls, previewRoot };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      sceneStateRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (sceneStateRef.current) sceneStateRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    const previewRoot = sceneStateRef.current?.previewRoot;
    if (!previewRoot) return;
    previewRoot.children.forEach(disposeObject);
    previewRoot.clear();
    if (product) previewRoot.add(createProductObject(product, tokenColor));
  }, [product, tokenColor]);

  function resetCamera() {
    const state = sceneStateRef.current;
    if (!state) return;
    state.camera.position.set(3.35, 2.45, 4.05);
    state.controls.target.set(0, 0.54, 0);
    state.controls.update();
  }

  return (
    <div className="eycon-3d-preview">
      <div className="eycon-3d-stage" ref={containerRef} />
      {renderError && (
        <div className="eycon-3d-fallback" style={{ color: product?.metadata?.color || product?.metadata?.accentColor }}>
          <strong>{product?.preview || "✦"}</strong>
          <span>La vista 3D no está disponible en este dispositivo.</span>
        </div>
      )}
      <div className="eycon-3d-badge"><ScanSearch size={13} /> {previewBadgeLabel}</div>
      {!renderError && (
        <>
          <div className="eycon-3d-controls">
            <button type="button" className={autoRotate ? "is-active" : ""} onClick={() => setAutoRotate((current) => !current)}>
              <MousePointer2 size={14} /> {autoRotate ? "Giro automático" : "Girar manualmente"}
            </button>
            <button type="button" onClick={resetCamera} title="Restablecer cámara">
              <RotateCcw size={14} /> Centrar
            </button>
          </div>
          <small>Arrastra para rotar · rueda para acercar</small>
        </>
      )}
    </div>
  );
}
