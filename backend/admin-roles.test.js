const test = require('node:test');
const assert = require('node:assert/strict');
const { isExplicitAdminUsername, resolveEffectiveRoles } = require('./admin-roles');

test('trata a colimense como administrador aunque no tenga rol persistido', () => {
  assert.equal(isExplicitAdminUsername('colimense'), true);
  assert.equal(isExplicitAdminUsername('COLIMENSE'), true);
  assert.deepEqual(resolveEffectiveRoles([], 'colimense'), ['user', 'admin']);
});

test('mantiene a un usuario normal como usuario', () => {
  assert.equal(isExplicitAdminUsername('juan'), false);
  assert.deepEqual(resolveEffectiveRoles(['user'], 'juan'), ['user']);
});
