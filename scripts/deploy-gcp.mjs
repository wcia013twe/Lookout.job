import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, openSync, closeSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const infra = join(root, 'infra/gcp');
// Explicit committed paths exclude the downloaded SDK, credentials, account data,
// Terraform state and unrelated local files from the upload and Docker context.
export const sourcePaths = ['.dockerignore', 'package.json', 'package-lock.json', 'backend/runtime', 'supabase/functions', 'lib', 'runner', 'infra/gcp/compose.yaml', 'infra/gcp/Caddyfile', 'infra/gcp/deploy-remote.sh'];

export function validateRuntimeEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match || Object.hasOwn(values, match[1])) throw Error('Use unique plain KEY=value lines in the runtime env file.');
    values[match[1]] = match[2];
  }
  const host = values.LOOKOUT_API_HOST;
  if (!host || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(host) || host.endsWith('.example.com')) throw Error('Set LOOKOUT_API_HOST to your real DNS hostname.');
  let url;
  try { url = new URL(values.SUPABASE_URL); } catch { throw Error('Set the hosted SUPABASE_URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || url.pathname !== '/' || !url.hostname.endsWith('.supabase.co')) throw Error('Use a hosted Supabase project URL, not the local Docker database.');
  if (!values.SUPABASE_SERVICE_ROLE_KEY || /\s|["']/.test(values.SUPABASE_SERVICE_ROLE_KEY)) throw Error('Set the server-only Supabase service-role key without quotes.');
  const hosts = (values.LOOKOUT_ALLOWED_HOSTS || '').split(',').map(v => v.trim());
  if (![host, '127.0.0.1'].every(v => hosts.includes(v))) throw Error('Allowed hosts must include your API hostname and 127.0.0.1 for health checks.');
  const origins = (values.LOOKOUT_ALLOWED_ORIGINS || '').split(',');
  if (!origins.length || origins.some(origin => { try { const u = new URL(origin); return u.protocol !== 'https:' || u.origin !== origin; } catch { return true; } })) throw Error('Allowed origins must be exact HTTPS website origins, without a path or trailing slash.');
  if (!['false', 'true'].includes(values.LOOKOUT_EXECUTION_ENABLED)) throw Error('Set LOOKOUT_EXECUTION_ENABLED explicitly to true or false.');
  if (values.LOOKOUT_SUBMISSION_ENABLED !== 'false') throw Error('This initial deployment requires LOOKOUT_SUBMISSION_ENABLED=false; browser submission needs separate verification.');
  return {host};
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {cwd: root, encoding: 'utf8', ...options});
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`${command} failed (${result.status}). ${typeof result.stderr === 'string' ? result.stderr : ''}`);
  return result.stdout?.trim();
}

export function deploy(envPath) {
  if (!envPath) throw Error('Usage: node scripts/deploy-gcp.mjs /absolute/path/to/.env.gcp.local');
  const env = readFileSync(resolve(envPath), 'utf8');
  const {host} = validateRuntimeEnv(env);
  if (run('git', ['branch', '--show-current']) !== 'main') throw Error('Deploy committed, landed local main.');
  run('git', ['diff', '--quiet', 'HEAD', '--', ...sourcePaths]);
  const revision = run('git', ['rev-parse', 'HEAD']);
  if (!/^[a-f0-9]{40}$/.test(revision)) throw Error('Invalid source revision.');
  const output = JSON.parse(run('terraform', [`-chdir=${infra}`, 'output', '-json']));
  const project = output.project_id?.value, zone = output.zone?.value, instance = output.instance_name?.value;
  if (![project, zone, instance].every(v => typeof v === 'string' && /^[a-z0-9-]+$/.test(v))) throw Error('Apply Terraform first; expected project, zone and VM outputs.');
  const gcloud = process.env.GCLOUD || 'gcloud';
  const common = [`--project=${project}`, `--zone=${zone}`, '--tunnel-through-iap'];
  const ssh = (command, options = {}) => run(gcloud, ['compute', 'ssh', instance, ...common, `--command=${command}`], options);
  ssh('sudo test -f /opt/lookout/bootstrap-ready');
  const temporary = mkdtempSync(join(tmpdir(), 'lookout-gcp-'));
  const archive = join(temporary, `lookout-${revision}.tar`);
  try {
    const fd = openSync(archive, 'w', 0o600);
    try { run('git', ['archive', '--format=tar', revision, ...sourcePaths], {stdio: ['ignore', fd, 'inherit']}); }
    finally { closeSync(fd); }
    run(gcloud, ['compute', 'scp', archive, `${instance}:lookout-${revision}.tar`, ...common], {stdio: 'inherit'});
    // SSH carries secrets on stdin. No secret is placed in shell arguments,
    // Terraform state, metadata, the source archive or a Docker image layer.
    ssh("sudo sh -c 'umask 077; cat > /etc/lookout/runtime.env'", {input: env});
    ssh(`sudo install -d /opt/lookout/releases/${revision} && sudo tar -xf lookout-${revision}.tar -C /opt/lookout/releases/${revision} && sudo bash /opt/lookout/releases/${revision}/infra/gcp/deploy-remote.sh ${revision} ${host} && rm lookout-${revision}.tar`, {stdio: 'inherit'});
    console.log(`Deployed ${revision}. Check https://${host}/healthz, then authenticated MCP and one bounded discovery job.`);
  } finally { rmSync(temporary, {recursive: true, force: true}); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { deploy(process.argv[2]); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
