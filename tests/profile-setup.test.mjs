import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import {vector} from '@electric-sql/pglite/vector';
import { validateRequest } from '../supabase/functions/agent-gateway/contract.mjs';
import { verifyResumeBytes, resumeSetupResponse } from '../supabase/functions/agent-gateway/profile-setup.mjs';
import { uploadProfileResume } from '../runner/profile-upload.mjs';
import { createHandler } from '../supabase/functions/agent-mcp/protocol.mjs';
const pdf=Buffer.from('%PDF-1.7\nfixture resume\n%%EOF');
const hash=createHash('sha256').update(pdf).digest('hex');
const uid='11111111-1111-1111-1111-111111111111',other='22222222-2222-2222-2222-222222222222';
const plan={uploadId:'33333333-3333-3333-3333-333333333333',objectPath:`${uid}/33333333-3333-3333-3333-333333333333.pdf`,bytes:pdf.length,sha256:hash,extension:'pdf',expiresAt:'later'};
const importPayload={eventKey:'setup-1',expectedPersonalVersion:1,facts:{name:'Candidate',education:[{school:'University',endDate:'2027-05'}]},answers:[{question:'Why this role?',answer:'Systems work',requestedPolicy:'auto'}]};

test('profile setup rejects verification claims, forged ownership, malformed records and oversized files',()=>{
 for(const extra of [{userId:other},{verified:true},{facts:{verified:true}},{facts:{workExperience:[{current:'true'}]}},{answers:[{question:'Q',answer:'A',verified:true}]}]) assert.throws(()=>validateRequest({operation:'profile.import',payload:{...importPayload,...extra}}));
 assert.doesNotThrow(()=>validateRequest({operation:'profile.import',payload:importPayload}));
 const metadata={eventKey:'file',fileName:'resume.pdf',variant:'Master',sha256:hash,bytes:pdf.length};
 for(const extra of [{bytes:10485761},{fileName:'../resume.pdf'},{objectPath:`${other}/stolen.pdf`},{sha256:'fake'}]) assert.throws(()=>validateRequest({operation:'resumes.begin_upload',payload:{...metadata,...extra}}));
 assert.throws(()=>validateRequest({operation:'connections.profile_setup',payload:{id:uid,enabled:'true'}}));
});

test('uploaded resume bytes must match registered size, signature and checksum',async()=>{
 assert.deepEqual(await verifyResumeBytes(new Blob([pdf]),plan),{hash,bytes:pdf.length});
 await assert.rejects(verifyResumeBytes(new Blob([pdf]),{...plan,bytes:1}));
 await assert.rejects(verifyResumeBytes(new Blob([pdf]),{...plan,sha256:'0'.repeat(64)}));
 await assert.rejects(verifyResumeBytes(new Blob(['not a resume']),{...plan,bytes:12}));
 await assert.rejects(verifyResumeBytes(new Blob([Buffer.from([0x50,0x4b,3,4])]),{...plan,bytes:4,extension:'docx'}));
 let args;
 const response=await resumeSetupResponse({operation:'resumes.complete_upload',data:plan,storage:{download:async path=>{assert.equal(path,plan.objectPath);return {data:new Blob([pdf])};}},credentialHash:'private',rpc:async(name,p)=>{args=p;return {data:{resume:{id:plan.uploadId}}};}});
 assert.equal(response.resume.id,plan.uploadId);assert.equal(args.actual_hash,hash);
 let registration=false;
 await assert.rejects(resumeSetupResponse({operation:'resumes.complete_upload',data:plan,storage:{download:async()=>({data:new Blob(['bad'])})},rpc:async()=>{registration=true;}}));
 assert.equal(registration,false);
});

test('local resume tool reuses a matching uploaded file without transmitting bytes again',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'profile-upload-'));
 try {
  const path=join(directory,'resume.pdf');await writeFile(path,pdf);
  let calls=0;
  const result=await uploadProfileResume({filePath:path,variant:'Master',eventKey:'file',gateway:{call:async(op,args)=>{calls++;assert.equal(op,'resumes.begin_upload');assert.equal(args.sha256,hash);return {resume:{id:uid}};}},fetchImpl:()=>{throw Error('Must not upload');}});
  assert.equal(result.resume.id,uid);assert.equal(calls,1);
  await assert.rejects(uploadProfileResume({filePath:path,variant:'Master',eventKey:'file',gateway:{call:async()=>({uploadUrl:'https://evil.test/upload'})},fetchImpl:()=>{throw Error('Must not contact');}}),/Invalid private upload URL/);
  const requests=[];
  const complete=await uploadProfileResume({filePath:path,variant:'Master',eventKey:'file',gateway:{call:async(op)=>op==='resumes.begin_upload'?{...plan,contentType:'application/pdf',uploadUrl:`https://umhqfqzpwmszhcknwtrs.supabase.co/storage/v1/object/upload/sign/resumes/${plan.objectPath}?token=test`}:{resume:{id:plan.uploadId}}},fetchImpl:async(url,options)=>{requests.push(options);return new Response(null,{status:200});}});
  assert.equal(complete.resume.id,plan.uploadId);assert.deepEqual(requests[0].body,pdf);assert.equal(requests[0].redirect,'error');assert.equal(requests[0].headers.Authorization,undefined);
 } finally {await rm(directory,{recursive:true});}
});

test('profile setup MCP tools are hidden from old preparation/read-only keys',async()=>{
 const token='jb_agent_'+'a'.repeat(64);
 for(const scope of ['drafts:write','workspace:read','profile:write']) {
  const handler=createHandler(async()=>({status:200,data:{scopes:[scope]}}));
  const response=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}));
  const names=(await response.json()).result.tools.map(tool=>tool.name);
  assert.equal(names.includes('save_profile_package'),scope==='profile:write');
  assert.equal(names.includes('begin_resume_upload'),scope==='profile:write');
 }
});

test('profile imports, uploads, defaults and scope changes keep ownership and human-review boundaries',async()=>{
 const db=new PGlite({extensions:{vector}});
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;`);
  const dir=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,dir),'utf8'));
  await db.query('insert into auth.users values($1),($2)',[uid,other]);
  const conn=(await db.query("select public.manage_agent_connection($1,'connections.issue',$2) data",[uid,{name:'Muse',tokenHash:'a'.repeat(64),scopes:['workspace:read','drafts:write']}])).rows[0].data;
  const call=async(op,p={})=>(await db.query('select public.agent_dispatch($1,$2,$3) data',['a'.repeat(64),op,p])).rows[0].data;
  await assert.rejects(call('profile.import',importPayload),/scope required/i);
  await assert.rejects(db.query("select public.manage_agent_connection($1,'connections.profile_setup',$2)",[other,{id:conn.id,enabled:true}]),/owned/i);
  await db.query("select public.manage_agent_connection($1,'connections.profile_setup',$2)",[uid,{id:conn.id,enabled:true}]);
  const version=async()=> (await call('context.versions')).personalVersion;
  // Exercise the actual service-role grants, not just superuser tests.
  await db.exec('set role service_role');
  const imported=await call('profile.import',importPayload);
  assert.equal(imported.profile.verified_at,null);assert.equal(imported.answers[0].autofill_policy,'ask');assert.equal(imported.answers[0].verified_at,null);assert.equal(imported.answers[0].provenance,'agent');
  const after=await version();assert.ok(after>1);
  assert.deepEqual(await call('profile.import',importPayload),imported);assert.equal(await version(),after);
  await assert.rejects(call('profile.import',{...importPayload,facts:{name:'Other'}}),/key reused/);
  await assert.rejects(call('profile.import',{...importPayload,eventKey:'stale'}),/Settings changed/);
  await assert.rejects(call('profile.import',{eventKey:'owner-forge',expectedPersonalVersion:after,defaultResumeId:other}),/owned/i);
  const upload=await call('resumes.begin_upload',{eventKey:'resume',fileName:'resume.pdf',variant:'Master',bytes:pdf.length,sha256:hash});
  assert.equal(upload.objectPath,`${uid}/${upload.uploadId}.pdf`);
  await assert.rejects(db.query('select public.finish_agent_resume_upload($1,$2,$3,$4)',['a'.repeat(64),upload.uploadId,'0'.repeat(64),pdf.length]),/mismatch/);
  const uploaded=(await db.query('select public.finish_agent_resume_upload($1,$2,$3,$4) data',['a'.repeat(64),upload.uploadId,hash,pdf.length])).rows[0].data;
  assert.equal(uploaded.resume.id,upload.uploadId);
  const reused=await call('resumes.begin_upload',{eventKey:'same-file',fileName:'resume.pdf',variant:'Master',bytes:pdf.length,sha256:hash});
  assert.equal(reused.resume.id,upload.uploadId);
  const defaulted=await call('profile.import',{eventKey:'default',expectedPersonalVersion:await version(),defaultResumeId:upload.uploadId});
  assert.equal(defaulted.defaultResumeId,upload.uploadId);
  await assert.rejects(call('profile.import',{eventKey:'fake-verify',expectedPersonalVersion:await version(),facts:{verified:true}}),/Invalid facts/);
  await db.exec('reset role');
  await db.query("update public.profiles set facts=facts || '{\"introduction\":\"Keep this\"}',verified_at=now() where user_id=$1",[uid]);
  const same=await call('profile.import',{eventKey:'same',expectedPersonalVersion:await version(),facts:{name:'Candidate'}});assert.ok(same.profile.verified_at);assert.equal(same.profile.facts.introduction,'Keep this');
  const changed=await call('profile.import',{eventKey:'changed',expectedPersonalVersion:await version(),facts:{phone:'555'}});assert.equal(changed.profile.verified_at,null);assert.equal(changed.profile.facts.introduction,'Keep this');
  assert.equal((await db.query('select count(*) count from public.approvals')).rows[0].count,0);
  await db.query("select public.manage_agent_connection($1,'connections.profile_setup',$2)",[uid,{id:conn.id,enabled:false}]);
  await assert.rejects(call('resumes.complete_upload',{uploadId:upload.uploadId}),/scope required/i);
  await db.query('delete from public.resumes where id=$1',[upload.uploadId]);
  assert.equal((await db.query('select count(*) count from private.agent_resume_uploads')).rows[0].count,0);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select public.agent_dispatch($1,$2,$3)',['a'.repeat(64),'profile.import',importPayload]));
  await assert.rejects(db.query('select * from private.agent_resume_uploads'));
 } finally {await db.close();}
});
