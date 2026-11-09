// Creates a new explicitly assigned local demo owner; never modifies the source account.
import fs from 'node:fs';import path from 'node:path';import {parseArgs,isDeepStrictEqual} from 'node:util';
import {execFileSync} from 'node:child_process';import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const {values:v}=parseArgs({options:{manifest:{type:'string'},resume:{type:'string'},destination:{type:'string'},'stack-repo':{type:'string',default:'/Volumes/External SSD/Lookout/app'}}});
if(!v.manifest||!v.resume||!v.destination)throw Error('manifest, resume and new destination required');
const root=path.resolve(v.destination);if(fs.existsSync(root))throw Error('Destination exists; preserve previous setup');
const source=JSON.parse(fs.readFileSync(v.manifest,'utf8')),original=source.settings,pdf=fs.readFileSync(v.resume),sha=x=>createHash('sha256').update(x).digest('hex');
if(original.answers.length)throw Error('Nonempty answers need provenance-preserving clone support');
if(original.resumes.some(r=>r.content_hash!==sha(pdf)||!r.object_path))throw Error('Source needs additional exact resume files');
const cfg=JSON.parse(execFileSync('/opt/homebrew/bin/supabase',['status','-o','json'],{cwd:v['stack-repo'],encoding:'utf8',stdio:['ignore','pipe','pipe']}));
if(cfg.API_URL!=='http://127.0.0.1:54321')throw Error('Expected local stack only');
const admin=createClient(cfg.API_URL,cfg.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),ok=r=>{if(r.error)throw Error('Local operation failed: '+r.error.code);return r.data;};
fs.mkdirSync(root,{recursive:true,mode:0o700});
const save=(name,x)=>fs.writeFileSync(path.join(root,name),JSON.stringify(x,null,2)+'\n',{mode:0o600});
const email='com3-'+randomUUID().slice(0,8)+'@example.test',password=randomBytes(30).toString('base64url')+'aA9!';
const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{benchmarkTaskId:'COM3'},user_metadata:{benchmark:true}})).user;
const account={email,password,userId:user.id,apiUrl:cfg.API_URL,mcpUrl:'http://127.0.0.1:8080/mcp',benchmarkTaskId:'COM3',status:'initializing'};
save('account.private.json',account);
const mapping=new Map([[original.profile.user_id,user.id],...original.resumes.map(r=>[r.id,randomUUID()])]);
function remap(x){if(typeof x==='string'){for(const [a,b]of mapping)x=x.replaceAll(a,b);return x;}if(Array.isArray(x))return x.map(remap);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,y])=>[k,remap(y)]));return x;}
ok(await admin.from('profiles').upsert({...remap(original.profile),user_id:user.id}));
for(const old of original.resumes){const row=remap(old);ok(await admin.storage.from('resumes').upload(row.object_path,pdf,{contentType:'application/pdf',upsert:false}));ok(await admin.from('resumes').insert(row));}
ok(await admin.from('preferences').upsert({...remap(original.preferences),user_id:user.id}));
async function credential(name,scopes){const token='jb_agent_'+randomBytes(32).toString('hex');ok(await admin.rpc('manage_agent_connection',{owner_id:user.id,operation:'connections.issue',payload:{name,tokenHash:sha(token),expiresInDays:7,scopes}}));return token;}
account.scopes=['workspace:read','activity:write','network:write','drafts:write'];account.token=await credential('COM3 participant isolated',account.scopes);
account.readToken=await credential('COM3 terminal verification read only',['workspace:read']);account.readScopes=['workspace:read'];account.idMapping=Object.fromEntries(mapping);save('account.private.json',account);
const response=await fetch(account.mcpUrl,{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream',authorization:'Bearer '+account.readToken},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'read_personal_context',arguments:{}}})});
const j=await response.json();if(!response.ok||j.error||j.result?.isError)throw Error('Read-only cloned context lookup failed');
let actual=j.result.structuredContent||JSON.parse(j.result.content[0].text);actual=actual.data||actual;
const normalize=x=>({...x,resumes:[...x.resumes].sort((a,b)=>a.id.localeCompare(b.id))});
if(!isDeepStrictEqual(normalize(actual.settings),normalize(remap(original))))throw Error('Personal context differs beyond ownership remapping');
for(const old of original.resumes){const downloaded=ok(await admin.storage.from('resumes').download(remap(old.object_path)));if(sha(Buffer.from(await downloaded.arrayBuffer()))!==sha(pdf))throw Error('Resume mismatch');}
account.status='verified';account.personalVersion=actual.personalVersion;save('grader.private.json',{taskId:'COM3',userId:user.id,email,apiUrl:account.apiUrl,mcpUrl:account.mcpUrl,readToken:account.readToken,scopes:['workspace:read']});delete account.readToken;save('account.private.json',account);save('cloned-context.private.json',actual);save('source-manifest.private.json',source);
fs.mkdirSync(path.join(root,'suite'));save('suite/initial-state.json',{profileFacts:actual.settings.profile.facts});fs.closeSync(fs.openSync(path.join(root,'account.lock'),'a',0o600));
save('account-receipt.json',{taskId:'COM3',userId:user.id,email,status:'verified',localOnly:true,profileEquivalent:true,ownershipIdsRemapped:true,resumeHashVerified:true,readOnlyGraderCredential:true,sourcePersonalVersion:source.personalVersion});
console.log(JSON.stringify({taskId:'COM3',userId:user.id,email,status:'verified',localOnly:true,profileEquivalent:true,readOnlyGraderCredential:true}));
