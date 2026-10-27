#!/usr/bin/env node
import {realpathSync} from 'node:fs';
import {readFile,writeFile,open,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';

const fields=['watchUrl','wake','pollIntervalSeconds','wakeCooldownSeconds','requestTimeoutSeconds','wakeTimeoutSeconds'];
export function validateConfig(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!fields.includes(key)))throw Error('Use only the documented config fields; credentials are not accepted');
 if(JSON.stringify(input).includes('jb_agent_'))throw Error('Lookout credentials must stay in the authenticated worker');
 let url;try{url=new URL(input.watchUrl);}catch{throw Error('Valid watchUrl required');}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||!url.pathname.endsWith('/agent-gateway/pending-count')||url.searchParams.getAll('watchId').length!==1||[...url.searchParams.keys()].some(key=>key!=='watchId')||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(url.searchParams.get('watchId')||''))throw Error('Use an HTTPS count-only watch URL without credentials or extra parameters');
 const wake=input.wake;
 if(!wake||typeof wake!=='object'||Array.isArray(wake)||Object.keys(wake).some(key=>!['command','args'].includes(key))||typeof wake.command!=='string'||!wake.command.trim()||wake.command.includes('\0')||!Array.isArray(wake.args)||wake.args.length>100||wake.args.some(arg=>typeof arg!=='string'||arg.includes('\0')||arg.length>4096))throw Error('Wake requires command and an array of literal arguments');
 const config={...input,watchUrl:url.href,pollIntervalSeconds:input.pollIntervalSeconds??120,wakeCooldownSeconds:input.wakeCooldownSeconds??1800,requestTimeoutSeconds:input.requestTimeoutSeconds??15,wakeTimeoutSeconds:input.wakeTimeoutSeconds??60};
 for(const [key,min,max]of [['pollIntervalSeconds',120,3600],['wakeCooldownSeconds',120,86400],['requestTimeoutSeconds',1,60],['wakeTimeoutSeconds',1,300]])if(!Number.isInteger(config[key])||config[key]<min||config[key]>max)throw Error(`Invalid ${key}: choose ${min}–${max}`);
 return config;
}
export async function readPendingCount(config,{fetchImpl=fetch,signal}={}){
 const response=await fetchImpl(config.watchUrl,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',headers:{Accept:'application/json'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(config.requestTimeoutSeconds*1000)]):AbortSignal.timeout(config.requestTimeoutSeconds*1000)});
 if(!response.ok)throw Error('Count request failed');
 // Do not buffer an arbitrary response from a misconfigured endpoint.
 const reader=response.body?.getReader();if(!reader)throw Error('Count unavailable');
 let body='';try{while(true){const {done,value}=await reader.read();if(done)break;if(body.length+value.length>32)throw Error('Count response too large');body+=new TextDecoder().decode(value);}}finally{await reader.cancel();}
 let count;try{count=JSON.parse(body);}catch{throw Error('Invalid count response');}
 if(!Number.isSafeInteger(count)||count<0)throw Error('Invalid count response');return count;
}
// Persist the attempt BEFORE waking: a crash/restart cannot cause a wake storm.
export async function handleCount(count,state,{now=Date.now(),cooldownMs,wake,persist}){
 if(count===0){if(state.lastWakeAt!==null){state.lastWakeAt=null;await persist(state);}return 'idle';}
 if(state.lastWakeAt!==null&&now-state.lastWakeAt<cooldownMs)return 'cooldown';
 state.lastWakeAt=now;await persist(state);await wake();return 'wake-command-completed';
}
export function pollDelay(config,failures=0,random=Math.random){
 return Math.round(Math.min(3600000,config.pollIntervalSeconds*1000*2**Math.min(failures,5))*(1+random()*0.1));
}
export function wakeCommand(config,{signal,spawnImpl=spawn}={}){
 // Pass only ordinary process-location settings. No inherited agent/API tokens.
 const env=Object.fromEntries(['PATH','HOME','USER','TMPDIR','TEMP','TMP','SystemRoot','LOCALAPPDATA','APPDATA','XDG_RUNTIME_DIR','XDG_CONFIG_HOME'].filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
 return new Promise((resolve,reject)=>{
  const child=spawnImpl(config.wake.command,config.wake.args,{shell:false,stdio:'ignore',env,signal,killSignal:'SIGKILL'});
  const timer=setTimeout(()=>child.kill('SIGKILL'),config.wakeTimeoutSeconds*1000);
  child.once('error',()=>{clearTimeout(timer);reject(Error('Wake command failed'));});
  child.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Wake command failed'));});
 });
}
export async function acquireLock(path){
 let file;try{file=await open(path,'wx',0o600);}catch(error){if(error.code==='EEXIST')throw Error('Watcher lock exists; stop the existing watcher or verify it is gone before removing its lock');throw error;}
 try{await file.writeFile(String(process.pid));await file.close();}catch(error){await file.close();await unlink(path);throw error;}
 return ()=>unlink(path);
}
export async function runWatch(configPath,mode='run',deps={}){
 configPath=realpathSync(configPath);
 const config=validateConfig(JSON.parse(await readFile(configPath,'utf8')));
 const read=deps.readCount||(()=>readPendingCount(config,{signal:deps.signal}));
 const log=deps.log||console.log;
 if(mode==='check'){const count=await read();log(JSON.stringify({pendingCount:count,wakeInvoked:false}));return;}
 const release=await acquireLock(configPath+'.lock');
 try{
  if(mode==='test-wake'){await (deps.wake||(()=>wakeCommand(config,{signal:deps.signal})))();log('Wake command completed; verify the runtime received the test wake.');return;}
  const statePath=configPath+'.state.json',watchKey=createHash('sha256').update(config.watchUrl).digest('hex');
  let state={watchKey,lastWakeAt:null};
  try{const saved=JSON.parse(await readFile(statePath,'utf8'));if(saved.watchKey===watchKey&&(saved.lastWakeAt===null||Number.isSafeInteger(saved.lastWakeAt)&&saved.lastWakeAt>=0))state=saved;else if(saved.watchKey===watchKey)throw Error('Invalid cooldown state');}catch(error){if(error.code!=='ENOENT')throw Error('Cooldown state unreadable; inspect it before restarting');}
  const persist=value=>writeFile(statePath,JSON.stringify(value)+'\n',{mode:0o600});
  let failures=0;
  while(!deps.signal?.aborted){
   try{
    const count=await read();const outcome=await handleCount(count,state,{cooldownMs:config.wakeCooldownSeconds*1000,wake:deps.wake||(()=>wakeCommand(config,{signal:deps.signal})),persist});
    failures=0;if(outcome==='wake-command-completed')log('Wake command completed; pending changes require authenticated handling.');
   }catch{if(deps.signal?.aborted)break;failures++;log('Watch attempt failed; backing off. No changes acknowledged.');}
   try{await (deps.sleep||sleep)(pollDelay(config,failures),undefined,{signal:deps.signal});}catch(error){if(deps.signal?.aborted)break;throw error;}
  }
 }finally{await release();}
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--help'){console.log('Usage: node watch.mjs <config.json> [--check | --test-wake]\nDefault: run until SIGINT/SIGTERM. --check polls once without waking. --test-wake runs the configured local command once.');return;}
 if(args.length<1||args.length>2||args[0].startsWith('--')||args.length===2&&!['--check','--test-wake'].includes(args[1]))throw Error('Use --help for usage');
 const controller=new AbortController();const stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
 try{await runWatch(resolve(args[0]),args[1]==='--check'?'check':args[1]==='--test-wake'?'test-wake':'run',{signal:controller.signal});}finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(realpathSync(process.argv[1])).href){main().catch(()=>{console.error('Agent Watch stopped. Check config, local lock/state files, endpoint availability and wake command. No credential or URL is logged.');process.exitCode=1;});}
