function normalizeRoleKey(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function isExplicitAdminUsername(username) {
  return normalizeUsername(username) === "colimense";
}

function resolveEffectiveRoles(persistedRoles = [], username) {
  const roles = new Set(["user"]);
  (Array.isArray(persistedRoles) ? persistedRoles : [])
    .map(normalizeRoleKey)
    .filter(Boolean)
    .forEach((role) => roles.add(role));

  if (isExplicitAdminUsername(username)) {
    roles.add("admin");
  }

  return Array.from(roles).sort((left, right) => {
    if (left === "user") return -1;
    if (right === "user") return 1;
    if (left === "admin") return -1;
    if (right === "admin") return 1;
    return left.localeCompare(right);
  });
}

module.exports = {
  normalizeRoleKey,
  normalizeUsername,
  isExplicitAdminUsername,
  resolveEffectiveRoles
};
