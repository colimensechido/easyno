const path = require("path");

/**
 * Resuelve modulos en /shared tanto en desarrollo (backend/../shared)
 * como en Docker (WORKDIR /app + COPY shared -> /app/shared).
 */
function loadShared(moduleName) {
  const candidates = [
    path.join(__dirname, "shared", moduleName),
    path.join(__dirname, "..", "shared", moduleName)
  ];

  let lastError;
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      if (error?.code !== "MODULE_NOT_FOUND") throw error;
      lastError = error;
    }
  }

  throw lastError || new Error(`Shared module not found: ${moduleName}`);
}

module.exports = { loadShared };
