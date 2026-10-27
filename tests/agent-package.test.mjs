import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {validateConfig,readPendingCount,handleCount,pollDelay,wakeCommand,acquireLock,runWatch} from '../agent-package/watch.mjs';
import {buildAgentPackage} from '../scripts/build-agent-package.mjs';
import {readGuide,guideIndex,guideDispatch} from '../supabase/functions/agent-gateway/guides.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createMuseChangeFeedDemo} from '../lib/muse-change-feed-demo.mjs';
const watchUrl='https://example.test/functions/v1/agent-gateway/pending-count?watchId=11111111-1111-4111-8111-111111111111';
const fixture=()=>({watchUrl,wake:{command:process.execPath,args:['-e','process.exit(0)']}});
const config=()=>validateConfig(fixture());
test('config accepts count-only HTTPS URLs and literal command args, rejects credential fields',()=>{
 assert.equal(config().pollIntervalSeconds,120);
 for(const patch of [{token:'secret'},{wake:{command:'wake',args:['jb_agent_'+'a'.repeat(64)]}},{watchUrl:watchUrl.replace('https:','http:')},{watchUrl:watchUrl+'&token=secret'},{watchUrl:watchUrl+'&watchId=bad'},{watchUrl:watchUrl.replace('https://','https://user:pass@')},{watchUrl:watchUrl+'#fragment'},{wake:{command:'echo',args:'bad'}},{wake:{command:'echo',args:[],env:{TOKEN:'secret'}}},{pollIntervalSeconds:1},{requestTimeoutSeconds:61},{wakeCooldownSeconds:0}])assert.throws(()=>validateConfig({...fixture(),...patch}));
 assert.ok(pollDelay(config(),0,()=>0)>=120000);assert.ok(pollDelay(config(),9,()=>0)<=3600000);
 assert.ok(pollDelay(config(),1,()=>0)>pollDelay(config(),0,()=>0));
});
test('poller sends no credentials, rejects errors/redirects/large or malformed responses',async()=>{
 const count=await readPendingCount(config(),{fetchImpl:async(url,opts)=>{assert.equal(url,watchUrl);assert.equal(opts.credentials,'omit');assert.equal(opts.redirect,'error');assert.deepEqual(opts.headers,{Accept:'application/json'});assert.ok(opts.signal);return new Response('55');}});assert.equal(count,55);
 for(const body of ['{}','-1','1.5','"0"','null','9'.repeat(40)])await assert.rejects(readPendingCount(config(),{fetchImpl:async()=>new Response(body)}));
 await assert.rejects(readPendingCount(config(),{fetchImpl:async()=>new Response('0',{status:503})}));
 await assert.rejects(readPendingCount(config(),{fetchImpl:async()=>{throw Error('unavailable');}}));
});
test('wake attempts persist before invocation, coalesce positives, rearm on zero and retry after cooldown',async()=>{
 const state={lastWakeAt:null},order=[];const options={now:1000,cooldownMs:10000,persist:async()=>order.push('persist'),wake:async()=>order.push('wake')};
 assert.equal(await handleCount(0,state,options),'idle');assert.deepEqual(order,[]);
 await handleCount(3,state,options);assert.deepEqual(order,['persist','wake']);
 assert.equal(await handleCount(4,state,{...options,now:2000}),'cooldown');assert.equal(order.length,2);
 await handleCount(4,state,{...options,now:11000});assert.equal(order.length,4);
 await handleCount(0,state,options);assert.equal(state.lastWakeAt,null);await handleCount(1,state,{...options,now:12000});assert.equal(order.at(-1),'wake');
 await assert.rejects(handleCount(1,{lastWakeAt:null},{...options,persist:async()=>{throw Error('disk');},wake:async()=>assert.fail('must persist first')}));
 const failed={lastWakeAt:null};await assert.rejects(handleCount(1,failed,{...options,wake:async()=>{throw Error('wake failed');}}));assert.equal(failed.lastWakeAt,1000);
});
test('real wake command uses literal argv without a shell, hides child output and handles failures/timeouts',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lookout-wake-'));try{
  const output=join(dir,'receipt.json'),literal='$(touch unwanted); `echo nope`';
  await wakeCommand({...config(),wake:{command:process.execPath,args:['-e',"require('node:fs').writeFileSync(process.argv[1],JSON.stringify(process.argv[2]))",output,literal]}});
  assert.equal(JSON.parse(await readFile(output,'utf8')),literal);
  await assert.rejects(wakeCommand({...config(),wake:{command:process.execPath,args:['-e','process.exit(3)']}}));
  await assert.rejects(wakeCommand({...config(),wake:{command:join(dir,'missing'),args:[]}}));
  await assert.rejects(wakeCommand({...config(),wakeTimeoutSeconds:1,wake:{command:process.execPath,args:['-e','setInterval(()=>{},1000)']}}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('exclusive watcher lock prevents overlapping processes and releases explicitly',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lookout-lock-'));try{const path=join(dir,'watch.lock'),release=await acquireLock(path);await assert.rejects(acquireLock(path),/lock exists/);await release();await(await acquireLock(path))();}finally{await rm(dir,{recursive:true,force:true});}
});
test('detached fictional feed drives the package, persists cooldown across restart and releases on stop',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lookout-package-demo-'));try{
  const file=join(dir,'watch.config.json');await writeFile(file,JSON.stringify(fixture()));
  const demo=createMuseChangeFeedDemo(),watch=(await demo.configureAgentWatch({enabled:true})).watchId;let wakes=0;
  const step=async(readCount)=>{const controller=new AbortController();await runWatch(file,'run',{readCount,wake:async()=>{wakes++;},sleep:async()=>controller.abort(),signal:controller.signal,log:()=>{}});await assert.rejects(access(file+'.lock'));};
  const read=()=>demo.readAgentPendingCount(watch);
  await step(read);assert.equal(wakes,1);await step(read);assert.equal(wakes,1,'restart keeps cooldown');
  const saved=await readFile(file+'.state.json','utf8');assert.ok(!saved.includes(watchUrl));assert.ok(!saved.includes(watch));
  const items=(await demo.readMuseChanges()).items;await demo.acknowledgeMuseChanges({eventIds:items.map(e=>e.id)});await step(read);assert.equal(wakes,1);assert.equal(JSON.parse(await readFile(file+'.state.json','utf8')).lastWakeAt,null);
  await step(async()=>1);assert.equal(wakes,2);await step(async()=>{throw Error('PRIVATE URL');});assert.equal(wakes,2,'errors never wake');
  let checked;await runWatch(file,'check',{readCount:async()=>7,wake:async()=>assert.fail(),log:line=>{checked=JSON.parse(line);}});assert.deepEqual(checked,{pendingCount:7,wakeInvoked:false});
  await runWatch(file,'test-wake',{readCount:async()=>assert.fail(),wake:async()=>{wakes++;},log:()=>{}});assert.equal(wakes,3);
  await writeFile(file+'.state.json','broken');await assert.rejects(step(read),/Cooldown state unreadable/);await assert.rejects(access(file+'.lock'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('versioned package download is self contained, checksummed, and contains no install hooks',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lookout-package-build-'));try{
  const manifest=await buildAgentPackage(dir),archive=await readFile(join(dir,manifest.archive));assert.equal(manifest.sha256,createHash('sha256').update(archive).digest('hex'));assert.equal(manifest.bytes,archive.length);
  const names=execFileSync('tar',['-tzf',join(dir,manifest.archive)],{encoding:'utf8'}).trim().split('\n');assert.deepEqual(names.sort(),manifest.files.map(name=>'package/'+name).sort());
  execFileSync('tar',['-xzf',join(dir,manifest.archive),'-C',dir]);
  const pkg=JSON.parse(await readFile(join(dir,'package/package.json'),'utf8'));assert.equal(pkg.dependencies,undefined);assert.equal(pkg.scripts,undefined);
  assert.match(execFileSync(process.execPath,[join(dir,'package/watch.mjs'),'--help'],{encoding:'utf8'}),/--test-wake/);
  assert.equal(JSON.parse(await readFile(join(dir,'manifest.json'),'utf8')).version,pkg.version);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('existing scoped guide/MCP boundary discovers agent package and preserves host authorization',async()=>{
 const guide=readGuide('agent-package');assert.ok(guideIndex().some(g=>g.id==='agent-package'));assert.equal(guide.instructions,await readFile(new URL('../agent-package/README.md',import.meta.url),'utf8'));
 for(const text of ['--check','--test-wake','actual','configure_agent_watch','No Lookout','background','manifest.json'])assert.ok(guide.instructions.includes(text),text);
 assert.deepEqual(await guideDispatch('agent-package',async()=>({error:{code:'42501'}})),{error:{code:'42501'}});
 const handler=createHandler(async(_token,operation,payload)=>operation==='credentials.verify'?{status:200,data:{scopes:['workspace:read']}}:{status:200,data:(await guideDispatch(payload.id,async()=>({data:{}}))).data});
 const response=await handler(new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'read_guide',arguments:{id:'agent-package'}}})}));
 const result=await response.json();assert.ok(!result.result.isError);assert.equal(JSON.parse(result.result.content[0].text).distribution.archive,'lookout-agent-0.1.0.tgz');
});
