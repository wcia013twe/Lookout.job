import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mapApilayerResponse,createResumeParser,apilayerConfig,ResumeParseError} from '../backend/runtime/resume-parser.ts';
import {profileImportChoices,selectedProfileFields,requestResumeParse,validateResumeParse} from '../lib/resume-import.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {createApi} from '../backend/runtime/api.ts';
import {createDispatch} from '../backend/runtime/service.ts';
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',token='jb_agent_'+'a'.repeat(64);
const response=()=>({name:'Jordan Example',email:'jordan@example.com',skills:['JS','PostgreSQL'],experience:[{organization:'Example Systems',title:'Engineer',location:'New York',dates:'2022 - Present'}],education:[{name:'Example University',dates:'2019'}],authorization:'Must not import',rawText:'Must not import',firstName:'Do not invent name parts',projects:[{name:'Undocumented'}]});
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
function harness(){
 const state={owner,revoked:false,scopes:['workspace:read','resumes:read','profile:write'],superseded:false,hashMismatch:false,noProfile:false,profileTime:'2026-10-26T12:00:00Z',providerStatus:200,calls:0,downloads:0};
 const blob=new Blob(['%PDF-1.4 fictional fixture']);const hash=createHash('sha256').update(Buffer.from('%PDF-1.4 fictional fixture')).digest('hex');
 const row=()=>({id,user_id:owner,object_path:owner+'/'+id+'.pdf',content_hash:state.hashMismatch?'f'.repeat(64):hash,superseded_by:state.superseded?id:null});
 const client={auth:{getUser:async()=>({data:{user:state.revoked?null:{id:state.owner}},error:state.revoked?{}:null})},rpc:async(_name,args)=>args.operation==='credentials.verify'?{data:{scopes:state.scopes},error:state.revoked?{}:null}:{data:state.revoked?null:row(),error:state.revoked?{}:null},from(table){const filters={};const query={select(){return query;},eq(k,v){filters[k]=v;return query;},async maybeSingle(){return {data:table==='profiles'?(state.noProfile?null:{updated_at:state.profileTime,facts:{name:'Saved name'}}):filters.user_id===owner&&filters.id===id?row():null};}};return query;},storage:{from:()=>({download:async()=>{state.downloads++;return {data:blob};}})}};
 const parser=createResumeParser({client,config:()=>({url:'https://api.apilayer.com/resume_parser/upload',key:'secret-test-key'}),request:async(url,init)=>{state.calls++;assert.equal(url,'https://api.apilayer.com/resume_parser/upload');assert.equal(init.headers.apikey,'secret-test-key');assert.equal(init.headers['Content-Type'],'application/octet-stream');assert.ok(!init.headers.Authorization);assert.equal(init.redirect,'error');assert.equal(init.body,blob);return json(response(),state.providerStatus);}});
 return {state,parser};
}
test('APILayer mapping uses documented fields and preserves ambiguous dates as source text',()=>{
 const result=mapApilayerResponse(response());assert.equal(result.provider,'apilayer');assert.equal(result.facts.name,'Jordan Example');assert.equal(result.facts.skills,'JS\nPostgreSQL');assert.equal(result.facts.workExperience[0].company,'Example Systems');assert.equal(result.facts.workExperience[0].description,'Dates returned by parser: 2022 - Present');assert.equal(result.facts.education[0].description,'Dates returned by parser: 2019');
 for(const field of ['startDate','endDate','current'])assert.ok(!(field in result.facts.workExperience[0]));assert.ok(result.warnings.some(w=>w.includes('normalized or incomplete')));assert.ok(result.warnings.some(w=>w.includes('OCR support is unverified')));
 for(const field of ['authorization','firstName','lastName','projects','rawText','verified'])assert.ok(!(field in result.facts));
});
test('unexpected wrappers, malformed records, HTTP-200 errors and empty extraction fail closed',()=>{
 for(const body of [{data:{name:'Old schema'},meta:{schemaVersion:'1.0'}},{message:'provider error'},{name:42},{skills:[{}]},{experience:[null]},{education:[{name:{bad:true}}]}])assert.throws(()=>mapApilayerResponse(body),/unsupported/);
 assert.throws(()=>mapApilayerResponse({name:'',skills:[],education:[],experience:[]}),/No supported/);
});
test('only selected changes replace sections; existing histories default unchecked',()=>{
 const current={name:'Saved',workExperience:[{company:'Existing'}]};const choices=profileImportChoices(current,{name:'New',email:'new@example.com',workExperience:[{company:'New'}],education:[]});assert.deepEqual(choices.filter(c=>c.selected).map(c=>c.key),['email']);assert.deepEqual(selectedProfileFields(choices,['email']),{email:'new@example.com'});assert.deepEqual(current.workExperience,[{company:'Existing'}]);
});
test('parser config requires only APILayer server key and pins the upload endpoint',()=>{
 assert.throws(()=>apilayerConfig({}),/not configured/);assert.throws(()=>apilayerConfig({AFFINDA_API_KEY:'obsolete'}),/not configured/);
 assert.deepEqual(apilayerConfig({APILAYER_API_KEY:' secret ',APILAYER_BASE_URL:'https://evil.example'}),{url:'https://api.apilayer.com/resume_parser/upload',key:'secret'});
});
test('closed payload rejects identities, arbitrary URLs and paths on every entry point',()=>{
 for(const payload of [{},{resumeId:id,userId:owner},{resumeId:id,url:'https://evil.example'},{resumeId:'../../secret'},null])assert.throws(()=>validateResumeParse(payload));assert.doesNotThrow(()=>validateRequest({operation:'resumes.parse',payload:{resumeId:id}}));
});
test('human and agent paths share extraction, per-owner cache, and current profile timestamp',async()=>{
 const {state,parser}=harness();const [human,agent]=await Promise.all([parser.human('human-token',{resumeId:id}),parser.agent(token,{resumeId:id})]);assert.deepEqual(human,agent);assert.equal(state.calls,1);assert.equal(human.profileFacts.name,'Saved name');assert.equal(human.reviewRequired,true);state.profileTime='2026-10-26T13:00:00Z';assert.equal((await parser.human('human-token',{resumeId:id})).profileUpdatedAt,state.profileTime);assert.equal(state.calls,1);
});
test('new-account tutorial can parse before the profile row exists',async()=>{const {state,parser}=harness();state.noProfile=true;const result=await parser.human('human-token',{resumeId:id});assert.equal(result.profileUpdatedAt,null);assert.deepEqual(result.profileFacts,{});});
test('foreign owner, missing scope, superseded resume and revoked credentials never reach provider',async()=>{
 const {state,parser}=harness();state.owner='33333333-3333-4333-8333-333333333333';await assert.rejects(parser.human('human-token',{resumeId:id}),/current uploaded/);state.owner=owner;state.scopes=['workspace:read','resumes:read'];await assert.rejects(parser.agent(token,{resumeId:id}),/requires/);state.scopes.push('profile:write');state.superseded=true;await assert.rejects(parser.agent(token,{resumeId:id}),/current uploaded/);state.superseded=false;state.revoked=true;await assert.rejects(parser.human('human-token',{resumeId:id}),/Sign in/);assert.equal(state.calls,0);
});
test('cache hits still recheck access; checksum failures never send bytes externally',async()=>{
 const {state,parser}=harness();await parser.human('human-token',{resumeId:id});state.revoked=true;await assert.rejects(parser.human('human-token',{resumeId:id}),/Sign in/);assert.equal(state.calls,1);
 const next=harness();next.state.hashMismatch=true;await assert.rejects(next.parser.human('human-token',{resumeId:id}),/contents/);assert.equal(next.state.calls,0);
});
test('provider errors are sanitized and failed calls do not become successful cached results',async()=>{
 const {state,parser}=harness();state.providerStatus=402;await assert.rejects(parser.human('human-token',{resumeId:id}),/request allowance/);state.providerStatus=200;await parser.human('human-token',{resumeId:id});assert.equal(state.calls,2);
});
test('browser adapter rejects account changes while parsing',async()=>{
 let current=owner;const client={auth:{getSession:async()=>({data:{session:{access_token:'private-token'}}})}};
 await assert.rejects(requestResumeParse({client,getOwner:()=>current,resumeId:id,apiUrl:'http://127.0.0.1:8080',request:async()=>{current='other';return json({data:{facts:{name:'Old account'}}});}}),/Account changed/);
});
test('Node MCP discovers scoped parser only with all scopes; human route uses same parser boundary',async()=>{
 let scopes=['workspace:read','profile:write'];const calls=[];
 const dispatch=async(_token,operation,payload)=>{calls.push(operation);return operation==='credentials.verify'?{status:200,data:{scopes}}:{status:200,data:{facts:{name:'Example'},resumeId:payload.resumeId}};};
 const api=createApi({dispatch,parseHuman:async(_token,payload)=>{validateResumeParse(payload);return {facts:{name:'Example'},resumeId:payload.resumeId};}});await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+api.address().port;const headers={Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'};
  const list=async()=>await (await fetch(base+'/mcp',{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})})).json();
  assert.ok(!(await list()).result.tools.some(t=>t.name==='parse_profile_resume'));scopes.push('resumes:read');assert.ok((await list()).result.tools.some(t=>t.name==='parse_profile_resume'));
  const parsed=await fetch(base+'/v1/resume-import',{method:'POST',headers:{...headers,Authorization:'Bearer human-token'},body:JSON.stringify({resumeId:id})});assert.equal(parsed.status,200);assert.equal((await parsed.json()).data.resumeId,id);
  assert.equal((await fetch(base+'/v1/resume-import',{method:'POST',headers,body:JSON.stringify({resumeId:id,userId:owner})})).status,400);
  assert.equal((await fetch(base+'/v1/resume-import',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:JSON.stringify({resumeId:id})})).status,403);
 }finally{api.closeAllConnections();await new Promise(resolve=>api.close(resolve));}
});
test('Node operation maps parser errors without leaking provider messages',async()=>{
 const dispatch=createDispatch({rpc:async()=>{throw Error('should not forward');},supabaseUrl:'http://localhost:54321',parseResume:async()=>{throw new ResumeParseError(503,'Not configured');}});assert.deepEqual(await dispatch(token,'resumes.parse',{resumeId:id}),{status:503,error:'Not configured'});
});

test('APILayer authentication, quotas and unreadable-document errors have safe recovery messages',async()=>{
 for(const [status,pattern]of [[401,/key and Resume Parser subscription/],[403,/key and Resume Parser subscription/],[429,/request allowance/],[400,/text-based PDF/],[415,/text-based PDF/],[500,/unavailable/]]){const {state,parser}=harness();state.providerStatus=status;await assert.rejects(parser.human('human-token',{resumeId:id}),pattern);}
});
test('large history is bounded without silently dropping the source-date caveat',()=>{
 const result=mapApilayerResponse({experience:Array.from({length:51},()=>({title:'Engineer',dates:'2020'}))});assert.equal(result.facts.workExperience.length,50);assert.ok(result.warnings.some(w=>w.includes('omitted')));
});

test('observed live response accepts date arrays and partial facts without importing the misparsed phone',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/apilayer-fictional-live.json',import.meta.url),'utf8'));
 const result=mapApilayerResponse(fixture);assert.equal(result.facts.email,'jordan.example@example.com');assert.ok(!('name' in result.facts));assert.ok(!('phone' in result.facts));assert.ok(result.warnings.some(w=>w.includes('No name')));
 assert.equal(result.facts.education[0].description,'Dates returned by parser: January 2020; January 2024');assert.ok(!('startDate' in result.facts.education[0]));assert.equal(result.reviewRequired,true);
 assert.throws(()=>mapApilayerResponse({education:[{name:'School',dates:[{}]}]}),/unsupported/);
});
