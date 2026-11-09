// Clone N01's frozen candidate into a new local-only JOB01 account. No source writes.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {createClient} from '@supabase/supabase-js';
const [mode,root,sourceManifest,resumeFile]=process.argv.slice(2);
if(!root||!['create','snapshot'].includes(mode))throw Error('Usage: account.mjs create ROOT N01_MANIFEST RESUME | snapshot ROOT OUTPUT');
const cfg=JSON.parse(execFileSync('supabase',['status','-o','json'],{cwd:path.resolve(import.meta.dirname,'../..'),encoding:'utf8',stdio:['ignore','pipe','pipe']}));
if(cfg.API_URL!=='http://127.0.0.1:54321')throw Error('Expected existing local stack only');
const db=createClient(cfg.API_URL,cfg.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ok=r=>{if(r.error)throw Error('Local operation failed: '+r.error.code);return r.data;};
const hash=v=>createHash('sha256').update(v).digest('hex');
const file=path.join(root,'account.private.json');
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{mode:0o600});
if(mode==='snapshot'){
 const a=JSON.parse(fs.readFileSync(file));
 if(a.status!=='verified'||!/^(?:n02|job01)-pilot-[a-f0-9-]+@example.test$/.test(a.email))throw Error('Dedicated JOB01 receipt required');
 if(ok(await db.auth.admin.getUserById(a.userId)).user.email!==a.email)throw Error('Owner mismatch');
 const out={capturedAt:new Date().toISOString(),tables:{}};
 for(const t of ['profiles','preferences','resumes','answer_library','job_batches','applications'])out.tables[t]=ok(await db.from(t).select('*').eq('user_id',a.userId).limit(10000));
 const batchIds=out.tables.job_batches.map(x=>x.id);
 out.tables.batch_items=batchIds.length?ok(await db.from('batch_items').select('*').in('batch_id',batchIds)):[];
 const ids=out.tables.batch_items.map(x=>x.job_id);
 out.tables.jobs=ids.length?ok(await db.from('jobs').select('*').in('id',ids)):[];
 write(sourceManifest,out);console.log('Dedicated JOB01 state captured');
}else{
 if(fs.existsSync(file))throw Error('Receipt already exists; never create/retry over an existing account');
 const source=JSON.parse(fs.readFileSync(sourceManifest)),original=structuredClone(source.settings);
 const pdf=fs.readFileSync(resumeFile);
 if(original.answers.length||original.resumes.some(r=>r.content_hash!==hash(pdf)||!r.object_path))throw Error('Candidate needs additional provenance/files');
 const email='job01-pilot-'+randomUUID()+'@example.test',password=randomBytes(32).toString('base64url')+'aA9!';
 const user=ok(await db.auth.admin.createUser({email,password,email_confirm:true})).user;
 const a={email,password,userId:user.id,apiUrl:cfg.API_URL,mcpUrl:'http://127.0.0.1:8080/mcp',status:'initializing',sourceManifestHash:hash(fs.readFileSync(sourceManifest))};write(file,a);
 const mapping=new Map([[original.profile.user_id,user.id],...original.resumes.map(r=>[r.id,randomUUID()])]);
 function remap(v){if(typeof v==='string'){for(const [a,b]of mapping)v=v.replaceAll(a,b);return v;}if(Array.isArray(v))return v.map(remap);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,remap(x)]));return v;}
 const expected=remap(original);
 ok(await db.from('profiles').upsert({...expected.profile,user_id:user.id}));
 for(const r of expected.resumes){ok(await db.storage.from('resumes').upload(r.object_path,pdf,{contentType:'application/pdf'}));ok(await db.from('resumes').insert(r));}
 ok(await db.from('preferences').upsert({...expected.preferences,user_id:user.id}));
 const token='jb_agent_'+randomBytes(32).toString('hex');
 const scopes=['workspace:read','profile:write','preferences:write','batches:write'];
 ok(await db.rpc('manage_agent_connection',{owner_id:user.id,operation:'connections.issue',payload:{name:'JOB01 isolated pilot',tokenHash:hash(token),expiresInDays:7,scopes}}));
 Object.assign(a,{token,scopes,idMapping:Object.fromEntries(mapping)});write(file,a);
 const res=await fetch(a.mcpUrl,{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream',authorization:'Bearer '+token},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'read_personal_context',arguments:{}}})});
 const reply=await res.json();if(!res.ok||reply.error||reply.result?.isError)throw Error('Native readback failed');
 const value=reply.result.structuredContent||JSON.parse(reply.result.content[0].text),actual=value.data||value;
 const normalize=s=>({...s,resumes:[...s.resumes].sort((a,b)=>a.id.localeCompare(b.id))});
 if(!isDeepStrictEqual(normalize(actual.settings),normalize(expected)))throw Error('Clone differs beyond ownership IDs');
 const downloaded=ok(await db.storage.from('resumes').download(expected.resumes[0].object_path));
 if(hash(Buffer.from(await downloaded.arrayBuffer()))!==hash(pdf))throw Error('Resume clone mismatch');
 a.status='verified';write(file,a);write(path.join(root,'cloned-context.private.json'),actual);
 console.log(JSON.stringify({status:a.status,profileEquivalent:true,resumeHashVerified:true,sourceUntouched:true}));
}
