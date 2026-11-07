import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {runCommand,startLocal,startServices,startTunnel,savedLocalConfig,probeFrontend,devPort} from '../scripts/local-startup.mjs';
import {claimPreviewLock,liveRoot} from '../scripts/live-main.mjs';
const missing=()=>{throw Object.assign(Error('missing'),{code:'ENOENT'});};
const publicKey='e30.'+Buffer.from(JSON.stringify({role:'anon'})).toString('base64url')+'.fictional';
const config={API_URL:'http://127.0.0.1:54321',ANON_KEY:publicKey};
const log=()=>{};
test('dependency commands terminate on deadline and do not print captured secrets',async()=>{
 const started=Date.now();
 await assert.rejects(runCommand(process.execPath,['-e','setInterval(()=>{},1000)'],{timeout:80}),error=>error.timedOut&&!error.message.includes('secret'));
 assert(Date.now()-started<2000);
 await assert.rejects(runCommand(process.execPath,['-e','console.error("fictional-secret");process.exit(1)']),error=>!error.message.includes('fictional-secret'));
});
test('repeated startup reuses an identified Lookout and refuses an unrelated occupied port',async()=>{
 const run=()=>assert.fail('Existing frontend must not start dependency commands');
 await startLocal({probe:async()=> 'lookout',run,log});
 await assert.rejects(startLocal({probe:async()=> 'busy',run,log}),/Port 3000.*already in use/);
 for(const port of ['0','-1','65536','abc'])assert.throws(()=>devPort(port),/PORT/);
});
test('healthy saved local services avoid the stalled Docker control API',async()=>{
 assert.deepEqual(await startServices({cwd:'/fictional',saved:async()=>config,run:()=>assert.fail('No Docker restart'),log}),config);
});
test('unresponsive Docker and CLI status stop before any restart or frontend launch',async()=>{
 for(const stage of ['docker','supabase']){
  const calls=[];
  await assert.rejects(startLocal({cwd:'/fictional',probe:async()=> 'free',saved:async()=>null,log,launch:()=>assert.fail('Frontend should not start'),run:async(file,args,options)=>{
   calls.push([file,args]);assert.equal(options.timeout,10000);
   if(file===stage)throw Object.assign(Error('deadline'),{timedOut:true});return 'ok';
  }}),/10 seconds/);
  assert(!calls.some(([,args])=>args[0]==='start'));
 }
});
test('existing Supabase reuses CLI configuration; cold startup is bounded and checked after start',async()=>{
 let statuses=0;const calls=[];
 const run=async(file,args,opts)=>{
  calls.push([file,args,opts]);
  if(file==='docker')return 'version';
  if(args[0]==='status'){if(++statuses===1)throw Error('not running');return JSON.stringify(config);}
  assert.equal(opts.timeout,180000);return 'fictional private CLI output';
 };
 assert.deepEqual(await startServices({cwd:'/fictional',saved:async()=>null,run,log}),config);
 assert.equal(statuses,2);assert.equal(calls.filter(([,a])=>a[0]==='start').length,1);
});
test('optional tunnel configuration and failure never block frontend startup',async()=>{
 let launched=false;const messages=[];
 await startLocal({cwd:'/fictional',probe:async()=> 'free',saved:async()=>config,read:async()=> 'NGROK_URL=https://fictional.ngrok.app\nNGROK_AUTHTOKEN=fictional-token\n',run:async()=>{throw Object.assign(Error('timeout'),{timedOut:true});},log:m=>messages.push(m),launch:async(_cwd,_run,c)=>{launched=true;assert.deepEqual(c,config);}});
 assert(launched);assert(messages.some(m=>m.includes('continuing locally')));
 await startTunnel({cwd:'/fictional',env:{},read:missing,run:()=>assert.fail('Unconfigured tunnel should not run Docker'),log});
});
test('saved config requires loopback public credentials and responding Auth and REST',async()=>{
 const calls=[];
 const read=async()=>`NEXT_PUBLIC_SUPABASE_URL=${config.API_URL}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${publicKey}\nSUPABASE_SERVICE_ROLE_KEY=fictional-private\n`;
 const request=async(url,options)=>{calls.push([url,options]);return new Response(url.endsWith('/health')?JSON.stringify({name:'GoTrue'}):'{}');};
 assert.deepEqual(await savedLocalConfig({cwd:'/fictional',env:{},read,request}),config);
 assert.equal(calls.length,2);assert(calls.every(([,o])=>o.headers.apikey===publicKey));
 for(const [url,key] of [['https://remote.example',publicKey],['http://127.0.0.1:54321/path',publicKey],[config.API_URL,'sb_secret_private'],[config.API_URL,'e30.'+Buffer.from('{"role":"service_role"}').toString('base64url')+'.test']]){
  assert.equal(await savedLocalConfig({cwd:'/fictional',env:{NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key},read:missing,request:()=>assert.fail('Unsafe config must not make a request')}),null);
 }
 assert.equal(await savedLocalConfig({cwd:'/fictional',env:{},read,request:async()=>new Response('{}',{status:503})}),null);
});
test('frontend detection distinguishes Lookout from another HTTP server',async()=>{
 let title='Lookout';const server=createServer((_req,res)=>res.end(`<html><title>${title}</title></html>`));
 await new Promise(yes=>server.listen(0,'127.0.0.1',yes));
 const port=server.address().port;
 try{assert.equal(await probeFrontend(port),'lookout');title='Other app';assert.equal(await probeFrontend(port),'busy');}
 finally{await new Promise(yes=>server.close(yes));}
 assert.equal(await probeFrontend(port),'free');
});
test('preview recovers a dead-owner lock, releases its own lock and preserves a live owner',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lookout-lock-test-')),lock=join(dir,'running');
 try{
  await mkdir(lock);await writeFile(join(lock,'owner.json'),JSON.stringify({pid:999999,token:'old'}));
  const release=await claimPreviewLock(lock,{pid:12345,alive:()=>false});
  assert.equal(JSON.parse(await readFile(join(lock,'owner.json'))).pid,12345);
  await assert.rejects(claimPreviewLock(lock,{alive:()=>true}),/already running/);
  await release();
  await mkdir(lock);await assert.rejects(claimPreviewLock(lock),/no process owner/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('preview falls back to internal storage when the external SSD is absent',async()=>{
 assert.equal(await liveRoot({LOOKOUT_LIVE_ROOT:'/custom'},()=>assert.fail()),'/custom');
 assert.equal(await liveRoot({},async()=>{}),'/Volumes/External SSD/Lookout/live-main');
 assert.equal(await liveRoot({},missing),join(tmpdir(),'lookout-live-main'));
});
