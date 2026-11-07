import {execFile,spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createConnection} from 'node:net';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';

// Bound dependency commands, not the long-running frontend. Captured Supabase
// output can contain keys; never echo it in startup messages or errors.
export function runCommand(file,args,{cwd,timeout=10000}={}) {
 return new Promise((yes,no)=>execFile(file,args,{cwd,timeout,killSignal:'SIGKILL',maxBuffer:2*1024*1024},(error,stdout)=>{
  if(error){const failure=new Error(error.killed?`${file} timed out`:`${file} failed`);failure.code=error.code;failure.timedOut=!!error.killed;no(failure);}
  else yes(stdout);
 }));
}
export function devPort(value=process.env.PORT||'3000') {
 const port=Number(value);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be an integer between 1 and 65535.');
 return port;
}
export async function probeFrontend(port,request=fetch) {
 const busy=await new Promise(yes=>{
  const socket=createConnection({host:'127.0.0.1',port});
  const finish=value=>{socket.destroy();yes(value);};
  socket.setTimeout(1000,()=>finish(false));socket.once('connect',()=>finish(true));socket.once('error',()=>finish(false));
 });
 if(!busy)return 'free';
 try{
  const response=await request(`http://127.0.0.1:${port}`,{signal:AbortSignal.timeout(5000),redirect:'error'});
  // Avoid downloading a whole stream merely to identify the frontend title.
  const reader=response.body?.getReader();let html='';
  if(reader){try{while(html.length<65536){const part=await reader.read();if(part.done)break;html+=new TextDecoder().decode(part.value);if(/<title>[^<]*<\/title>/i.test(html))break;}}finally{await reader.cancel();}}
  return response.ok&&/<title>Lookout<\/title>/i.test(html)?'lookout':'busy';
 }catch{return 'busy';}
}
// Saved values are only a fallback for an already-running local backend.
// Never infer readiness from an environment file or forward a service-role key.
export async function savedLocalConfig({cwd,read=readFile,request=fetch,env=process.env}) {
 let values={};
 for(const file of ['.env.local','next-app/.env.local']){
  try{values={...values,...parseEnv(await read(resolve(cwd,file),'utf8'))};}catch(error){if(error.code!=='ENOENT')throw error;}
 }
 values={...values,...env};
 const key=values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||values.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 try{
  const url=new URL(values.NEXT_PUBLIC_SUPABASE_URL);
  if(url.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!key)return null;
  if(!key.startsWith('sb_publishable_')){
   const claims=JSON.parse(Buffer.from(key.split('.')[1]||'','base64url').toString());
   if(claims.role!=='anon')return null;
  }
  const health=await request(url.origin+'/auth/v1/health',{headers:{apikey:key},signal:AbortSignal.timeout(3000),redirect:'error'});
  if(!health.ok||(await health.json()).name!=='GoTrue')return null;
  const rest=await request(url.origin+'/rest/v1/',{headers:{apikey:key},signal:AbortSignal.timeout(3000),redirect:'error'});
  const ready=rest.ok;await rest.body?.cancel();
  return ready?{API_URL:url.origin,ANON_KEY:key}:null;
 }catch{return null;}
}
export async function startServices({cwd,run=runCommand,log=console.log,saved=()=>savedLocalConfig({cwd})}) {
 const existing=await saved();
 if(existing){log('Local Supabase Auth and REST are responding; reusing saved public configuration without restarting services.');return existing;}
 log('Checking Docker (10-second limit)…');
 try{await run('docker',['info','--format','{{.ServerVersion}}'],{cwd,timeout:10000});}
 catch(error){throw Error(error.timedOut?'Docker did not respond within 10 seconds. Restart Docker Desktop, then retry. Existing services were left unchanged.':'Docker is unavailable. Start Docker Desktop, then retry.');}
 const status=async()=>{
  const data=JSON.parse(await run('supabase',['status','-o','json'],{cwd,timeout:10000}));
  if(!data.API_URL||!data.ANON_KEY||!['localhost','127.0.0.1','[::1]'].includes(new URL(data.API_URL).hostname))throw Error('Invalid local service configuration');
  return data;
 };
 try{const config=await status();log('Local Supabase is already running; reusing it.');return config;}
 catch(error){if(error.code==='ENOENT')throw Error('Install the Supabase CLI, then retry.');if(error.timedOut)throw Error('Supabase status did not respond within 10 seconds. Check Docker Desktop; no restart was attempted.');}
 log('Starting local Supabase (3-minute limit; first startup may download images)…');
 let config;
 const progress=setInterval(()=>log('Still starting local Supabase; the 3-minute startup limit is active…'),10000);
 try{await run('supabase',['start'],{cwd,timeout:180000});config=await status();}
 catch(error){throw Error(error.timedOut?'Local Supabase startup timed out. Inspect Docker Desktop and run make status before retrying; partially started services were not removed.':'Local Supabase could not start. Run supabase start --debug for details; existing data was preserved.');}
 finally{clearInterval(progress);}
 log('Local Supabase is ready.');return config;
}
export async function startTunnel({cwd,run=runCommand,read=readFile,log=console.log,env=process.env}) {
 const envFile=env.MUSE_DEV_ENV||'.env.local';let settings;
 try{settings={...parseEnv(await read(resolve(cwd,envFile),'utf8')),...env};}
 catch(error){if(error.code!=='ENOENT')throw error;settings=env;}
 if(!settings.NGROK_AUTHTOKEN||!settings.NGROK_URL){log('MCP tunnel skipped: ngrok is not configured. The local frontend can still run.');return;}
 log('Starting configured MCP tunnel (30-second limit)…');
 try{await run('docker',['info','--format','{{.ServerVersion}}'],{cwd,timeout:3000});await run('docker',['compose','--env-file',envFile,'-f','backend/runtime/compose.muse-dev.yaml','--profile','muse-dev','up','-d','tunnel'],{cwd,timeout:30000});}
 catch{log('MCP tunnel could not start; continuing locally. Use make muse-dev to retry or make muse-dev-logs for details.');}
}
export async function launchFrontend(cwd,run=runCommand,config=null) {
 const branch=(await run('git',['branch','--show-current'],{cwd,timeout:5000})).trim();
 return new Promise((yes,no)=>{
  const child=spawn(process.execPath,[branch==='main'?'scripts/live-main.mjs':'scripts/local-frontend.mjs'],{cwd,stdio:'inherit',env:{...process.env,...(config?{NEXT_PUBLIC_SUPABASE_URL:config.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:config.ANON_KEY,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.ANON_KEY}:{})}});
  const interrupt=signal=>child.kill(signal);
  const onInt=()=>interrupt('SIGINT'),onTerm=()=>interrupt('SIGTERM');
  process.on('SIGINT',onInt);process.on('SIGTERM',onTerm);
  const cleanup=()=>{process.off('SIGINT',onInt);process.off('SIGTERM',onTerm);};
  child.once('error',error=>{cleanup();no(error);});
  child.once('exit',(code,signal)=>{cleanup();if(code===0||signal==='SIGINT'||signal==='SIGTERM')yes();else no(Error('Frontend stopped. See the startup message above.'));});
 });
}
export async function startLocal({mode='dev',cwd=process.cwd(),port=devPort(),probe=probeFrontend,run=runCommand,read=readFile,log=console.log,launch=launchFrontend,saved=()=>savedLocalConfig({cwd,read})}={}) {
 if(!['dev','services','frontend'].includes(mode))throw Error('Use local-startup.mjs dev, services or frontend.');
 if(mode!=='services'){
  const state=await probe(port);
  if(state==='lookout'){log(`Lookout is already running at http://localhost:${port}. Existing frontend and backend were left unchanged. Use make services to check the backend separately.`);return;}
  if(state==='busy')throw Error(`Port ${port} is already in use. No process was stopped. Use the existing server or choose another port, for example PORT=3001 make dev.`);
 }
 const config=mode==='frontend'?await saved():await startServices({cwd,run,log,saved});
 if(mode==='services')return;
 if(mode==='dev')await startTunnel({cwd,run,read,log});
 log(`Starting frontend at http://localhost:${port} (Ctrl-C stops this frontend only)…`);
 await launch(cwd,run,config);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await startLocal({mode:process.argv[2]||'dev'});}catch(error){console.error(error.message);process.exitCode=1;}
}
