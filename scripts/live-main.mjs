import {execFile, spawn} from 'node:child_process';
import {promisify,parseEnv} from 'node:util';
import {mkdir, readFile, access, rmdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const exec=promisify(execFile);
const run=async(file,args,cwd)=>(await exec(file,args,{cwd,maxBuffer:4*1024*1024})).stdout.trim();

export async function sourceCheckout(cwd, execute=run) {
 const root=await execute('git',['rev-parse','--show-toplevel'],cwd);
 try {return JSON.parse(await readFile(join(root,'.git/codex-feature.json'),'utf8')).sourceCheckout||root;}
 catch {return root;}
}

// Copy only browser configuration; never forward unrelated private credentials.
export async function publicPreviewEnv(source,{local=false}={}){
 let ngrokUrl;
 const result={};
 for(const file of ['.env.local','next-app/.env.local']){
  try{
   const values=parseEnv(await readFile(join(source,file),'utf8'));
   if(values.NEXT_PUBLIC_GEOAPIFY_API_KEY||values.GEOIFY_API)result.NEXT_PUBLIC_GEOAPIFY_API_KEY=values.NEXT_PUBLIC_GEOAPIFY_API_KEY||values.GEOIFY_API;
   if(values.NEXT_PUBLIC_LOOKOUT_API_URL)result.NEXT_PUBLIC_LOOKOUT_API_URL=values.NEXT_PUBLIC_LOOKOUT_API_URL;
   if(values.NEXT_PUBLIC_AGENT_MCP_URL)result.NEXT_PUBLIC_AGENT_MCP_URL=values.NEXT_PUBLIC_AGENT_MCP_URL;
   if(local&&values.NGROK_URL)ngrokUrl=values.NGROK_URL;
  }catch(error){if(error.code!=='ENOENT')throw error;}
 }
 if(ngrokUrl){
  const url=new URL(ngrokUrl);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw Error('NGROK_URL must be an HTTPS base URL without a path or credentials.');
  result.NEXT_PUBLIC_AGENT_MCP_URL=url.origin+'/mcp';
 }
 return result;
}

// The preview owns this clone. Never sync into a task checkout or discard edits.
export async function syncMain(source, preview, execute=run) {
 if(await execute('git',['branch','--show-current'],source)!=='main')throw Error('Shared checkout must be on main.');
 const target=await execute('git',['rev-parse','main'],source);
 const current=await execute('git',['rev-parse','HEAD'],preview);
 if(current===target)return {changed:false,dependencies:false};
 if(await execute('git',['status','--porcelain'],preview))throw Error('Live preview has local edits; preserve them before syncing.');
 await execute('git',['fetch',source,'main'],preview);
 // Check ancestry before touching files; a rewritten main requires human review.
 await execute('git',['merge-base','--is-ancestor',current,'FETCH_HEAD'],preview);
 const files=await execute('git',['diff','--name-only',current,'FETCH_HEAD'],preview);
 await execute('git',['merge','--ff-only','FETCH_HEAD'],preview);
 return {changed:true,dependencies:files.split('\n').some(p=>['package.json','package-lock.json','next-app/package.json','next-app/package-lock.json'].includes(p))};
}

async function main(){
 const source=await sourceCheckout(process.cwd());
 const home=process.env.LOOKOUT_LIVE_ROOT||'/Volumes/External SSD/Lookout/live-main';
 if(!process.env.LOOKOUT_LIVE_ROOT)await access('/Volumes/External SSD/Lookout');
 const parent=join(home,createHash('sha256').update(source).digest('hex').slice(0,12));
 const preview=join(parent,'repo');
 await mkdir(parent,{recursive:true});
 const lock=join(parent,'running');
 try{await mkdir(lock);}catch{throw Error(`Live preview is already running, or its lock needs review: ${lock}`);}
 let child,stopping=false,timer,checking=false;
 const env={...process.env,...await publicPreviewEnv(source,{local:!process.argv.includes('--hosted')}),npm_config_cache:process.env.npm_config_cache||join(home,'npm-cache')};
 async function dependencyKey(){
  const hash=createHash('sha256');
  for(const file of ['package.json','package-lock.json','next-app/package.json','next-app/package-lock.json'])hash.update(await readFile(join(preview,file)));
  return hash.digest('hex');
 }
 const installedKey=join(preview,'.git/live-dependencies');
 async function install(){
  for(const args of [['ci'],['ci','--prefix','next-app']]){
   await new Promise((yes,no)=>{const p=spawn('npm',args,{cwd:preview,env,stdio:'inherit'});p.once('error',no);p.once('exit',code=>code===0?yes():no(Error(`npm ${args.join(' ')} failed (${code})`)));});
  }
  await writeFile(installedKey,await dependencyKey());
 }
 async function stopChild(){
  if(!child||child.exitCode!==null||child.signalCode!==null)return;
  const p=child;child=null;
  await new Promise(yes=>{p.once('exit',yes);process.kill(-p.pid,'SIGTERM');});
 }
 function start(){
  const args=process.argv.includes('--hosted')?['--prefix','next-app','run','dev','--','--hostname','localhost','--port',process.env.PORT||'3000']:['scripts/local-frontend.mjs'];
  child=spawn(process.argv.includes('--hosted')?'npm':process.execPath,args,{cwd:preview,env,stdio:'inherit',detached:true});
  child.once('error',error=>{console.error(error.message);void shutdown(1);});
  child.once('exit',code=>{if(child&&!stopping){console.error('Live frontend stopped.');void shutdown(code||1);}});
 }
 async function shutdown(code=0){
  if(stopping)return;stopping=true;clearInterval(timer);
  await stopChild();await rmdir(lock);process.exit(code);
 }
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void shutdown());
 try{
  let fresh=false;
  try{await access(join(preview,'.git'));}catch{
   await run('git',['clone','--no-local','--single-branch','--branch','main',source,preview],parent);fresh=true;
  }
  const update=await syncMain(source,preview);
  let installed=false;try{installed=(await readFile(installedKey,'utf8'))===await dependencyKey();await access(join(preview,'next-app/node_modules/next/package.json'));await access(join(preview,'node_modules/.package-lock.json'));}catch{installed=false;}
  if(fresh||!installed||update.dependencies)await install();
  console.log(`Live main: ${source} → ${preview}. Landed commits update automatically; task edits stay isolated.`);
  start();
  timer=setInterval(async()=>{
   if(checking||stopping)return;checking=true;
   try{
    const update=await syncMain(source,preview);
    if(update.dependencies){await stopChild();await install();if(!stopping)start();}
    if(update.changed)console.log('Live main updated. Next.js will refresh connected browsers.');
   }catch(error){console.error(`Live sync stopped: ${error.message}`);await shutdown(1);}
   finally{checking=false;}
  },1000);
 }catch(error){console.error(error.message);await shutdown(1);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
