import { Compass, Map, MousePointer2, RotateCcw, ScanSearch } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createBoard3D, disposeObject3D } from "./monopoly3d/Board3D";
import {
  animateDice3D,
  createDice3D,
  syncDice3D
} from "./monopoly3d/Dice3D";
import { createCosmeticTokenModel3D } from "./monopoly3d/CosmeticToken3D";
import { PREVIEW_BOARD_SPACES } from "./monopoly3d/previewBoardSpaces";

function material(color, { metalness = 0.18, roughness = 0.38, opacity = 1, emissive = null, emissiveIntensity = 0 } = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    opacity,
    transparent: opacity < 1,
    emissive: emissive || "#000000",
    emissiveIntensity
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

function isTokenPreview(product) {
  return product?.slotKey === "TOKEN" || product?.category === "TOKEN" || String(product?.category || "").startsWith("TOKEN_");
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
    token.userData.animateLoading?.(delta, elapsed);
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
  const model = createBoard3D({
    board: PREVIEW_BOARD_SPACES,
    players: [],
    boardTheme: product,
    hideCenterDecks: true
  });

  if (model.selectionBillboard) {
    model.group.remove(model.selectionBillboard);
    disposeObject3D(model.selectionBillboard);
  }
  if (model.playerLayer) model.group.remove(model.playerLayer);

  const group = model.group;
  group.userData.animatePreview = (delta) => {
    group.rotation.y += delta * 0.12;
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
  if (isTokenPreview(product)) return createTokenPreview(product, tokenColor);
  if (product?.category === "DICE" || product?.category === "DICE_FX") return createDicePreview(product);
  if (product?.category === "BOARD_THEME") return createBoardPreview(product);
  return createGenericPreview(product);
}

const DEFAULT_VIEW_DIR = new THREE.Vector3(0.62, 0.52, 0.82).normalize();
const FRONTAL_VIEW_DIR = new THREE.Vector3(0, 0.3, 1).normalize();
const BOARD_VIEW_DIR = new THREE.Vector3(0.45, 0.88, 0.45).normalize();

function isBoardPreview(product) {
  return product?.category === "BOARD_THEME";
}

function defaultViewForProduct(product) {
  return isBoardPreview(product) ? BOARD_VIEW_DIR : DEFAULT_VIEW_DIR;
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
  const previewBadgeLabel = product?.metadata?.renderer === "gltf"
    ? "Modelo 3D"
    : product?.category === "BOARD_THEME"
      ? "Vista previa del tablero"
      : "Vista conceptual 3D";

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#081b26");

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 120);

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
    controls.minDistance = 1.4;
    controls.maxDistance = 28;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = 1.5;
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

    const previewRoot = new THREE.Group();
    scene.add(previewRoot);

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      frameCurrentObject();
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

    sceneStateRef.current = { autoRotate, camera, controls, previewRoot, framing: null, product: null };
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
    const state = sceneStateRef.current;
    const previewRoot = state?.previewRoot;
    if (!previewRoot) return;
    previewRoot.children.forEach(disposeObject);
    previewRoot.clear();
    if (state) state.product = product || null;
    if (product) previewRoot.add(createProductObject(product, tokenColor));
    frameCurrentObject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, tokenColor]);

  function frameCurrentObject() {
    const state = sceneStateRef.current;
    const object = state?.previewRoot?.children?.[0];
    if (!state || !object) return;

    const isBoard = isBoardPreview(state.product);

    state.previewRoot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5;

    const verticalFov = (state.camera.fov * Math.PI) / 180;
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * state.camera.aspect);
    const distanceForHeight = radius / Math.sin(verticalFov / 2);
    const distanceForWidth = radius / Math.sin(horizontalFov / 2);
    const fitPadding = isBoard ? 0.94 : 1.15;
    const fitDistance = isBoard
      ? distanceForWidth * fitPadding
      : Math.min(distanceForHeight, distanceForWidth) * fitPadding;
    const distance = THREE.MathUtils.clamp(
      fitDistance,
      state.controls.minDistance,
      isBoard ? state.controls.maxDistance : 9.5
    );

    state.framing = { center, distance };

    setCameraView(defaultViewForProduct(state.product));
  }

  function setCameraView(direction, distanceMultiplier = 1) {
    const state = sceneStateRef.current;
    if (!state) return;
    const framing = state.framing || { center: new THREE.Vector3(0, 0.5, 0), distance: 5.2 };
    state.camera.position.copy(framing.center).addScaledVector(direction, framing.distance * distanceMultiplier);
    state.controls.target.copy(framing.center);
    state.controls.update();
  }

  function resetCamera() {
    setCameraView(defaultViewForProduct(sceneStateRef.current?.product));
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
            <button type="button" onClick={() => setCameraView(FRONTAL_VIEW_DIR, 0.9)} title="Vista frontal">
              <Compass size={14} /> Frontal
            </button>
            <button type="button" onClick={() => setCameraView(BOARD_VIEW_DIR, 1.05)} title="Vista tablero">
              <Map size={14} /> Tablero
            </button>
          </div>
          <small>Arrastra para rotar · rueda para acercar</small>
        </>
      )}
    </div>
  );
}
