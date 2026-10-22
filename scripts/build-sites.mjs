import { spawnSync } from 'node:child_process';
import { cp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
  cwd: root,
  env: { ...process.env, NEXT_PUBLIC_BASE_PATH: '' },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
// Sites accepts a root-level static directory; retain the normal Pages export.
await readFile(new URL('../next-app/out/index.html', import.meta.url));
await rm(new URL('../out/', import.meta.url), { recursive: true, force: true });
await cp(new URL('../next-app/out/', import.meta.url), new URL('../out/', import.meta.url), { recursive: true });
console.log('Prepared Sites static assets in out/ with no Pages URL prefix.');
