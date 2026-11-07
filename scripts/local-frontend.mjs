import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {publicPreviewEnv} from './live-main.mjs';
import {savedLocalConfig} from './local-startup.mjs';

const cwd = fileURLToPath(new URL('../', import.meta.url));
let config;
config=await savedLocalConfig({cwd});
try {
  if(!config)config = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], {
    cwd, encoding: 'utf8', timeout:10000, killSignal:'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'],
  }));
} catch (error) {
  console.error(error.killed?'Supabase status did not respond within 10 seconds. Check Docker Desktop, then retry.':'Local services are unavailable. Run make services first.');
  process.exit(1);
}
// Select only browser-safe values; never pass the CLI service-role key to Next.js.
if (!config.API_URL || !config.ANON_KEY ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(config.API_URL).hostname)) {
  console.error('Expected a local API URL and anonymous key from supabase status.');
  process.exit(1);
}
const child = spawn('npm', ['--prefix', 'next-app', 'run', 'dev', '--', '--hostname', '127.0.0.1', '--port', process.env.PORT || '3000'], {
  cwd, stdio: 'inherit', env: {
    ...process.env,
    ...await publicPreviewEnv(cwd,{local:true}),
    NEXT_PUBLIC_BASE_PATH: '',
    NEXT_PUBLIC_SUPABASE_URL: config.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: config.ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.ANON_KEY,
  },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1); });
