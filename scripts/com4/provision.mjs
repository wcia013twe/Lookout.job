// Local-only clone of the frozen manifest. No changes to the source account.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
const root=path.resolve(process.argv[2]);
if(fs.existsSync(root))throw Error('New provisioning root required');
fs.mkdirSync(root,{recursive:true,mode:0o700});
const repo=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..');
const require=createRequire(repo+'/package.json');
const {createClient}=require('@supabase/supabase-js');
const source=JSON.parse(fs.readFileSync(path.resolve(process.argv[3]),'utf8'));
const secretFile=path.join(root,'account.private.json');
if(fs.existsSync(secretFile))throw Error('Account receipt exists; refusing to create a second account.');
const config=JSON.parse(execFileSync('/opt/homebrew/bin/supabase',['status','-o','json'],{cwd:'/Volumes/External SSD/Lookout/app',encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const url=new URL(config.API_URL);if(!['localhost','127.0.0.1'].includes(url.hostname)||url.port!=='54321')throw Error('Local stack required');
const admin=createClient(url.origin,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ok=r=>{if(r.error)throw Error('Database operation rejected: '+r.error.code);return r.data;};
const original=structuredClone(source.settings);

if(original.answers.length)throw Error('Nonempty saved answers require a dedicated provenance-preserving clone; refusing partial clone.');
const pdf=fs.readFileSync(path.resolve(process.argv[4]));
const hash=createHash('sha256').update(pdf).digest('hex');
if(original.resumes.some(r=>r.content_hash!==hash||!r.object_path))throw Error('This fixture needs additional resume files.');
const email='com4-workspace-'+randomUUID().slice(0,8)+'@example.test';
const password=randomBytes(30).toString('base64url')+'aA9!';
const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{benchmarkTaskId:'COM4'},user_metadata:{benchmark:true}})).user;
// Persist immediately so a failed setup never leaves an untracked account.
const receipt={benchmarkTaskId:'COM4',email,password,userId:user.id,apiUrl:url.origin,mcpUrl:'http://127.0.0.1:8080/mcp',status:'initializing',sourcePersonalVersion:source.personalVersion};
const persist=()=>fs.writeFileSync(secretFile,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});persist();
const mapping=new Map([[original.profile.user_id,user.id],...original.resumes.map(r=>[r.id,randomUUID()])]);
function remap(v){if(typeof v==='string'){for(const [a,b] of mapping)v=v.replaceAll(a,b);return v;}if(Array.isArray(v))return v.map(remap);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,remap(x)]));return v;}
ok(await admin.from('profiles').upsert({...remap(original.profile),user_id:user.id}));
for(const old of original.resumes){const row=remap(old);ok(await admin.storage.from('resumes').upload(row.object_path,pdf,{contentType:'application/pdf',upsert:false}));ok(await admin.from('resumes').insert(row));}
ok(await admin.from('preferences').upsert({...remap(original.preferences),user_id:user.id}));
const token='jb_agent_'+randomBytes(32).toString('hex');
// No activity:write: direct database audit writes are disabled for this credential.
const scopes=['workspace:read','network:write'];
ok(await admin.rpc('manage_agent_connection',{owner_id:user.id,operation:'connections.issue',payload:{name:'Recruiting workspace',tokenHash:createHash('sha256').update(token).digest('hex'),expiresInDays:7,scopes}}));
receipt.token=token;receipt.scopes=scopes;receipt.idMapping=Object.fromEntries(mapping);persist();
async function rpc(name,args={}){const res=await fetch(receipt.mcpUrl,{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream',authorization:'Bearer '+token},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});const j=await res.json();if(!res.ok||j.error||j.result?.isError)throw Error('Read-back MCP rejected');const d=j.result.structuredContent||JSON.parse(j.result.content[0].text);return d.data||d;}
const actual=await rpc('read_personal_context');
const expected=remap(original);
const normalize=s=>({...s,resumes:[...s.resumes].sort((a,b)=>a.id.localeCompare(b.id))});
if(!isDeepStrictEqual(normalize(actual.settings),normalize(expected)))throw Error('Cloned personal context differs beyond ownership mapping; inspect before use.');
const check=ok(await admin.storage.from('resumes').download(remap(original.resumes[0].object_path)));
if(createHash('sha256').update(Buffer.from(await check.arrayBuffer())).digest('hex')!==hash)throw Error('Cloned resume mismatch');
receipt.status='verified';receipt.personalVersion=actual.personalVersion;persist();
fs.writeFileSync(path.join(root,'cloned-context.private.json'),JSON.stringify(actual,null,2)+'\n',{mode:0o600});
fs.writeFileSync(path.join(root,'account-receipt.json'),JSON.stringify({email,userId:user.id,environment:'local',profileEquivalent:true,resumeHashVerified:true,ownershipIdsRemapped:true,sourcePersonalVersion:source.personalVersion,clonePersonalVersion:actual.personalVersion,scopes,logs:'local proxy required'},null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({email,environment:'local',status:'verified',profileEquivalent:true,resumeHashVerified:true}));

fs.mkdirSync(path.join(root,'suite'));fs.writeFileSync(path.join(root,'suite/initial-state.json'),JSON.stringify({profileFacts:actual.settings.profile.facts})+'\n',{mode:0o600});fs.writeFileSync(path.join(root,'account.lock'),'');
