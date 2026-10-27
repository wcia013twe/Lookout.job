import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
// One local config; only public settings enter the frontend process here.
const localEnv = new URL('../.env.local', import.meta.url);
if (existsSync(localEnv)) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(localEnv, 'utf8')))) {
    if (key.startsWith('NEXT_PUBLIC_') && process.env[key] === undefined) process.env[key] = value;
  }
}
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
export default { allowedDevOrigins: ['localhost', '127.0.0.1'], outputFileTracingRoot: fileURLToPath(new URL('../', import.meta.url)), output: 'export', trailingSlash: true, basePath, poweredByHeader: false, experimental: { agentUpgrade: 'security' } };
