import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {generateKeyPair,SignJWT,createLocalJWKSet,exportJWK} from 'jose';
import {createTestDatabase} from './helpers/database.mjs';
import {verifyMcpOAuth} from '../backend/oauth-preparation/boundary.mjs';
const user='11111111-1111-1111-1111-111111111111',client='33333333-3333-3333-3333-333333333333';
const connection='44444444-4444-4444-4444-444444444444',session='55555555-5555-5555-5555-555555555555',consent='66666666-6666-6666-6666-666666666666';
const resource='https://mcp.example.test/mcp',issuer='https://provider.example.test/auth/v1';
let db,keys,claims,expires;
before(async()=>{
 db=await createTestDatabase(); keys=await generateKeyPair('ES256');
 await db.exec(`create table auth.sessions(id uuid primary key,user_id uuid,oauth_client_id uuid,created_at timestamptz,not_after timestamptz);
 create table auth.oauth_consents(id uuid primary key,user_id uuid,client_id uuid,granted_at timestamptz,revoked_at timestamptz);`);
 await db.exec(await readFile(new URL('../backend/oauth-preparation/boundary.sql',import.meta.url),'utf8'));
 await db.exec(`insert into private.agent_connections(id,user_id,name,token_hash,scopes,expires_at) values
 ('${connection}','${user}','fictional','fixture-only',array['workspace:read','activity:write'],now()+interval '1 day');
 insert into auth.oauth_consents values('${consent}','${user}','${client}',now()-interval '1 hour',null);
 insert into private.mcp_oauth_bindings select '${user}','${client}','${connection}','${consent}',granted_at,'${resource}',array['workspace:read','activity:write'],now()-interval '1 minute',now()+interval '1 hour',null from auth.oauth_consents;
 insert into auth.sessions values('${session}','${user}','${client}',now(),null);`);
 expires=Math.floor(Date.now()/1000)+7200;
 claims={sub:user,session_id:session,client_id:client,role:'authenticated',aud:'authenticated',iss:issuer,exp:expires,iat:Math.floor(Date.now()/1000),aal:'aal1',is_anonymous:false,email:'fixture@example.test',phone:'',user_metadata:{admin:true}};
});
after(async()=>{await db?.close();});
async function hook(method='oauth_provider/authorization_code',patch={}){
 return (await db.query('select private.mcp_oauth_token_hook($1) as result',[{user_id:user,authentication_method:method,claims:{...claims,...patch}}])).rows[0].result.claims;
}
async function resolveBinding(c){return (await db.query('select private.resolve_mcp_oauth_binding($1) as result',[c])).rows[0].result;}
async function signed(c,key=keys.privateKey){return new SignJWT(c).setProtectedHeader({alg:'ES256',kid:'fixture'}).sign(key);}
const options=()=>({key:keys.publicKey,issuer,resource,clientId:client,resolveBinding});
async function rollbackCheck(sql,fn){await db.exec('begin');try{await db.exec(sql);await fn();}finally{await db.exec('rollback');}}
test('actual SQL hook isolates initial and refresh claims; real ES256 token resolves same connection',async()=>{
 const initial=await hook(),refreshed=await hook('token_refresh');
 assert.deepEqual(initial,refreshed);assert.equal(initial.aud,resource);assert.equal(initial.role,'lookout_mcp_no_database');
 assert.equal(initial.email,'');assert.equal(initial.user_metadata,undefined);assert.ok(initial.exp<expires);
 assert.deepEqual(await verifyMcpOAuth(await signed(initial),options()),{connectionId:connection,sessionId:session,clientId:client,scopes:['workspace:read','activity:write']});
 await assert.rejects(db.exec('set role lookout_mcp_no_database'),/does not exist/);
});
test('human hook claims unchanged; human JWT never accepted by MCP verifier',async()=>{
 await rollbackCheck(`update auth.sessions set oauth_client_id=null`,async()=>{
 const human={...claims};delete human.client_id;
 const result=(await db.query('select private.mcp_oauth_token_hook($1) as result',[{user_id:user,authentication_method:'password',claims:human}])).rows[0].result.claims;
 assert.deepEqual(result,human);await assert.rejects(verifyMcpOAuth(await signed(result),options()));
 });
});
for(const [name,sql] of [
 ['connection revoked',`update private.agent_connections set revoked_at=now()`],
 ['connection expired',`update private.agent_connections set expires_at=now()-interval '1 second'`],
 ['scopes changed',`update private.agent_connections set scopes=array['workspace:read']`],
 ['wrong owner',`update private.agent_connections set user_id='22222222-2222-2222-2222-222222222222'`],
 ['grant revoked',`update auth.oauth_consents set revoked_at=now()`],
 ['grant replaced',`update auth.oauth_consents set granted_at=now()`],
 ['session removed',`delete from auth.sessions`],
 ['session expired',`update auth.sessions set not_after=now()-interval '1 second'`],
 ['old session',`update auth.sessions set created_at=now()-interval '1 day'`],
 ['wrong session client',`update auth.sessions set oauth_client_id=null`],
 ['binding revoked',`update private.mcp_oauth_bindings set revoked_at=now()`],
 ['reserved role accidentally created',`create role lookout_mcp_no_database`],
]) test(`${name} denies hook issuance, refresh and existing token use`,async()=>{
 const token=await signed(await hook());
 await rollbackCheck(sql,async()=>{
 // Failed SQL aborts transactions; use savepoints for independent rejection checks.
 for(const fn of [()=>hook(),()=>hook('token_refresh'),()=>verifyMcpOAuth(token,options())]){
 await db.exec('savepoint rejection');await assert.rejects(fn());await db.exec('rollback to savepoint rejection');
 }
 });
});
test('binding cannot silently switch connection, extend lifetime, delete or resurrect',async()=>{
 for(const sql of [`update private.mcp_oauth_bindings set connection_id=gen_random_uuid()`,
 `update private.mcp_oauth_bindings set expires_at=expires_at+interval '1 day'`,
 `delete from private.mcp_oauth_bindings`])await assert.rejects(db.exec(sql),/immutable/);
 await rollbackCheck(`update private.mcp_oauth_bindings set revoked_at=now()`,async()=>{
 await assert.rejects(db.exec('update private.mcp_oauth_bindings set revoked_at=null'),/immutable/);
 });
});
test('human and anonymous SQL roles cannot invoke hook, resolver or read bindings',async()=>{
 for(const role of ['anon','authenticated'])for(const sql of ['select * from private.mcp_oauth_bindings',
 "select private.resolve_mcp_oauth_binding('{}')","select private.mcp_oauth_token_hook('{}')"]){
 await db.exec(`begin;set local role ${role}`);try{await assert.rejects(db.exec(sql),/permission denied/);}finally{await db.exec('rollback');}
 }
});
test('wrong JWT identity, claims, signature and stale bindings are rejected',async()=>{
 const valid=await hook();
 for(const patch of [{aud:'authenticated'},{aud:[resource,'authenticated']},{iss:'https://other.test'},
 {role:'authenticated'},{client_id:user},{session_id:user},{lookout_connection_id:user},{exp:1},{iat:expires},{client_id:undefined}]){
 await assert.rejects(verifyMcpOAuth(await signed({...valid,...patch}),options()));
 }
 const other=await generateKeyPair('ES256');await assert.rejects(verifyMcpOAuth(await signed(valid,other.privateKey),options()));
 await assert.rejects(verifyMcpOAuth(await signed(valid),{...options(),resolveBinding:async()=>null}));
 await assert.rejects(verifyMcpOAuth(await signed(valid),{...options(),resolveBinding:async()=>{throw Error('database unavailable');}}));
 const jwk=await exportJWK(keys.publicKey);jwk.kid='fixture';
 assert.equal((await verifyMcpOAuth(await signed(valid),{...options(),key:createLocalJWKSet({keys:[jwk]})})).connectionId,connection);
});
test('missing client, unsupported hook method and mismatched subject fail closed',async()=>{
 await assert.rejects(hook('token_refresh',{client_id:undefined}));
 await assert.rejects(hook('password'));await assert.rejects(hook(undefined,{sub:client}));
});
