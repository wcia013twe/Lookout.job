// Maintainer utility. Public branding only; never called by an agent's job scan.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const PROJECT_URL = 'https://umhqfqzpwmszhcknwtrs.supabase.co';
export const BUCKET = 'company-logos';
const PNG_HEADER = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function imageFormat(bytes) {
  if (bytes.subarray(0, 8).equals(PNG_HEADER)) return { extension: 'png', contentType: 'image/png' };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { extension: 'jpg', contentType: 'image/jpeg' };
  throw new Error('Unsupported branding image signature');
}

export async function buildManifest(manifest, readAsset, projectUrl = PROJECT_URL) {
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(projectUrl)) throw new Error('Use an HTTPS Supabase project URL');
  const result = {};
  for (const [name, entry] of Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))) {
    const local = typeof entry === 'string' ? entry : entry.local;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || !/^assets\/logos\/[a-z0-9-]+\.png$/.test(local)) throw new Error('Invalid branding manifest entry');
    const bytes = Buffer.from(await readAsset(local));
    if (bytes.length > 1048576) throw new Error(`Oversized image: ${name}`);
    const { extension, contentType } = imageFormat(bytes);
    const hash = sha256(bytes);
    result[name] = { url: `${projectUrl}/storage/v1/object/public/${BUCKET}/${name}/${hash.slice(0, 16)}.${extension}`, local, sha256: hash, contentType };
  }
  return result;
}

async function main() {
  const mode = process.argv[2];
  if (!['--upload', '--verify'].includes(mode)) throw new Error('Usage: node scripts/company-logo-cache.mjs --upload|--verify');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const manifestPath = resolve(root, 'data/logo-manifest.json');
  const manifest = await buildManifest(JSON.parse(await readFile(manifestPath, 'utf8')), local => readFile(resolve(root, local)), process.env.SUPABASE_URL || PROJECT_URL);
  if (mode === '--upload') {
    // This key belongs only in a maintainer environment, never in the frontend or MCP config.
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for maintenance uploads');
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(process.env.SUPABASE_URL || PROJECT_URL, key, { auth: { persistSession: false } });
    for (const [name, entry] of Object.entries(manifest)) {
      const path = new URL(entry.url).pathname.split(`/public/${BUCKET}/`)[1];
      const { error } = await client.storage.from(BUCKET).upload(path, await readFile(resolve(root, entry.local)), { contentType: entry.contentType, cacheControl: '31536000', upsert: true });
      if (error) throw new Error(`Upload failed for ${name}: ${error.message}`);
    }
  }
  // Publish the lookup only after every cached asset actually matches the local content.
  for (const [name, entry] of Object.entries(manifest)) {
    const response = await fetch(entry.url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok || !response.headers.get('content-type')?.startsWith(entry.contentType) || sha256(Buffer.from(await response.arrayBuffer())) !== entry.sha256) throw new Error(`Cache verification failed: ${name}`);
  }
  if (mode === '--upload') await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Verified ${Object.keys(manifest).length} public company logos${mode === '--upload' ? '; lookup updated' : ''}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
