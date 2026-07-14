import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeletonAware } from "three/examples/jsm/utils/SkeletonUtils.js";
import chickenUrl from "../../files/custom_models/monopoly/pawns/chicken.glb?url";
import dingusTheCatUrl from "../../files/custom_models/monopoly/pawns/Dingusthecat.glb?url";
import jigglypuffUrl from "../../files/custom_models/monopoly/pawns/jigglypuff.glb?url";
import pikachuUrl from "../../files/custom_models/monopoly/pawns/pikachu.glb?url";
import snorlaxUrl from "../../files/custom_models/monopoly/pawns/snorlax.glb?url";
import tralaleroTralalaUrl from "../../files/custom_models/monopoly/pawns/tralalerotralala.glb?url";
import tungTungShakurUrl from "../../files/custom_models/monopoly/pawns/tungtungshakur.glb?url";

const customTokenAssets = {
  chicken: {
    url: chickenUrl,
    fitSize: 1.9,
    fallbackModel: "duck"
  },
  dingus_the_cat: {
    url: dingusTheCatUrl,
    fitSize: 1.95,
    fallbackModel: "cat"
  },
  jigglypuff: {
    url: jigglypuffUrl,
    fitSize: 1.75,
    fallbackModel: "ghost"
  },
  pikachu: {
    url: pikachuUrl,
    fitSize: 1.9,
    fallbackModel: "robot_dog"
  },
  snorlax: {
    url: snorlaxUrl,
    fitSize: 1.9,
    fallbackModel: "astronaut"
  },
  tralalero_tralala: {
    url: tralaleroTralalaUrl,
    fitSize: 2.05,
    fallbackModel: "dinosaur"
  },
  tung_tung_shakur: {
    url: tungTungShakurUrl,
    fitSize: 2.05,
    fallbackModel: "hat"
  }
};

const textureSlots = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "emissiveMap",
  "alphaMap",
  "aoMap",
  "bumpMap"
];

const gltfLoader = new GLTFLoader();
const gltfCache = new Map();

function backendAssetOrigin() {
  const explicit = String(import.meta.env.VITE_ASSET_BASE_URL || import.meta.env.VITE_API_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (typeof window === "undefined") return "";
  const { protocol, hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return "http://localhost:4000";
  return `${protocol}//api.${hostname}`;
}

function resolveTokenAssetUrl(url) {
  const safeUrl = String(url || "").trim();
  if (safeUrl.startsWith("/uploads/models3d/")) {
    return `${backendAssetOrigin()}${safeUrl}`;
  }
  return safeUrl;
}

function loadCustomTokenAsset(assetKey, assetUrl = "") {
  const asset = customTokenAssets[assetKey];
  const url = resolveTokenAssetUrl(asset?.url || assetUrl);
  if (!url) return Promise.reject(new Error(`Modelo de ficha no registrado: ${assetKey}`));
  const cacheKey = `${assetKey || "uploaded"}:${url}`;
  if (!gltfCache.has(cacheKey)) {
    gltfCache.set(cacheKey, new Promise((resolve, reject) => {
      gltfLoader.load(url, resolve, undefined, reject);
    }));
  }
  return gltfCache.get(cacheKey);
}

function disposeTokenObject(object) {
  object?.traverse((child) => {
    child.userData?.dispose?.();
    if (child.geometry && !child.geometry.userData?.shared) child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((item) => {
      textureSlots.forEach((slot) => {
        if (item[slot] && !item[slot].userData?.shared) item[slot].dispose?.();
      });
      if (!item.userData?.shared) item.dispose?.();
    });
  });
}

function vectorFromMetadata(value, fallback = [0, 0, 0]) {
  return Array.isArray(value) && value.length >= 3
    ? value.map((item, index) => Number(item) || fallback[index] || 0)
    : fallback;
}

function numberFromMetadata(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveCustomAssetKey(metadata = {}) {
  if (metadata.assetUrl) {
    return String(metadata.assetKey || metadata.asset || "uploaded_model").trim();
  }
  return [metadata.assetKey, metadata.asset, metadata.model]
    .map((item) => String(item || "").trim())
    .find((item) => Boolean(customTokenAssets[item])) || "";
}

function prepareCustomModelMaterials(root, metadata, primary) {
  const colorMode = String(metadata.colorMode || "").toUpperCase();
  const tintable = colorMode === "TINT" || colorMode === "FORCE" || metadata.tintable === true || metadata.tintMode === "multiply";
  const forceColor = colorMode === "FORCE" || metadata.forceColor === true || metadata.tintMode === "replace";
  const tintStrength = numberFromMetadata(metadata.tintStrength, 0.75);
  let targetColor;
  try {
    targetColor = new THREE.Color(primary);
  } catch {
    targetColor = new THREE.Color("#22d3ee");
  }

  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    if (child.geometry) child.geometry.userData.shared = true;

    const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
    const nextMaterials = sourceMaterials.filter(Boolean).map((sourceMaterial) => {
      const nextMaterial = sourceMaterial.clone();
      if (forceColor && nextMaterial.color) {
        nextMaterial.color.copy(targetColor);
      } else if (tintable && nextMaterial.color) {
        nextMaterial.color.lerp(targetColor, tintStrength);
      }
      textureSlots.forEach((slot) => {
        if (nextMaterial[slot]) nextMaterial[slot].userData.shared = true;
      });
      nextMaterial.needsUpdate = true;
      return nextMaterial;
    });

    if (nextMaterials.length > 0) {
      child.material = Array.isArray(child.material) ? nextMaterials : nextMaterials[0];
    }
  });
}

function normalizeCustomModel(root, metadata, assetConfig) {
  const wrapper = new THREE.Group();
  wrapper.add(root);
  wrapper.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  if (!box.isEmpty()) {
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    root.position.x -= center.x;
    root.position.y -= box.min.y;
    root.position.z -= center.z;
    wrapper.updateMatrixWorld(true);

    const normalizedBox = new THREE.Box3().setFromObject(root);
    const normalizedSize = new THREE.Vector3();
    normalizedBox.getSize(normalizedSize);
    const largestSide = Math.max(normalizedSize.x, normalizedSize.y, normalizedSize.z, 0.001);
    const fitSize = numberFromMetadata(metadata.fitSize, assetConfig.fitSize || 1.55);
    wrapper.scale.setScalar(fitSize / largestSide);
  }

  const rotation = vectorFromMetadata(metadata.rotation, assetConfig.rotation || [0, 0, 0]);
  const offset = vectorFromMetadata(metadata.offset, assetConfig.offset || [0, 0, 0]);
  wrapper.rotation.set(...rotation);
  wrapper.position.set(...offset);
  return wrapper;
}

function instantiateCustomModel(gltf, metadata, assetConfig, primary) {
  const source = gltf.scene || gltf.scenes?.[0];
  const root = cloneSkeletonAware(source);
  prepareCustomModelMaterials(root, metadata, primary);
  return normalizeCustomModel(root, metadata, assetConfig);
}

function createTokenLoadingSpinner(primary, secondary) {
  const group = new THREE.Group();
  const outer = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.045, 10, 72, Math.PI * 1.55),
    tokenMaterial(primary || "#22d3ee", {
      metalness: 0.35,
      roughness: 0.22,
      emissive: primary || "#22d3ee",
      emissiveIntensity: 0.35
    })
  );
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.032, 8, 56, Math.PI * 1.25),
    tokenMaterial(secondary || "#fbbf24", {
      metalness: 0.45,
      roughness: 0.2,
      emissive: secondary || "#fbbf24",
      emissiveIntensity: 0.28
    })
  );
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 24, 16),
    tokenMaterial("#fff8dc", {
      metalness: 0.2,
      roughness: 0.24,
      emissive: "#fbbf24",
      emissiveIntensity: 0.55
    })
  );

  outer.rotation.x = Math.PI / 2;
  inner.rotation.x = Math.PI / 2;
  inner.rotation.z = Math.PI;
  core.position.y = 0.02;
  group.position.y = 0.62;
  group.add(outer, inner, core);
  group.userData.loadingSpinner = true;
  group.userData.animateLoading = (delta) => {
    outer.rotation.z -= delta * 4.8;
    inner.rotation.z += delta * 3.4;
    core.scale.setScalar(1 + Math.sin(performance.now() * 0.008) * 0.08);
  };
  return group;
}

function createCustomTokenModel(assetKey, primary, secondary, metadata, factories, onLoadState) {
  const assetConfig = customTokenAssets[assetKey] || {
    url: metadata.assetUrl,
    fitSize: metadata.fitSize || 1.9,
    fallbackModel: metadata.fallbackModel || "hat"
  };
  const group = new THREE.Group();
  const fallbackModel = metadata.fallbackModel || assetConfig.fallbackModel || "cat";
  const fallbackFactory = factories[fallbackModel] || factories.cat || factories.hat;
  const loadingSpinner = createTokenLoadingSpinner(primary, secondary);
  group.add(loadingSpinner);
  group.userData.loadingAssetKey = assetKey;
  onLoadState?.("loading");
  group.userData.animateLoading = (delta, elapsed) => {
    loadingSpinner.userData.animateLoading?.(delta, elapsed);
  };

  let disposed = false;
  group.userData.dispose = () => {
    disposed = true;
    group.userData.disposed = true;
  };

  loadCustomTokenAsset(assetKey, assetConfig.url)
    .then((gltf) => {
      if (disposed || group.userData.disposed) return;
      const loadedModel = instantiateCustomModel(gltf, metadata, assetConfig, primary);
      group.remove(loadingSpinner);
      disposeTokenObject(loadingSpinner);
      group.add(loadedModel);
      delete group.userData.loadingAssetKey;
      delete group.userData.animateLoading;
      group.userData.loadedAssetKey = assetKey;
      onLoadState?.("loaded");
    })
    .catch(() => {
      console.warn("No se pudo cargar modelo GLB de ficha", {
        assetKey,
        url: assetConfig.url,
        fallbackModel
      });
      if (disposed || group.userData.disposed) return;
      group.remove(loadingSpinner);
      disposeTokenObject(loadingSpinner);
      delete group.userData.loadingAssetKey;
      delete group.userData.animateLoading;
      group.add(fallbackFactory(primary, secondary));
      onLoadState?.("error");
    });

  group.userData.cosmeticModel = assetKey;
  return group;
}

function tokenMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.38,
    metalness: options.metalness ?? 0.18,
    opacity: options.opacity ?? 1,
    transparent: (options.opacity ?? 1) < 1,
    emissive: options.emissive || "#000000",
    emissiveIntensity: options.emissiveIntensity || 0
  });
}

function part(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(...position);
  result.rotation.set(...rotation);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function addEyes(group, y, z, x = 0.18, color = "#07131a") {
  const eyeMaterial = tokenMaterial(color, { roughness: 0.2, emissive: color, emissiveIntensity: 0.25 });
  group.add(
    part(new THREE.SphereGeometry(0.055, 14, 10), eyeMaterial, [-x, y, z]),
    part(new THREE.SphereGeometry(0.055, 14, 10), eyeMaterial, [x, y, z])
  );
}

function addLeg(group, x, z, material, length = 0.48) {
  group.add(part(new THREE.CapsuleGeometry(0.09, length, 5, 10), material, [x, 0.28, z]));
}

function createHat(primary, secondary) {
  const group = new THREE.Group();
  const gold = tokenMaterial(primary, { metalness: 0.68, roughness: 0.22 });
  const trim = tokenMaterial(secondary, { metalness: 0.45, roughness: 0.3 });
  group.add(
    part(new THREE.CylinderGeometry(0.78, 0.78, 0.12, 40), gold, [0, 0.24, 0]),
    part(new THREE.CylinderGeometry(0.43, 0.55, 0.92, 36), gold, [0, 0.73, 0]),
    part(new THREE.TorusGeometry(0.5, 0.065, 12, 40), trim, [0, 0.35, 0], [Math.PI / 2, 0, 0]),
    part(new THREE.BoxGeometry(0.2, 0.18, 0.08), tokenMaterial("#f5d76e", { metalness: 0.75 }), [0, 0.38, 0.5])
  );
  return group;
}

function createRobotDog(primary, secondary) {
  const group = new THREE.Group();
  const shell = tokenMaterial(primary, { metalness: 0.72, roughness: 0.2 });
  const joints = tokenMaterial(secondary, { metalness: 0.5, roughness: 0.32 });
  const neon = tokenMaterial("#67e8f9", { emissive: "#22d3ee", emissiveIntensity: 1.3, roughness: 0.12 });
  group.add(
    part(new THREE.BoxGeometry(1.05, 0.5, 0.58), shell, [0, 0.72, 0]),
    part(new THREE.BoxGeometry(0.52, 0.48, 0.5), shell, [0.55, 1.05, 0]),
    part(new THREE.BoxGeometry(0.34, 0.12, 0.54), neon, [0.79, 1.1, 0]),
    part(new THREE.CylinderGeometry(0.05, 0.05, 0.65, 10), joints, [-0.74, 0.82, 0], [0, 0, -0.72])
  );
  [-0.35, 0.35].forEach((x) => {
    [-0.22, 0.22].forEach((z) => addLeg(group, x, z, joints, 0.42));
  });
  return group;
}

function createSportCar(primary, secondary) {
  const group = new THREE.Group();
  const body = tokenMaterial(primary, { metalness: 0.55, roughness: 0.2 });
  const glass = tokenMaterial("#9be7ff", { metalness: 0.5, roughness: 0.08, opacity: 0.78 });
  const dark = tokenMaterial("#090d12", { roughness: 0.72 });
  group.add(
    part(new THREE.BoxGeometry(1.55, 0.34, 0.72), body, [0, 0.48, 0]),
    part(new THREE.BoxGeometry(0.74, 0.34, 0.62), glass, [0.08, 0.8, 0]),
    part(new THREE.BoxGeometry(0.48, 0.08, 0.82), tokenMaterial(secondary, { metalness: 0.6 }), [-0.64, 0.73, 0])
  );
  [-0.5, 0.5].forEach((x) => {
    [-0.4, 0.4].forEach((z) => {
      group.add(part(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 18), dark, [x, 0.3, z], [Math.PI / 2, 0, 0]));
    });
  });
  return group;
}

function createDuck(primary, secondary) {
  const group = new THREE.Group();
  const yellow = tokenMaterial(primary, { roughness: 0.34 });
  const orange = tokenMaterial(secondary, { roughness: 0.42 });
  group.add(
    part(new THREE.SphereGeometry(0.58, 30, 20), yellow, [0, 0.62, 0]),
    part(new THREE.SphereGeometry(0.4, 28, 18), yellow, [0.36, 1.2, 0]),
    part(new THREE.ConeGeometry(0.17, 0.46, 16), orange, [0.78, 1.16, 0], [0, 0, -Math.PI / 2]),
    part(new THREE.SphereGeometry(0.3, 22, 14), yellow, [-0.06, 0.7, 0.48], [0, 0, 0.3])
  );
  addEyes(group, 1.31, 0.34, 0.16);
  return group;
}

function createCat(primary, secondary) {
  const group = new THREE.Group();
  const fur = tokenMaterial(primary, { roughness: 0.5 });
  const collar = tokenMaterial(secondary, { metalness: 0.32, roughness: 0.35 });
  group.add(
    part(new THREE.SphereGeometry(0.48, 28, 20), fur, [0, 0.68, 0]),
    part(new THREE.SphereGeometry(0.38, 28, 20), fur, [0.12, 1.26, 0]),
    part(new THREE.ConeGeometry(0.16, 0.4, 12), fur, [-0.1, 1.65, 0.18], [0, 0, -0.15]),
    part(new THREE.ConeGeometry(0.16, 0.4, 12), fur, [-0.1, 1.65, -0.18], [0, 0, -0.15]),
    part(new THREE.TorusGeometry(0.3, 0.045, 10, 28), collar, [0.05, 1.0, 0], [Math.PI / 2, 0, 0]),
    part(new THREE.TorusGeometry(0.5, 0.08, 10, 32, Math.PI * 1.35), fur, [-0.48, 0.88, 0], [0, Math.PI / 2, 0.5])
  );
  addEyes(group, 1.34, 0.33, 0.14, "#fef08a");
  return group;
}

function createDinosaur(primary, secondary) {
  const group = new THREE.Group();
  const skin = tokenMaterial(primary, { roughness: 0.54 });
  const crest = tokenMaterial(secondary, { roughness: 0.42 });
  group.add(
    part(new THREE.SphereGeometry(0.58, 28, 18), skin, [0, 0.75, 0], [0, 0, -0.15]),
    part(new THREE.SphereGeometry(0.38, 26, 18), skin, [0.5, 1.2, 0]),
    part(new THREE.ConeGeometry(0.27, 1.25, 16), skin, [-0.88, 0.82, 0], [0, 0, -Math.PI / 2])
  );
  [-0.22, 0.32].forEach((x) => {
    [-0.22, 0.22].forEach((z) => addLeg(group, x, z, skin, 0.38));
  });
  for (let index = 0; index < 5; index += 1) {
    group.add(part(new THREE.ConeGeometry(0.11, 0.32, 10), crest, [-0.44 + index * 0.24, 1.24 + Math.sin(index) * 0.08, 0], [0, 0, -0.1]));
  }
  addEyes(group, 1.3, 0.31, 0.14);
  return group;
}

function createAstronaut(primary, secondary) {
  const group = new THREE.Group();
  const suit = tokenMaterial(primary, { roughness: 0.38 });
  const trim = tokenMaterial(secondary, { metalness: 0.45, roughness: 0.3 });
  const visor = tokenMaterial("#153849", { metalness: 0.72, roughness: 0.08, opacity: 0.8 });
  group.add(
    part(new THREE.CapsuleGeometry(0.4, 0.62, 8, 18), suit, [0, 0.72, 0]),
    part(new THREE.SphereGeometry(0.48, 30, 20), trim, [0, 1.55, 0]),
    part(new THREE.SphereGeometry(0.36, 28, 18), visor, [0, 1.57, 0.2]),
    part(new THREE.BoxGeometry(0.62, 0.56, 0.26), trim, [0, 0.82, -0.42])
  );
  [-0.48, 0.48].forEach((x) => {
    group.add(part(new THREE.CapsuleGeometry(0.1, 0.48, 5, 10), suit, [x, 0.85, 0], [0, 0, x < 0 ? 0.25 : -0.25]));
    group.add(part(new THREE.CapsuleGeometry(0.12, 0.4, 5, 10), suit, [x * 0.55, 0.22, 0]));
  });
  return group;
}

function createGhost(primary) {
  const group = new THREE.Group();
  const aura = tokenMaterial(primary, {
    roughness: 0.14,
    opacity: 0.72,
    emissive: primary,
    emissiveIntensity: 0.45
  });
  group.add(
    part(new THREE.SphereGeometry(0.56, 30, 20), aura, [0, 1.05, 0]),
    part(new THREE.ConeGeometry(0.58, 1.15, 30, 1, true), aura, [0, 0.5, 0], [Math.PI, 0, 0])
  );
  addEyes(group, 1.14, 0.5, 0.19, "#ecfeff");
  return group;
}

function createDragon(primary, secondary) {
  const group = createDinosaur(primary, secondary);
  const wing = tokenMaterial(secondary, { roughness: 0.38, opacity: 0.88 });
  group.add(
    part(new THREE.ConeGeometry(0.48, 1.1, 3), wing, [-0.15, 1.1, 0.52], [0.2, 0, -0.28]),
    part(new THREE.ConeGeometry(0.48, 1.1, 3), wing, [-0.15, 1.1, -0.52], [-0.2, 0, -0.28]),
    part(new THREE.ConeGeometry(0.1, 0.32, 10), wing, [0.36, 1.62, 0.18]),
    part(new THREE.ConeGeometry(0.1, 0.32, 10), wing, [0.36, 1.62, -0.18])
  );
  return group;
}

function createTaco(primary, secondary) {
  const group = new THREE.Group();
  const shell = tokenMaterial(primary, { roughness: 0.46, metalness: 0.22 });
  const filling = tokenMaterial(secondary, { roughness: 0.58 });
  const tomato = tokenMaterial("#ef4444", { roughness: 0.5 });
  group.add(
    part(new THREE.TorusGeometry(0.62, 0.2, 18, 42, Math.PI), shell, [0, 0.72, 0], [0, 0, Math.PI / 2]),
    part(new THREE.SphereGeometry(0.46, 24, 14), filling, [0, 0.86, 0])
  );
  for (let index = 0; index < 5; index += 1) {
    group.add(part(new THREE.SphereGeometry(0.09, 12, 8), index % 2 ? tomato : filling, [-0.34 + index * 0.17, 1.12 + (index % 2) * 0.05, 0.12]));
  }
  return group;
}

export function createCosmeticTokenModel3D(cosmetic, colorOverride = null, onLoadState = null) {
  const metadata = cosmetic?.metadata || {};
  const model = metadata.model || "hat";
  const primary = colorOverride?.bg || colorOverride?.color || metadata.color || "#22d3ee";
  const secondary = colorOverride?.ring || metadata.ring || "#0f766e";
  const factories = {
    hat: createHat,
    robot_dog: createRobotDog,
    sport_car: createSportCar,
    duck: createDuck,
    cat: createCat,
    dinosaur: createDinosaur,
    astronaut: createAstronaut,
    ghost: createGhost,
    dragon: createDragon,
    taco: createTaco
  };

  const assetKey = resolveCustomAssetKey(metadata);
  if (assetKey || metadata.renderer === "gltf") {
    const customModel = assetKey
      ? createCustomTokenModel(assetKey, primary, secondary, metadata, factories, onLoadState)
      : (factories[metadata.fallbackModel] || factories.cat || createHat)(primary, secondary);
    if (!assetKey) onLoadState?.("error");
    customModel.userData.cosmeticModel = assetKey || model;
    return customModel;
  }

  const result = (factories[model] || createHat)(primary, secondary);
  onLoadState?.("loaded");
  result.userData.cosmeticModel = model;
  return result;
}
