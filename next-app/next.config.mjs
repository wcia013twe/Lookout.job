import { fileURLToPath } from "node:url";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
export default { outputFileTracingRoot: fileURLToPath(new URL('../', import.meta.url)), output: 'export', trailingSlash: true, basePath, poweredByHeader: false, experimental: { agentUpgrade: 'security' } };
