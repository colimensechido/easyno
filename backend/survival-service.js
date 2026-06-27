const crypto = require("crypto");

const MAP_SIZE = 200;
const MAP_HALF = MAP_SIZE / 2;
const CHUNK_SIZE = 10;
const PLAYER_RADIUS = 0.46;
const MAX_PLAYERS = 4;
const MAX_PROJECTILES = 520;
const MAX_ZOMBIES = 80;
const TICK_MS = 1000 / 30;
const BROADCAST_MS = 1000 / 15;
const ACTIVE_ZOMBIE_RADIUS = 48;

const WEAPONS = Object.freeze({
  pistol: {
    id: "pistol",
    name: "Pistola",
    ammoType: "pistol",
    magSize: 12,
    damage: 25,
    fireMs: 260,
    reloadMs: 1050,
    projectileSpeed: 23,
    spread: 0.018,
    pellets: 1,
    color: "#f8fafc"
  },
  shotgun: {
    id: "shotgun",
    name: "Escopeta",
    ammoType: "shotgun",
    magSize: 6,
    damage: 18,
    fireMs: 720,
    reloadMs: 1450,
    projectileSpeed: 18,
    spread: 0.22,
    pellets: 5,
    color: "#f59e0b"
  },
  rifle: {
    id: "rifle",
    name: "Rifle",
    ammoType: "rifle",
    magSize: 30,
    damage: 34,
    fireMs: 105,
    reloadMs: 1550,
    projectileSpeed: 27,
    spread: 0.045,
    pellets: 1,
    color: "#fb7185"
  },
  sniper: {
    id: "sniper",
    name: "Francotirador",
    ammoType: "rifle",
    magSize: 5,
    damage: 180,
    fireMs: 1200,
    reloadMs: 1900,
    projectileSpeed: 42,
    spread: 0,
    pellets: 1,
    color: "#67e8f9"
  }
});

const ZOMBIE_TYPES = Object.freeze({
  normal: { hp: 60, speed: 1.35, damage: 9, radius: 0.46, color: "#708b50" },
  fast: { hp: 34, speed: 2.35, damage: 7, radius: 0.36, color: "#a6b95e" },
  tank: { hp: 310, speed: 0.72, damage: 22, radius: 0.72, color: "#4d6540" },
  spitter: { hp: 85, speed: 1.02, damage: 6, radius: 0.44, color: "#77b966" }
});

const LOOT_DEFINITIONS = Object.freeze({
  ammo_pistol: { id: "ammo_pistol", name: "Munición de pistola", kind: "ammo", ammoType: "pistol", color: "#fde68a" },
  ammo_shotgun: { id: "ammo_shotgun", name: "Cartuchos", kind: "ammo", ammoType: "shotgun", color: "#fb923c" },
  ammo_rifle: { id: "ammo_rifle", name: "Munición de rifle", kind: "ammo", ammoType: "rifle", color: "#fda4af" },
  medkit: { id: "medkit", name: "Botiquín", kind: "consumable", color: "#f43f5e" },
  weapon_shotgun: { id: "weapon_shotgun", name: "Escopeta", kind: "weapon", weaponId: "shotgun", color: "#f59e0b" },
  weapon_rifle: { id: "weapon_rifle", name: "Rifle", kind: "weapon", weaponId: "rifle", color: "#fb7185" },
  weapon_sniper: { id: "weapon_sniper", name: "Francotirador", kind: "weapon", weaponId: "sniper", color: "#67e8f9" },
  wood: { id: "wood", name: "Madera", kind: "material", color: "#b77945" },
  metal: { id: "metal", name: "Metal", kind: "material", color: "#94a3b8" }
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

function seedFromString(value) {
  const text = String(value || "");
  let seed = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    seed ^= text.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function hash2d(seed, x, z) {
  let value = seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(seed, x, z) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = x - x0;
  const tz = z - z0;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = hash2d(seed, x0, z0);
  const b = hash2d(seed, x0 + 1, z0);
  const c = hash2d(seed, x0, z0 + 1);
  const d = hash2d(seed, x0 + 1, z0 + 1);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sz);
}

function fbm(seed, x, z) {
  let value = 0;
  let amplitude = 0.58;
  let frequency = 1;
  let total = 0;
  for (let octave = 0; octave < 4; octave += 1) {
    value += valueNoise(seed + octave * 1013, x * frequency, z * frequency) * amplitude;
    total += amplitude;
    frequency *= 2.03;
    amplitude *= 0.49;
  }
  return value / total;
}

function biomeAt(seed, x, z) {
  const warpedX = x * 0.022 + (valueNoise(seed + 81, x * 0.008, z * 0.008) - 0.5) * 2.5;
  const warpedZ = z * 0.022 + (valueNoise(seed + 161, x * 0.008, z * 0.008) - 0.5) * 2.5;
  const value = fbm(seed + 503, warpedX, warpedZ);
  const forest = 1 - smoothstep(0.405, 0.455, value);
  const field = smoothstep(0.515, 0.565, value);
  const city = clamp(1 - forest - field, 0, 1);
  const dominant = forest >= city && forest >= field ? "forest" : city >= field ? "city" : "field";
  return { dominant, forest, city, field, value };
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function terrainAt(seed, x, z, biome) {
  if (biome.dominant === "city") {
    const roadX = Math.abs(positiveModulo(x + 3, 14) - 7) <= 2;
    const roadZ = Math.abs(positiveModulo(z - 2, 14) - 7) <= 2;
    const sidewalk = Math.abs(positiveModulo(x + 3, 14) - 7) === 3 ||
      Math.abs(positiveModulo(z - 2, 14) - 7) === 3;
    if (roadX || roadZ) return "asphalt";
    if (sidewalk) return "sidewalk";
    return hash2d(seed + 907, x, z) > 0.48 ? "ruined-ground" : "concrete";
  }
  if (biome.dominant === "forest") {
    return hash2d(seed + 111, x, z) > 0.42 ? "dark-grass" : "forest-dirt";
  }
  return hash2d(seed + 211, x, z) > 0.34 ? "light-grass" : "field-dirt";
}

function chunkKey(chunkX, chunkZ) {
  return `${chunkX}:${chunkZ}`;
}

function createObstacle(id, type, x, z, radius, extra = {}) {
  return {
    id,
    type,
    x,
    z,
    radius,
    solid: extra.solid !== false,
    slow: extra.slow || 0,
    width: extra.width || radius * 2,
    depth: extra.depth || radius * 2,
    height: extra.height || 1,
    rotation: extra.rotation || 0,
    color: extra.color || null
  };
}

function generateChunk(seed, chunkX, chunkZ) {
  const tiles = [];
  const obstacles = [];
  const startX = chunkX * CHUNK_SIZE - MAP_HALF;
  const startZ = chunkZ * CHUNK_SIZE - MAP_HALF;
  const endX = Math.min(startX + CHUNK_SIZE, MAP_HALF);
  const endZ = Math.min(startZ + CHUNK_SIZE, MAP_HALF);

  for (let x = startX; x < endX; x += 1) {
    for (let z = startZ; z < endZ; z += 1) {
      const biome = biomeAt(seed, x + 0.5, z + 0.5);
      const terrain = terrainAt(seed, x, z, biome);
      tiles.push({
        x,
        z,
        terrain,
        biome: biome.dominant,
        weights: [
          Math.round(biome.forest * 100) / 100,
          Math.round(biome.city * 100) / 100,
          Math.round(biome.field * 100) / 100
        ]
      });

      if (Math.hypot(x, z) < 5.5) continue;
      const random = hash2d(seed + 3001, x, z);
      const random2 = hash2d(seed + 4001, x, z);

      if (biome.dominant === "forest") {
        if (random < 0.19) {
          obstacles.push(createObstacle(
            `tree:${x}:${z}`,
            "tree",
            x + 0.5 + (random2 - 0.5) * 0.42,
            z + 0.5 + (hash2d(seed + 4002, x, z) - 0.5) * 0.42,
            0.42 + hash2d(seed + 4003, x, z) * 0.16,
            { height: 2.8 + hash2d(seed + 4004, x, z) * 1.8 }
          ));
        } else if (random < 0.34) {
          obstacles.push(createObstacle(
            `bush:${x}:${z}`,
            "bush",
            x + 0.5,
            z + 0.5,
            0.58,
            { solid: false, slow: 0.48, height: 0.8 }
          ));
        } else if (random < 0.375) {
          obstacles.push(createObstacle(
            `rock:${x}:${z}`,
            "rock",
            x + 0.5,
            z + 0.5,
            0.38,
            { height: 0.55 + random2 * 0.45 }
          ));
        }
      } else if (biome.dominant === "field") {
        if (random < 0.025) {
          obstacles.push(createObstacle(`field-rock:${x}:${z}`, "rock", x + 0.5, z + 0.5, 0.32, { height: 0.55 }));
        } else if (random < 0.065) {
          obstacles.push(createObstacle(`field-bush:${x}:${z}`, "bush", x + 0.5, z + 0.5, 0.52, {
            solid: false,
            slow: 0.7,
            height: 0.7
          }));
        }
      } else if (terrain === "asphalt") {
        if (random < 0.018) {
          obstacles.push(createObstacle(
            `vehicle:${x}:${z}`,
            "vehicle",
            x + 0.5,
            z + 0.5,
            0.72,
            {
              width: 1.45,
              depth: 0.78,
              height: 0.72,
              rotation: random2 > 0.5 ? 0 : Math.PI / 2
            }
          ));
        }
      } else if (terrain !== "sidewalk") {
        const anchorX = Math.floor((x + MAP_HALF) / 5) * 5 - MAP_HALF;
        const anchorZ = Math.floor((z + MAP_HALF) / 5) * 5 - MAP_HALF;
        if (x === anchorX && z === anchorZ) {
          const centerBiome = biomeAt(seed, x + 2.5, z + 2.5);
          if (centerBiome.city > 0.48 && hash2d(seed + 5001, x, z) > 0.18) {
            const width = 3.2 + hash2d(seed + 5002, x, z) * 1.1;
            const depth = 3.2 + hash2d(seed + 5003, x, z) * 1.1;
            obstacles.push(createObstacle(
              `building:${x}:${z}`,
              "building",
              x + 2.5,
              z + 2.5,
              Math.max(width, depth) * 0.48,
              {
                width,
                depth,
                height: 2.6 + hash2d(seed + 5004, x, z) * 5.4,
                color: ["#806a54", "#6f6255", "#92775b", "#665f55"][Math.floor(hash2d(seed + 5005, x, z) * 4)]
              }
            ));
          }
        }
        if (random > 0.94) {
          obstacles.push(createObstacle(
            `rubble:${x}:${z}`,
            "rubble",
            x + 0.5,
            z + 0.5,
            0.34,
            { width: 0.7, depth: 0.6, height: 0.45, rotation: random2 * Math.PI }
          ));
        }
      }
    }
  }

  return { key: chunkKey(chunkX, chunkZ), chunkX, chunkZ, tiles, obstacles };
}

function obstacleCollision(x, z, radius, obstacle) {
  if (!obstacle.solid) return false;
  if (obstacle.type === "building" || obstacle.type === "vehicle" || obstacle.type === "rubble") {
    const nearestX = clamp(x, obstacle.x - obstacle.width / 2, obstacle.x + obstacle.width / 2);
    const nearestZ = clamp(z, obstacle.z - obstacle.depth / 2, obstacle.z + obstacle.depth / 2);
    const dx = x - nearestX;
    const dz = z - nearestZ;
    return dx * dx + dz * dz < radius * radius;
  }
  const hitRadius = radius + obstacle.radius;
  return (x - obstacle.x) ** 2 + (z - obstacle.z) ** 2 < hitRadius * hitRadius;
}

function publicInventory(player) {
  return player.inventory.map((item, index) => item ? { ...item, slot: index } : null);
}

function publicPlayer(player) {
  const weapon = WEAPONS[player.weapon] || WEAPONS.pistol;
  return {
    id: player.id,
    username: player.username,
    x: player.x,
    z: player.z,
    vx: player.vx,
    vz: player.vz,
    aimX: player.aimX,
    aimZ: player.aimZ,
    hp: Math.max(0, player.hp),
    maxHp: player.maxHp,
    alive: player.alive,
    connected: player.connected,
    weapon: player.weapon,
    ammo: {
      clip: player.clipByWeapon[player.weapon] || 0,
      reserve: player.ammo[weapon.ammoType] || 0,
      magSize: weapon.magSize
    },
    reloadingUntil: player.reloadingUntil,
    dashCooldownUntil: player.dashCooldownUntil,
    dashUntil: player.dashUntil,
    hunger: player.hunger,
    thirst: player.thirst,
    kills: player.kills,
    inventory: publicInventory(player)
  };
}

function createPlayer(user, index) {
  const angle = (Math.PI * 2 * index) / MAX_PLAYERS;
  return {
    id: user.id,
    username: user.username,
    x: Math.cos(angle) * 1.5,
    z: Math.sin(angle) * 1.5,
    vx: 0,
    vz: 0,
    aimX: 1,
    aimZ: 0,
    hp: 100,
    maxHp: 100,
    hunger: 100,
    thirst: 100,
    alive: true,
    connected: true,
    socketIds: new Set(),
    weapon: "pistol",
    ammo: { pistol: 48, shotgun: 0, rifle: 0 },
    clipByWeapon: { pistol: 12, shotgun: 0, rifle: 0, sniper: 0 },
    inventory: Array(24).fill(null),
    kills: 0,
    lastShotAt: 0,
    reloadingUntil: 0,
    dashUntil: 0,
    dashCooldownUntil: 0,
    dashRequested: false,
    reloadRequested: false,
    input: { moveX: 0, moveZ: 0, shooting: false }
  };
}

function createSurvivalService({ io, roomName }) {
  const sessions = new Map();

  function channel(worldId) {
    return `${roomName(worldId)}:survival`;
  }

  function nextId(session, prefix) {
    session.entityCounter += 1;
    return `${prefix}-${session.entityCounter}`;
  }

  function getChunk(session, chunkX, chunkZ) {
    const maxChunk = Math.ceil(MAP_SIZE / CHUNK_SIZE) - 1;
    if (chunkX < 0 || chunkZ < 0 || chunkX > maxChunk || chunkZ > maxChunk) return null;
    const key = chunkKey(chunkX, chunkZ);
    if (!session.chunkCache.has(key)) {
      session.chunkCache.set(key, generateChunk(session.seed, chunkX, chunkZ));
    }
    return session.chunkCache.get(key);
  }

  function chunkCoordsAt(x, z) {
    return {
      x: clamp(Math.floor((x + MAP_HALF) / CHUNK_SIZE), 0, MAP_SIZE / CHUNK_SIZE - 1),
      z: clamp(Math.floor((z + MAP_HALF) / CHUNK_SIZE), 0, MAP_SIZE / CHUNK_SIZE - 1)
    };
  }

  function obstaclesAround(session, x, z, radius = 2) {
    const minChunk = chunkCoordsAt(x - radius, z - radius);
    const maxChunk = chunkCoordsAt(x + radius, z + radius);
    const obstacles = [];
    for (let chunkX = minChunk.x; chunkX <= maxChunk.x; chunkX += 1) {
      for (let chunkZ = minChunk.z; chunkZ <= maxChunk.z; chunkZ += 1) {
        const chunk = getChunk(session, chunkX, chunkZ);
        if (chunk) obstacles.push(...chunk.obstacles);
      }
    }
    return obstacles;
  }

  function hitsObstacle(session, x, z, radius) {
    return obstaclesAround(session, x, z, radius + 3).some((obstacle) => obstacleCollision(x, z, radius, obstacle));
  }

  function slowMultiplierAt(session, x, z) {
    let multiplier = 1;
    for (const obstacle of obstaclesAround(session, x, z, 1.5)) {
      if (!obstacle.slow) continue;
      const radius = obstacle.radius + PLAYER_RADIUS;
      if ((x - obstacle.x) ** 2 + (z - obstacle.z) ** 2 <= radius * radius) {
        multiplier = Math.min(multiplier, obstacle.slow);
      }
    }
    return multiplier;
  }

  function moveWithCollisions(session, entity, dx, dz, radius) {
    const limit = MAP_HALF - radius - 0.2;
    const nextX = clamp(entity.x + dx, -limit, limit);
    const nextZ = clamp(entity.z + dz, -limit, limit);
    if (!hitsObstacle(session, nextX, nextZ, radius)) {
      entity.x = nextX;
      entity.z = nextZ;
      return true;
    }
    if (!hitsObstacle(session, nextX, entity.z, radius)) {
      entity.x = nextX;
      return true;
    }
    if (!hitsObstacle(session, entity.x, nextZ, radius)) {
      entity.z = nextZ;
      return true;
    }
    return false;
  }

  function safeSpawn(session, preferredX = 0, preferredZ = 0) {
    for (let ring = 0; ring < 18; ring += 1) {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const angle = hash2d(session.seed + ring, attempt, ring) * Math.PI * 2;
        const distance = ring * 0.8;
        const x = clamp(preferredX + Math.cos(angle) * distance, -MAP_HALF + 2, MAP_HALF - 2);
        const z = clamp(preferredZ + Math.sin(angle) * distance, -MAP_HALF + 2, MAP_HALF - 2);
        if (!hitsObstacle(session, x, z, PLAYER_RADIUS + 0.2)) return { x, z };
      }
    }
    return { x: 0, z: 0 };
  }

  function createSession(worldId, user) {
    const id = crypto.randomUUID();
    const seed = seedFromString(`${id}:${Date.now()}`);
    const session = {
      id,
      worldId,
      seed,
      hostId: user.id,
      createdAt: Date.now(),
      players: new Map(),
      zombies: new Map(),
      projectiles: new Map(),
      loot: new Map(),
      chunkCache: new Map(),
      lastTickAt: Date.now(),
      lastBroadcastAt: 0,
      lastSpawnAt: 0,
      entityCounter: 0,
      emptySince: null
    };
    sessions.set(worldId, session);
    return session;
  }

  function publicState(session) {
    return {
      id: session.id,
      worldId: session.worldId,
      seed: session.seed,
      phase: "playing",
      hostId: session.hostId,
      map: { size: MAP_SIZE, halfSize: MAP_HALF, chunkSize: CHUNK_SIZE },
      players: [...session.players.values()].map(publicPlayer),
      zombies: [...session.zombies.values()].map((zombie) => ({
        id: zombie.id,
        type: zombie.type,
        x: zombie.x,
        z: zombie.z,
        hp: Math.max(0, zombie.hp),
        maxHp: zombie.maxHp,
        radius: zombie.radius,
        sleeping: zombie.sleeping,
        forestBorn: zombie.forestBorn
      })),
      projectiles: [...session.projectiles.values()].map((projectile) => ({
        id: projectile.id,
        x: projectile.x,
        z: projectile.z,
        color: projectile.color,
        hostile: projectile.hostile,
        radius: projectile.radius,
        kind: projectile.kind
      })),
      loot: [...session.loot.values()].map((item) => ({
        id: item.id,
        itemId: item.itemId,
        x: item.x,
        z: item.z,
        quantity: item.quantity,
        color: LOOT_DEFINITIONS[item.itemId]?.color || "#f8fafc"
      })),
      totalKills: [...session.players.values()].reduce((sum, player) => sum + player.kills, 0),
      serverTime: Date.now()
    };
  }

  function emitState(session) {
    io.to(channel(session.worldId)).emit("survival_state", publicState(session));
    session.lastBroadcastAt = Date.now();
  }

  function assertPlayer(session, userId) {
    const player = session?.players.get(userId);
    if (!player) throw new Error("No perteneces a este mundo survival");
    return player;
  }

  function addInventoryItem(player, itemId, quantity = 1) {
    const definition = LOOT_DEFINITIONS[itemId];
    if (!definition) return false;
    const stackable = definition.kind !== "weapon";
    if (stackable) {
      const existing = player.inventory.find((item) => item?.itemId === itemId && item.quantity < 999);
      if (existing) {
        existing.quantity = Math.min(999, existing.quantity + quantity);
        return true;
      }
    }
    const slot = player.inventory.findIndex((item) => !item);
    if (slot === -1) return false;
    player.inventory[slot] = { itemId, quantity };
    return true;
  }

  function removeInventoryItem(player, slot, quantity = 1) {
    const item = player.inventory[slot];
    if (!item) return false;
    item.quantity -= quantity;
    if (item.quantity <= 0) player.inventory[slot] = null;
    return true;
  }

  function finishReload(player, now) {
    if (!player.reloadingUntil || now < player.reloadingUntil) return;
    const weapon = WEAPONS[player.weapon];
    const current = player.clipByWeapon[player.weapon] || 0;
    const needed = weapon.magSize - current;
    const available = player.ammo[weapon.ammoType] || 0;
    const amount = Math.min(needed, available);
    player.clipByWeapon[player.weapon] = current + amount;
    player.ammo[weapon.ammoType] = available - amount;
    player.reloadingUntil = 0;
  }

  function startReload(player, now) {
    const weapon = WEAPONS[player.weapon];
    if (!weapon || player.reloadingUntil > now) return;
    if ((player.clipByWeapon[player.weapon] || 0) >= weapon.magSize) return;
    if ((player.ammo[weapon.ammoType] || 0) <= 0) return;
    player.reloadingUntil = now + weapon.reloadMs;
  }

  function createProjectile(session, data) {
    if (session.projectiles.size >= MAX_PROJECTILES) {
      const oldest = session.projectiles.keys().next().value;
      if (oldest) session.projectiles.delete(oldest);
    }
    const id = nextId(session, data.hostile ? "acid" : "shot");
    session.projectiles.set(id, {
      id,
      x: data.x,
      z: data.z,
      vx: data.vx,
      vz: data.vz,
      damage: data.damage,
      ownerId: data.ownerId,
      hostile: Boolean(data.hostile),
      radius: data.radius || 0.1,
      kind: data.kind || "bullet",
      color: data.color || "#fde68a",
      ttl: data.ttl || 2.2
    });
  }

  function shootPlayer(session, player, now) {
    if (!player.alive || !player.input.shooting || player.reloadingUntil > now) return;
    const weapon = WEAPONS[player.weapon];
    if (!weapon || now - player.lastShotAt < weapon.fireMs) return;
    const clip = player.clipByWeapon[player.weapon] || 0;
    if (clip <= 0) {
      startReload(player, now);
      return;
    }
    player.clipByWeapon[player.weapon] = clip - 1;
    player.lastShotAt = now;
    const length = Math.hypot(player.aimX, player.aimZ) || 1;
    const baseAngle = Math.atan2(player.aimZ / length, player.aimX / length);
    for (let index = 0; index < weapon.pellets; index += 1) {
      const normalized = weapon.pellets === 1 ? 0 : index / (weapon.pellets - 1) - 0.5;
      const jitter = (hash2d(session.seed + now, index, player.id) - 0.5) * weapon.spread * 0.4;
      const angle = baseAngle + normalized * weapon.spread * 2 + jitter;
      createProjectile(session, {
        x: player.x + Math.cos(angle) * 0.72,
        z: player.z + Math.sin(angle) * 0.72,
        vx: Math.cos(angle) * weapon.projectileSpeed,
        vz: Math.sin(angle) * weapon.projectileSpeed,
        damage: weapon.damage,
        ownerId: player.id,
        radius: player.weapon === "sniper" ? 0.15 : 0.09,
        kind: player.weapon,
        color: weapon.color
      });
    }
  }

  function lootRoll(session, zombie) {
    const roll = hash2d(session.seed + session.entityCounter, Math.floor(zombie.x * 10), Math.floor(zombie.z * 10));
    if (roll < 0.32) return null;
    let itemId = "wood";
    let quantity = 1;
    if (roll < 0.49) {
      itemId = "ammo_pistol";
      quantity = 8 + Math.floor(roll * 10) % 7;
    } else if (roll < 0.61) {
      itemId = "ammo_shotgun";
      quantity = 3 + Math.floor(roll * 10) % 4;
    } else if (roll < 0.75) {
      itemId = "ammo_rifle";
      quantity = 12 + Math.floor(roll * 10) % 9;
    } else if (roll < 0.84) {
      itemId = "medkit";
    } else if (roll < 0.91) {
      itemId = "metal";
      quantity = 1 + Math.floor(roll * 10) % 3;
    } else if (roll < 0.955) {
      itemId = "weapon_shotgun";
    } else if (roll < 0.988) {
      itemId = "weapon_rifle";
    } else {
      itemId = "weapon_sniper";
    }
    return { itemId, quantity };
  }

  function killZombie(session, zombie, ownerId) {
    session.zombies.delete(zombie.id);
    const owner = session.players.get(ownerId);
    if (owner) owner.kills += 1;
    const drop = lootRoll(session, zombie);
    if (drop) {
      const id = nextId(session, "loot");
      session.loot.set(id, { id, x: zombie.x, z: zombie.z, ...drop, createdAt: Date.now() });
    }
  }

  function updateProjectiles(session, dt) {
    for (const projectile of [...session.projectiles.values()]) {
      projectile.ttl -= dt;
      projectile.x += projectile.vx * dt;
      projectile.z += projectile.vz * dt;
      if (
        projectile.ttl <= 0 ||
        Math.abs(projectile.x) > MAP_HALF ||
        Math.abs(projectile.z) > MAP_HALF ||
        hitsObstacle(session, projectile.x, projectile.z, projectile.radius)
      ) {
        session.projectiles.delete(projectile.id);
        continue;
      }
      if (projectile.hostile) {
        for (const player of session.players.values()) {
          if (!player.alive) continue;
          const radius = PLAYER_RADIUS + projectile.radius;
          if (distanceSquared(projectile, player) <= radius * radius) {
            player.hp -= projectile.damage;
            if (player.hp <= 0) {
              player.hp = 0;
              player.alive = false;
              player.input.shooting = false;
            }
            session.projectiles.delete(projectile.id);
            break;
          }
        }
      } else {
        for (const zombie of session.zombies.values()) {
          const radius = zombie.radius + projectile.radius;
          if (distanceSquared(projectile, zombie) <= radius * radius) {
            zombie.hp -= projectile.damage;
            if (zombie.hp <= 0) killZombie(session, zombie, projectile.ownerId);
            session.projectiles.delete(projectile.id);
            break;
          }
        }
      }
    }
  }

  function nearestAlivePlayer(session, entity) {
    let target = null;
    let best = Infinity;
    for (const player of session.players.values()) {
      if (!player.alive) continue;
      const distance = distanceSquared(entity, player);
      if (distance < best) {
        best = distance;
        target = player;
      }
    }
    return { target, distance: Math.sqrt(best) };
  }

  function updateZombies(session, dt, now) {
    for (const zombie of session.zombies.values()) {
      const nearest = nearestAlivePlayer(session, zombie);
      zombie.sleeping = !nearest.target || nearest.distance > ACTIVE_ZOMBIE_RADIUS;
      if (zombie.sleeping) continue;
      const target = nearest.target;
      const dx = target.x - zombie.x;
      const dz = target.z - zombie.z;
      const length = Math.hypot(dx, dz) || 1;
      const nx = dx / length;
      const nz = dz / length;

      if (zombie.type === "spitter" && nearest.distance > 3.2 && nearest.distance < 10.5) {
        if (now >= zombie.spitAt) {
          zombie.spitAt = now + 1550;
          createProjectile(session, {
            x: zombie.x + nx * 0.55,
            z: zombie.z + nz * 0.55,
            vx: nx * 9,
            vz: nz * 9,
            damage: zombie.damage * 1.7,
            ownerId: zombie.id,
            hostile: true,
            radius: 0.17,
            kind: "acid",
            color: "#a3e635",
            ttl: 2.4
          });
        }
      } else if (nearest.distance > zombie.radius + PLAYER_RADIUS + 0.12) {
        const step = zombie.speed * dt;
        const moved = moveWithCollisions(session, zombie, nx * step, nz * step, zombie.radius);
        if (!moved) moveWithCollisions(session, zombie, -nz * step, nx * step, zombie.radius);
      }

      if (nearest.distance <= zombie.radius + PLAYER_RADIUS + 0.18 && now >= zombie.attackAt) {
        zombie.attackAt = now + (zombie.type === "fast" ? 620 : 880);
        target.hp -= zombie.damage;
        if (target.hp <= 0) {
          target.hp = 0;
          target.alive = false;
          target.input.shooting = false;
        }
      }
    }
  }

  function pickupLoot(session, player) {
    for (const item of [...session.loot.values()]) {
      if (distanceSquared(player, item) > 1.35 * 1.35) continue;
      const definition = LOOT_DEFINITIONS[item.itemId];
      if (!definition) {
        session.loot.delete(item.id);
        continue;
      }
      if (definition.kind === "ammo") {
        player.ammo[definition.ammoType] = (player.ammo[definition.ammoType] || 0) + item.quantity;
        session.loot.delete(item.id);
      } else if (addInventoryItem(player, item.itemId, item.quantity)) {
        session.loot.delete(item.id);
      }
    }
  }

  function respawnPlayerIfNeeded(session, player, now) {
    if (player.alive || !player.connected) return;
    if (!player.deadAt) player.deadAt = now;
    if (now - player.deadAt < 8000) return;
    const teammate = [...session.players.values()].find((candidate) => candidate.alive);
    const spawn = safeSpawn(session, teammate?.x || 0, teammate?.z || 0);
    player.x = spawn.x;
    player.z = spawn.z;
    player.vx = 0;
    player.vz = 0;
    player.hp = Math.max(45, player.maxHp * 0.45);
    player.hunger = Math.max(25, player.hunger);
    player.thirst = Math.max(25, player.thirst);
    player.alive = true;
    player.deadAt = 0;
  }

  function updatePlayers(session, dt, now) {
    for (const player of session.players.values()) {
      respawnPlayerIfNeeded(session, player, now);
      finishReload(player, now);
      if (!player.alive) continue;

      player.hunger = Math.max(0, player.hunger - dt * 0.095);
      player.thirst = Math.max(0, player.thirst - dt * 0.14);
      if (player.hunger <= 0 || player.thirst <= 0) {
        player.hp -= dt * (player.hunger <= 0 && player.thirst <= 0 ? 5 : 2.5);
        if (player.hp <= 0) {
          player.hp = 0;
          player.alive = false;
          player.deadAt = now;
          continue;
        }
      }

      let moveX = clamp(Number(player.input.moveX) || 0, -1, 1);
      let moveZ = clamp(Number(player.input.moveZ) || 0, -1, 1);
      const inputLength = Math.hypot(moveX, moveZ);
      if (inputLength > 1) {
        moveX /= inputLength;
        moveZ /= inputLength;
      }

      if (player.dashRequested && now >= player.dashCooldownUntil) {
        player.dashRequested = false;
        player.dashUntil = now + 400;
        player.dashCooldownUntil = now + 2000;
        const directionLength = Math.hypot(moveX, moveZ);
        if (directionLength > 0.05) {
          player.vx = (moveX / directionLength) * 12.5;
          player.vz = (moveZ / directionLength) * 12.5;
        }
      } else {
        player.dashRequested = false;
      }
      if (player.reloadRequested) {
        player.reloadRequested = false;
        startReload(player, now);
      }

      const dashing = now < player.dashUntil;
      const maxSpeed = dashing ? 12.5 : 5.4;
      const acceleration = dashing ? 40 : 19;
      const friction = inputLength > 0.03 ? 4.5 : 13;
      if (inputLength > 0.03) {
        player.vx += moveX * acceleration * dt;
        player.vz += moveZ * acceleration * dt;
      }
      const frictionFactor = Math.max(0, 1 - friction * dt);
      player.vx *= frictionFactor;
      player.vz *= frictionFactor;
      const speed = Math.hypot(player.vx, player.vz);
      if (speed > maxSpeed) {
        player.vx = (player.vx / speed) * maxSpeed;
        player.vz = (player.vz / speed) * maxSpeed;
      }

      const bushSlow = dashing ? 1 : slowMultiplierAt(session, player.x, player.z);
      const moved = moveWithCollisions(
        session,
        player,
        player.vx * dt * bushSlow,
        player.vz * dt * bushSlow,
        PLAYER_RADIUS
      );
      if (!moved) {
        player.vx *= 0.25;
        player.vz *= 0.25;
      }

      shootPlayer(session, player, now);
      pickupLoot(session, player);
    }
  }

  function zombieTypeFor(session, x, z) {
    const roll = hash2d(session.seed + session.entityCounter, Math.floor(x), Math.floor(z));
    if (roll > 0.91) return "tank";
    if (roll > 0.72) return "spitter";
    if (roll > 0.44) return "fast";
    return "normal";
  }

  function findZombieSpawn(session) {
    const alivePlayers = [...session.players.values()].filter((player) => player.alive);
    const anchor = alivePlayers[Math.floor(hash2d(session.seed, session.entityCounter, alivePlayers.length) * alivePlayers.length)];
    if (!anchor) return null;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const random = hash2d(session.seed + 7001, session.entityCounter, attempt);
      const angle = random * Math.PI * 2;
      const distance = 26 + hash2d(session.seed + 7002, attempt, session.entityCounter) * 16;
      let x = anchor.x + Math.cos(angle) * distance;
      let z = anchor.z + Math.sin(angle) * distance;

      const preferMapEdge = session.entityCounter % 6 === 0 && attempt === 0;
      if (preferMapEdge) {
        const lane = -MAP_HALF + 2 + hash2d(session.seed + 7020, session.entityCounter, attempt) * (MAP_SIZE - 4);
        const side = Math.floor(hash2d(session.seed + 7021, attempt, session.entityCounter) * 4);
        x = side === 0 ? -MAP_HALF + 1 : side === 1 ? MAP_HALF - 1 : lane;
        z = side === 2 ? -MAP_HALF + 1 : side === 3 ? MAP_HALF - 1 : lane;
      }

      const preferForest = !preferMapEdge && attempt % 3 === 0;
      if (preferForest) {
        for (let probe = 0; probe < 6; probe += 1) {
          const px = x + (hash2d(session.seed + 7010, attempt, probe) - 0.5) * 18;
          const pz = z + (hash2d(session.seed + 7011, probe, attempt) - 0.5) * 18;
          if (biomeAt(session.seed, px, pz).forest > 0.62) {
            x = px;
            z = pz;
            break;
          }
        }
      }

      x = clamp(x, -MAP_HALF + 1, MAP_HALF - 1);
      z = clamp(z, -MAP_HALF + 1, MAP_HALF - 1);
      if (!hitsObstacle(session, x, z, 0.75)) return { x, z };
    }
    return null;
  }

  function spawnContinuousZombies(session, now) {
    if (now - session.lastSpawnAt < 720) return;
    session.lastSpawnAt = now;
    const connected = [...session.players.values()].filter((player) => player.connected).length || 1;
    const desired = Math.min(MAX_ZOMBIES, 24 + connected * 12);
    if (session.zombies.size >= desired) return;
    const spawn = findZombieSpawn(session);
    if (!spawn) return;
    const type = zombieTypeFor(session, spawn.x, spawn.z);
    const base = ZOMBIE_TYPES[type];
    const biome = biomeAt(session.seed, spawn.x, spawn.z);
    const forestBorn = biome.forest > 0.58;
    const id = nextId(session, "zombie");
    const hpMultiplier = forestBorn ? 1.45 : 1;
    session.zombies.set(id, {
      id,
      type,
      x: spawn.x,
      z: spawn.z,
      hp: Math.round(base.hp * hpMultiplier),
      maxHp: Math.round(base.hp * hpMultiplier),
      speed: base.speed * (forestBorn ? 1.08 : 1),
      damage: base.damage * (forestBorn ? 1.35 : 1),
      radius: base.radius,
      attackAt: 0,
      spitAt: now + 900,
      sleeping: false,
      forestBorn
    });
  }

  function updateSession(session, dt, now) {
    updatePlayers(session, dt, now);
    spawnContinuousZombies(session, now);
    updateZombies(session, dt, now);
    updateProjectiles(session, dt);
    for (const item of [...session.loot.values()]) {
      if (now - item.createdAt > 120_000) session.loot.delete(item.id);
    }
  }

  const interval = setInterval(() => {
    const now = Date.now();
    for (const session of sessions.values()) {
      const dt = clamp((now - session.lastTickAt) / 1000, 0, 0.05);
      session.lastTickAt = now;
      updateSession(session, dt, now);
      const hasConnected = [...session.players.values()].some((player) => player.connected);
      if (!hasConnected) {
        session.emptySince ||= now;
        if (now - session.emptySince > 60_000) {
          sessions.delete(session.worldId);
          continue;
        }
      } else {
        session.emptySince = null;
      }
      if (now - session.lastBroadcastAt >= BROADCAST_MS) emitState(session);
    }
  }, TICK_MS);
  interval.unref?.();

  return {
    channel,
    getPublicState(worldId) {
      const session = sessions.get(worldId);
      return session ? publicState(session) : null;
    },
    join({ worldId, user, socketId }) {
      let session = sessions.get(worldId);
      if (!session) session = createSession(worldId, user);
      let player = session.players.get(user.id);
      if (!player) {
        if (session.players.size >= MAX_PLAYERS) {
          return { state: publicState(session), spectating: true };
        }
        player = createPlayer(user, session.players.size);
        const spawn = safeSpawn(session, player.x, player.z);
        player.x = spawn.x;
        player.z = spawn.z;
        session.players.set(user.id, player);
      }
      player.socketIds.add(socketId);
      player.connected = true;
      session.emptySince = null;
      emitState(session);
      return { state: publicState(session), spectating: false };
    },
    leave({ worldId, userId, socketId }) {
      const session = sessions.get(worldId);
      if (!session) return null;
      const player = session.players.get(userId);
      if (!player) return publicState(session);
      player.socketIds.delete(socketId);
      player.connected = player.socketIds.size > 0;
      player.input = { moveX: 0, moveZ: 0, shooting: false };
      if (!player.connected && session.hostId === userId) {
        session.hostId = [...session.players.values()].find((candidate) => candidate.connected)?.id || userId;
      }
      emitState(session);
      return publicState(session);
    },
    input({ worldId, userId, input }) {
      const session = sessions.get(worldId);
      const player = assertPlayer(session, userId);
      player.input.moveX = clamp(Number(input?.moveX) || 0, -1, 1);
      player.input.moveZ = clamp(Number(input?.moveZ) || 0, -1, 1);
      player.input.shooting = Boolean(input?.shooting);
      const aimX = Number(input?.aimX);
      const aimZ = Number(input?.aimZ);
      if (Number.isFinite(aimX) && Number.isFinite(aimZ)) {
        const dx = aimX - player.x;
        const dz = aimZ - player.z;
        const length = Math.hypot(dx, dz);
        if (length > 0.02) {
          player.aimX = dx / length;
          player.aimZ = dz / length;
        }
      }
      if (input?.dash) player.dashRequested = true;
      if (input?.reload) player.reloadRequested = true;
    },
    getChunks({ worldId, keys }) {
      const session = sessions.get(worldId);
      if (!session) throw new Error("Mundo survival no encontrado");
      return (Array.isArray(keys) ? keys : []).slice(0, 36).map((key) => {
        const [chunkX, chunkZ] = String(key).split(":").map(Number);
        return getChunk(session, chunkX, chunkZ);
      }).filter(Boolean);
    },
    equip({ worldId, userId, slot }) {
      const session = sessions.get(worldId);
      const player = assertPlayer(session, userId);
      const index = Number(slot);
      const item = player.inventory[index];
      const definition = item && LOOT_DEFINITIONS[item.itemId];
      if (!definition || definition.kind !== "weapon") throw new Error("Ese slot no contiene un arma");
      player.weapon = definition.weaponId;
      player.clipByWeapon[player.weapon] ||= 0;
      emitState(session);
      return publicPlayer(player);
    },
    useItem({ worldId, userId, slot }) {
      const session = sessions.get(worldId);
      const player = assertPlayer(session, userId);
      const index = Number(slot);
      const item = player.inventory[index];
      const definition = item && LOOT_DEFINITIONS[item.itemId];
      if (!definition) throw new Error("Slot vacío");
      if (definition.kind === "weapon") {
        player.weapon = definition.weaponId;
        player.clipByWeapon[player.weapon] ||= 0;
      } else if (definition.id === "medkit") {
        if (player.hp >= player.maxHp) throw new Error("Tu vida ya está completa");
        player.hp = Math.min(player.maxHp, player.hp + 50);
        removeInventoryItem(player, index, 1);
      } else {
        throw new Error("Este objeto todavía no se puede usar");
      }
      emitState(session);
      return publicPlayer(player);
    }
  };
}

module.exports = {
  CHUNK_SIZE,
  LOOT_DEFINITIONS,
  MAP_HALF,
  MAP_SIZE,
  WEAPONS,
  ZOMBIE_TYPES,
  biomeAt,
  createSurvivalService,
  generateChunk,
  obstacleCollision
};
