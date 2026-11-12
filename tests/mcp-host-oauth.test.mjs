import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createHash,randomBytes} from 'node:crypto';
import {generateKeyPair,exportJWK} from 'jose';
import {createTestDatabase} from './helpers/database.mjs';
import {createOAuth,loadOAuthConfig} from '../backend/runtime/oauth.mjs';
import {createApi} from '../backend/runtime/api.ts';
import {createEvents} from '../backend/runtime/mcp-events.mjs';
import {createOAuthConsentDemo,isTopLevelConsent} from '../lib/oauth-consent.mjs';
import {createDispatch} from '../backend/runtime/service.ts';
const user='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222',connection='77777777-7777-7777-7777-777777777777';
let db,server,base,oauth,config,rpc;const scopes=['workspace:read','activity:write'];
const sha=s=>createHash('sha256').update(s).digest('hex');
before(async()=>{
 db=await createTestDatabase();
 rpc=async(name,args)=>{try{const keys=Object.keys(args);const result=await db.query(`select public.${name}(${keys.map((k,i)=>`${k} => $${i+1}`).join(',')}) as result`,Object.values(args));return {data:result.rows[0].result,error:null};}catch(error){return {data:null,error:{code:error.code,message:error.message}};}};
 server=createApi({dispatch:createDispatch({rpc,supabaseUrl:'https://provider.example.test'}),allowedHosts:['127.0.0.1'],allowedOrigins:['https://lookout.example.test'],oauth:{handle:(...args)=>oauth?.handle(...args)||false,get challenge(){return oauth?.challenge;}}});
 server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;
 const {privateKey}=await generateKeyPair('ES256',{extractable:true});const key=await exportJWK(privateKey);Object.assign(key,{kid:'ephemeral-fixture',use:'sig',alg:'ES256'});
 config={issuer:base+'/oauth',resource:base+'/mcp',consentUrl:'https://lookout.example.test/oauth/consent',redirectUri:'https://host.example.test/callback',clientId:'fixture-public-client',jwks:{keys:[key]},cookieKeys:[randomBytes(32).toString('base64')]};
 await db.query("update private.mcp_oauth_policy set enabled=true,resource=$1,client_id=$2",[config.resource,config.clientId]);
 await db.query("insert into private.agent_connections(id,user_id,name,token_hash,scopes,expires_at) values($1,$2,'Fixture connection',$3,$4,now()+interval '1 day')",[connection,user,sha('jb_agent_'+'a'.repeat(64)),scopes]);
 await restart();
});
after(async()=>{server?.closeAllConnections();await new Promise(resolve=>server?.close(resolve));await db?.close();});
async function restart(){oauth=await createOAuth({config,rpc,test:true,authenticateHuman:async token=>token==='fixture-human'?{id:user}:token==='fixture-other'?{id:other}:null});}
function browser(){const jar=new Map();return async(url,opts={})=>{const path=new URL(url).pathname;const cookies=[...jar].filter(([,v])=>path.startsWith(v.path)).map(([k,v])=>k+'='+v.value).join('; ');
 const r=await fetch(url,{...opts,redirect:'manual',signal:AbortSignal.timeout(10000),headers:{...opts.headers,...(cookies?{Cookie:cookies}:{})}});
 for(const cookie of r.headers.getSetCookie()){const parts=cookie.split(';'),pair=parts[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),{value:pair.slice(i+1),path:parts.find(p=>p.trim().toLowerCase().startsWith('path='))?.trim().slice(5)||'/'});}return r;};}

async function begin({redirect=config.redirectUri,resource=config.resource,browserRequest=browser()}={}){
 const verifier=randomBytes(32).toString('base64url');const params=new URLSearchParams({client_id:config.clientId,redirect_uri:redirect,response_type:'code',scope:'offline_access lookout',resource,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',state:'fixture-state'});
 let r=await browserRequest(base+'/oauth/auth?'+params);assert.equal(r.status,303,await r.text());
 r=await browserRequest(r.headers.get('location'));assert.equal(r.status,303,await r.text());
 const ticket=new URL(r.headers.get('location')).hash.slice('#ticket='.length);return {request:browserRequest,ticket,verifier};
}
async function consent(flow,action='approve',human='fixture-human',overrides={}){
 return fetch(base+'/oauth/consent',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Origin:'https://lookout.example.test','Content-Type':'application/json',Authorization:'Bearer '+human},body:JSON.stringify({ticket:flow.ticket,action,connectionId:connection,scopes,expiresAt:new Date(Date.now()+3600000).toISOString(),...overrides})});
}
async function code(){const flow=await begin();let r=await consent(flow);assert.equal(r.status,200,await r.clone().text());
 const finish=await r.json();r=await flow.request(finish.redirect);assert.equal(r.status,303,await r.text());
 r=await flow.request(r.headers.get('location'));assert.equal(r.status,303,await r.text());
 const location=new URL(r.headers.get('location'));assert.equal(location.origin,'https://host.example.test');assert.equal(location.searchParams.get('iss'),config.issuer);assert.equal(location.searchParams.get('state'),'fixture-state');
 assert.ok(location.searchParams.get('code'),location.href);return {...flow,code:location.searchParams.get('code')};}
async function exchange(flow,overrides={}){return fetch(base+'/oauth/token',{method:'POST',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,grant_type:'authorization_code',code:flow.code,code_verifier:flow.verifier,redirect_uri:config.redirectUri,resource:config.resource,...overrides})});}
async function tokens(){const r=await exchange(await code());assert.equal(r.status,200,await r.clone().text());return r.json();}
async function refresh(token,overrides={}){return fetch(base+'/oauth/token',{method:'POST',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,grant_type:'refresh_token',refresh_token:token,resource:config.resource,...overrides})});}
async function verify(token){return rpc('agent_dispatch',{credential_hash:sha(token),operation:'credentials.verify',payload:{}});}
test('disabled default and discovery, initial PKCE code, refresh and restart use durable scoped opaque tokens',async()=>{
 assert.equal(await loadOAuthConfig({}),null);
 const discovery=await fetch(base+'/.well-known/oauth-authorization-server/oauth');assert.equal(discovery.status,200);assert.equal((await discovery.json()).issuer,config.issuer);
 const result=await tokens();assert.match(result.access_token,/^[A-Za-z0-9_-]{43}$/);assert.ok(result.refresh_token);const stored=await db.query("select extract(epoch from expires_at) <= (payload->>'exp')::numeric as capped from private.mcp_oauth_records where model='AccessToken' and key_hash=$1",[sha(result.access_token)]);assert.equal(stored.rows[0].capped,true);assert.equal((await verify(result.access_token)).data.id,connection);
 await restart();assert.equal((await verify(result.access_token)).data.id,connection);
 const response=await refresh(result.refresh_token);assert.equal(response.status,200,await response.clone().text());const renewed=await response.json();assert.notEqual(renewed.refresh_token,result.refresh_token);assert.equal((await verify(renewed.access_token)).data.id,connection);
});
test('legacy credential and MCP initialize coexist; human JWTs and unbound opaque tokens fail',async()=>{
 assert.equal((await verify('jb_agent_'+'a'.repeat(64))).data.id,connection);
 const result=await tokens();
 for(const [token,status] of [[result.access_token,200],['eyJfixture.human.signature',401],['z'.repeat(43),401]]){
 const r=await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:'Bearer '+token},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{}})});assert.equal(r.status,status,await r.text());if(status===401)assert.match(r.headers.get('www-authenticate'),/resource_metadata/);
 }
 const rejected=await fetch(base+'/v1/operations',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+result.access_token},body:JSON.stringify({operation:'connections.list',payload:{}})});assert.equal(rejected.status,403);
});
test('wrong redirect, missing S256, wrong resource/client/PKCE and machine grant are rejected',async()=>{
 const flow=await code();
 for(const override of [{redirect_uri:'https://attacker.example/callback'},{resource:'https://attacker.example/api'},{client_id:'wrong-client'},{code_verifier:'bad-verifier'}])assert.ok([400,401].includes((await exchange(await code(),override)).status));
 const good=await exchange(flow);assert.equal(good.status,200,await good.clone().text());const valid=await good.json();
 assert.equal((await refresh(valid.refresh_token,{resource:'https://attacker.example/api'})).status,400);
 assert.equal((await refresh(valid.refresh_token,{grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer'})).status,400);
 for(const patch of [{redirect_uri:'https://attacker.example/callback'},{resource:'https://attacker.example/api'},{code_challenge_method:'plain'}]){
 const q=new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirectUri,resource:config.resource,response_type:'code',scope:'lookout',code_challenge:'x'.repeat(43),code_challenge_method:'S256',...patch});
 const r=await fetch(base+'/oauth/auth?'+q,{redirect:'manual'});assert.ok(r.status===400||(r.status===303&&r.headers.get('location').startsWith(config.redirectUri)&&r.headers.get('location').includes('error=')));
 }
});
test('code replay and refresh replay invalidate the associated grant',async()=>{
 const flow=await code();const initial=await exchange(flow);assert.equal(initial.status,200);const result=await initial.json();
 assert.equal((await exchange(flow)).status,400);assert.ok((await verify(result.access_token)).error);
 const next=await tokens();const first=await refresh(next.refresh_token);assert.equal(first.status,200);const renewed=await first.json();
 assert.equal((await refresh(next.refresh_token)).status,400);assert.ok((await verify(renewed.access_token)).error);
});
test('concurrent code redemption and refresh rotation issue at most one result',async()=>{
 const flow=await code();const replies=await Promise.all([exchange(flow),exchange(flow)]);assert.equal(replies.filter(r=>r.status===200).length,1);assert.ok(replies.every(r=>r.status===200||r.status===400));
 const result=await tokens();const rotations=await Promise.all([refresh(result.refresh_token),refresh(result.refresh_token)]);assert.equal(rotations.filter(r=>r.status===200).length,1);
});
test('consent rejects cross-owner choice, missing human auth, changed scopes and extended expiry',async()=>{
 const flow=await begin();
 for(const [human,overrides] of [['fixture-other',{}],['human.jwt.forged',{}],['fixture-human',{scopes:['workspace:read']}],['fixture-human',{expiresAt:new Date(Date.now()+90*86400000).toISOString()}]])assert.equal((await consent(flow,'approve',human,overrides)).status,400);
 const r=await consent(flow);assert.equal(r.status,200);assert.equal((await consent(flow)).status,400);
});
test('consent completion requires original browser, is one-use and binds displayed expiry',async()=>{
 const flow=await begin(),expiry=new Date(Date.now()+120000).toISOString();
 const r=await consent(flow,'approve','fixture-human',{expiresAt:expiry});const finish=await r.json();
 const stranger=await fetch(finish.redirect,{redirect:'manual'});assert.equal(stranger.status,400);
 const accepted=await flow.request(finish.redirect);assert.equal(accepted.status,303);assert.equal((await flow.request(finish.redirect)).status,400);
 const rows=await db.query('select expires_at from private.mcp_oauth_grants where expires_at=$1',[expiry]);assert.equal(rows.rows.length,1);
 const origin=await fetch(base+'/oauth/consent',{method:'POST',headers:{Origin:'https://attacker.example','Content-Type':'application/json',Authorization:'Bearer fixture-human'},body:JSON.stringify({ticket:flow.ticket,action:'read'})});assert.equal(origin.status,403);
});
test('provider revocation stops access and refresh; connection owner/scope/expiry stay authoritative',async()=>{
 const result=await tokens();const revoke=await fetch(base+'/oauth/token/revocation',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,token:result.refresh_token})});assert.equal(revoke.status,200);
 assert.ok((await verify(result.access_token)).error);assert.equal((await refresh(result.refresh_token)).status,400);
 const valid=await tokens();
 for(const mutation of ["revoked_at=now()","expires_at=now()-interval '1 second'","scopes=array['workspace:read']",`user_id='${other}'`]){
 await db.exec('begin');try{await db.exec(`update private.agent_connections set ${mutation} where id='${connection}'`);await db.exec('savepoint rejected');assert.ok((await verify(valid.access_token)).error);await db.exec('rollback to savepoint rejected');assert.equal((await refresh(valid.refresh_token)).status,400);}finally{await db.exec('rollback');}
 }
});
test('private OAuth records and administrative configuration are unavailable to human/anonymous SQL roles',async()=>{
 for(const role of ['anon','authenticated']){
 for(const command of ["select * from private.mcp_oauth_records","select public.mcp_oauth_store('readiness','{}')","select private.agent_connection_id('x')"]){await db.exec(`begin;set local role ${role}`);try{await assert.rejects(db.exec(command),/permission denied/);}finally{await db.exec('rollback');}}
 }
});
test('event subscriptions retain grant identity through refresh, revoke keys and allow explicit reconnect',async()=>{
 let deliveries=0;const events=createEvents({rpc,post:async(_url,_headers,body)=>{const value=JSON.parse(body);if(value.challenge)return {status:200,body:JSON.stringify({challenge:value.challenge})};deliveries++;return {status:204,body:''};}});
 const params={name:'lookout.work_available',arguments:{},delivery:{mode:'webhook',url:'https://callback.example.test/events',secret:'whsec_'+randomBytes(32).toString('base64')},ttlMs:600000};
 const first=await tokens(),second=await tokens();
 const sub=await events.handle(first.access_token,'events/subscribe',params);
 await assert.rejects(events.handle(second.access_token,'events/subscribe',params));
 const r=await refresh(first.refresh_token);const renewed=await r.json();assert.equal((await events.handle(renewed.access_token,'events/subscribe',params)).id,sub.id);
 await db.query("insert into public.activity_events(user_id,event_key,kind,actor,payload) values($1,$2,'muse.action_decision','system','{}')",[user,'oauth-work-1']);
 await events.deliver();assert.equal(deliveries,1);
 await db.query("insert into public.activity_events(user_id,event_key,kind,actor,payload) values($1,$2,'muse.action_decision','system','{}')",[user,'oauth-work-2']);
 const revoke=await fetch(base+'/oauth/token/revocation',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,token:renewed.refresh_token})});assert.equal(revoke.status,200);
 assert.equal((await db.query('select count(*)::int n from private.mcp_event_subscriptions where id=$1',[sub.id])).rows[0].n,0);
 await events.deliver();assert.equal(deliveries,1);
 assert.equal((await events.handle(second.access_token,'events/subscribe',params)).id,sub.id);
});
test('same deterministic subscription cannot race into another grant',async()=>{
 const a=await tokens(),b=await tokens();const events=createEvents({rpc,post:async(_url,_headers,body)=>({status:200,body:JSON.stringify({challenge:JSON.parse(body).challenge})})});
 const params={name:'lookout.work_available',arguments:{},delivery:{mode:'webhook',url:'https://callback.example.test/race',secret:'whsec_'+randomBytes(32).toString('base64')}};
 const outcomes=await Promise.allSettled([events.handle(a.access_token,'events/subscribe',params),events.handle(b.access_token,'events/subscribe',params)]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
});
test('grant expiry and policy disable deny access/refresh; policy disable leaves legacy credential usable',async()=>{
 const flow=await begin();const approved=await consent(flow,'approve','fixture-human',{expiresAt:new Date(Date.now()+1500).toISOString()});const complete=await approved.json();let r=await flow.request(complete.redirect);r=await flow.request(r.headers.get('location'));const authCode=new URL(r.headers.get('location')).searchParams.get('code');
 r=await exchange({...flow,code:authCode});assert.equal(r.status,200);const short=await r.json();await new Promise(resolve=>setTimeout(resolve,1600));assert.ok((await verify(short.access_token)).error);assert.equal((await refresh(short.refresh_token)).status,400);
 const valid=await tokens();await db.exec('update private.mcp_oauth_policy set enabled=false');try{assert.ok((await verify(valid.access_token)).error);assert.equal((await verify('jb_agent_'+'a'.repeat(64))).data.id,connection);assert.equal((await refresh(valid.refresh_token)).status,400);}finally{await db.exec('update private.mcp_oauth_policy set enabled=true');}
});
test('framed consent fails closed and demo content is fictional and detached',()=>{
 const view={};view.self=view;view.top=view;assert.equal(isTopLevelConsent(view),true);assert.equal(isTopLevelConsent({self:{},top:{}}),false);assert.equal(isTopLevelConsent(null),false);
 const demo=createOAuthConsentDemo();assert.match(demo.resource,/example.invalid/);demo.connections[0].scopes.push('forged');assert.equal(createOAuthConsentDemo().connections[0].scopes.length,2);
});
