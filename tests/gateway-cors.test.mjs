import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withGatewayCors} from '../supabase/functions/agent-gateway/cors.mjs';
const origins=['https://wcia013twe.github.io','https://lookout-job-signal-board.tenderibex16.chatgpt.site','http://localhost:3000','http://127.0.0.1:3000'];
const request=(method,origin,extra={})=>new Request('https://example.com/agent-gateway',{method,headers:{...(origin?{Origin:origin}:{}),...extra}});
test('localhost token-management preflights match the browser origin without invoking auth',async()=>{
 const handle=withGatewayCors(()=>assert.fail('Preflight must not create a token'));
 for(const origin of origins){const response=await handle(request('OPTIONS',origin,{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,apikey,content-type,x-client-info'}));assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);assert.match(response.headers.get('Vary'),/Origin/);assert.equal(await response.text(),'');}
});
test('localhost can read authenticated management responses; Origin never replaces credentials',async()=>{
 let called=0;
 const handle=withGatewayCors(async req=>{called++;return new Response(JSON.stringify(req.headers.has('Authorization')?{data:{accepted:true}}:{error:'Authentication required'}),{status:req.headers.has('Authorization')?200:401,headers:{'Content-Type':'application/json'}});});
 for(const origin of origins){
  const rejected=await handle(request('POST',origin));assert.equal(rejected.status,401);assert.equal(rejected.headers.get('Access-Control-Allow-Origin'),origin);
  const accepted=await handle(request('POST',origin,{Authorization:'Bearer fictional-fixture'}));assert.equal(accepted.status,200);assert.deepEqual(await accepted.json(),{data:{accepted:true}});assert.equal(accepted.headers.get('Access-Control-Allow-Origin'),origin);assert.equal(accepted.headers.get('Cache-Control'),'no-store');
 }
 assert.equal(called,origins.length*2);
});
test('unapproved and lookalike origins cannot execute token operations',async()=>{
 const handle=withGatewayCors(()=>assert.fail('Forbidden origin must not reach management'));
 for(const origin of ['null','https://evil.example','https://lookout-job-signal-board.tenderibex16.chatgpt.site.evil.example','https://another-site.tenderibex16.chatgpt.site','http://localhost.evil.example:3000','http://127.0.0.1.evil.example:3000','http://localhost:3001','https://localhost:3000'])for(const method of ['POST','OPTIONS']){const r=await handle(request(method,origin));assert.equal(r.status,403);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);}
});
test('native MCP/gateway requests without Origin still reach the same authenticated handler',async()=>{
 let called=false;const handle=withGatewayCors(req=>{called=true;assert.equal(req.headers.get('Authorization'),'Bearer fixture');return new Response('{"error":"Credential expired"}',{status:401});});
 const r=await handle(request('POST',undefined,{Authorization:'Bearer fixture'}));assert(called);assert.equal(r.status,401);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);assert.match(await r.text(),/expired/);
});
test('deployed gateway entry uses the tested CORS wrapper for every response',async()=>{
 const source=await readFile(new URL('../supabase/functions/agent-gateway/index.ts',import.meta.url),'utf8');assert.match(source,/Deno\.serve\(withGatewayCors\(async request/);assert(!source.includes("'Access-Control-Allow-Origin':"));
});
