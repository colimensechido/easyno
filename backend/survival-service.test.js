const test = require("node:test");
const assert = require("node:assert/strict");
const {
  biomeAt,
  generateChunk,
  obstacleCollision
} = require("./survival-service");

test("los chunks procedurales son deterministas para una misma semilla", () => {
  assert.deepEqual(generateChunk(2026, 10, 10), generateChunk(2026, 10, 10));
  assert.notDeepEqual(generateChunk(2026, 10, 10), generateChunk(2027, 10, 10));
});

test("la distribución orgánica produce los tres biomas", () => {
  const counts = { forest: 0, city: 0, field: 0 };
  for (let x = -100; x < 100; x += 1) {
    for (let z = -100; z < 100; z += 1) {
      counts[biomeAt(2026, x, z).dominant] += 1;
    }
  }
  assert.ok(counts.forest / 40000 > 0.35 && counts.forest / 40000 < 0.45);
  assert.ok(counts.city / 40000 > 0.3 && counts.city / 40000 < 0.4);
  assert.ok(counts.field / 40000 > 0.2 && counts.field / 40000 < 0.3);
});

test("las colisiones respetan obstáculos sólidos y arbustos transitables", () => {
  const building = {
    x: 4,
    z: 4,
    width: 4,
    depth: 4,
    height: 5,
    radius: 2,
    type: "building",
    solid: true
  };
  const bush = { x: 0, z: 0, radius: 1, type: "bush", solid: false };
  assert.equal(obstacleCollision(4, 4, 0.5, building), true);
  assert.equal(obstacleCollision(0, 0, 0.5, building), false);
  assert.equal(obstacleCollision(0, 0, 0.5, bush), false);
});
