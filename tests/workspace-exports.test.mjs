import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('workspace facade preserves the slice hook used by company and application clients', async () => {
  const source = await readFile(new URL('../next-app/lib/workspace.jsx', import.meta.url), 'utf8');
  const exports = source.match(/export\s*\{([^}]+)\}\s*from\s*['"]\.\/workspace-context\.jsx['"]/);
  assert.ok(exports);
  for (const name of ['asset', 'useSlice', 'useWorkspace']) {
    assert.ok(exports[1].split(',').map(value => value.trim()).includes(name), `${name} remains exported`);
  }
});
