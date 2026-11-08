import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {once} from 'node:events';
import {createApi} from '../backend/runtime/api.ts';
import {agentPackageResponse} from '../backend/runtime/agent-package.ts';
import {buildAgentPackage} from '../scripts/build-agent-package.mjs';
const watch='11111111-1111-4111-8111-111111111111';
test('Node public transport serves scalar counts and the exact checksummed package without MCP credentials',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'muse-public-'));let server;
 try{
  const manifest=await buildAgentPackage(dir);let offline=false,reads=0;
  server=createApi({dispatch:async()=>assert.fail('public routes never dispatch authenticated work'),readCount:async id=>{reads++;return offline?{error:{message:'PRIVATE'}}:{data:id===watch?2:0};},readPackage:request=>agentPackageResponse(request,dir)});
  server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  let response=await fetch(`${base}/agent-gateway/pending-count?watchId=${watch}`);assert.equal(response.status,200);assert.equal(await response.json(),2);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(await(await fetch(`${base}/agent-gateway/pending-count?watchId=22222222-2222-4222-8222-222222222222`)).json(),0);
  const before=reads;
  for(const suffix of ['',`?watchId=${watch}&watchId=${watch}`,`?watchId=${watch}&token=bad`])assert.equal((await fetch(base+'/agent-gateway/pending-count'+suffix)).status,400);
  assert.equal((await fetch(`${base}/agent-gateway/pending-count?watchId=${watch}`,{method:'POST'})).status,405);assert.equal(reads,before,'invalid requests never query');
  offline=true;response=await fetch(`${base}/agent-gateway/pending-count?watchId=${watch}`);assert.equal(response.status,503);assert(!(await response.text()).includes('PRIVATE'));
  response=await fetch(base+'/agent-package/manifest.json');assert.equal(response.status,200);assert.deepEqual(await response.json(),manifest);
  response=await fetch(base+'/agent-package/'+manifest.archive);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);assert.equal(bytes.length,manifest.bytes);
  for(const path of ['/agent-package/.env','/agent-package/lookout-agent-0.1.0.tgz','/agent-package/unknown'])assert.equal((await fetch(base+path)).status,404);
  assert.equal((await fetch(base+'/agent-package/manifest.json?file=secret')).status,400);
  assert.equal((await fetch(base+'/agent-package/manifest.json',{method:'POST'})).status,405);
  assert.equal(await new Promise((resolve,reject)=>{const req=httpRequest(base+'/agent-package/manifest.json',{headers:{Host:'evil.test'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();}),403);
 }finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await rm(dir,{recursive:true,force:true});}
});
test('dev tunnel exposes only MCP, count and pinned package assets',async()=>{
 const policy=await readFile(new URL('../backend/runtime/muse-dev-policy.yaml',import.meta.url),'utf8');
 const meta=JSON.parse(await readFile(new URL('../agent-package/package.json',import.meta.url),'utf8'));
 assert(policy.includes("'/agent-gateway/pending-count'"));assert(policy.includes("'/agent-package/manifest.json'"));assert(policy.includes(`'/agent-package/lookout-agent-${meta.version}.tgz'`));
 assert(!policy.includes('startsWith'));assert(!policy.includes("'/v1"));assert(policy.includes('type: deny'));assert(policy.includes('host: localhost:8080'));
});
