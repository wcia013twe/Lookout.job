// Host-only JOB03/04 account setup, owner snapshots and fixture seeding.
// Uses the existing local Supabase clone pattern; never relabels a COM owner.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {createClient} from '@supabase/supabase-js';
import {cloneCanonicalProfiles,verifyCanonicalProfiles} from '../evals/canonical-search-context.mjs';
import {isolatedEndpoint,isolatedSql,isScopeDenial,isOwnershipDenial} from './isolated_endpoint.mjs';
const [operation,root,...args]=process.argv.slice(2);
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n',{mode:0o600});
const hash=x=>createHash('sha256').update(x).digest('hex');
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const backendRoot=operation==='create'?args[3]:(fs.existsSync(path.join(root,'account.private.json'))?read(path.join(root,'account.private.json')).backendRoot:null);
const endpoint=backendRoot?isolatedEndpoint(backendRoot):null;
const sql=text=>backendRoot?isolatedSql(backendRoot,text):execFileSync('docker',['exec','-i','supabase_db_lookout-local','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],{input:text,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:60000,maxBuffer:32*1024*1024});
function guard(a){
 if(!['JOB03','JOB04'].includes(a.benchmarkTaskId)||a.status!=='verified'||a.apiUrl!==(endpoint?.backend.apiUrl??'http://127.0.0.1:54321')||a.mcpUrl!==(endpoint?.backend.mcpUrl??'http://127.0.0.1:8080/mcp')||!new RegExp('^'+a.benchmarkTaskId.toLowerCase()+'-[a-f0-9-]+@example.test$').test(a.email)||!/^[-a-f0-9]{36}$/.test(a.userId))throw Error('Verified dedicated local JOB owner required');
 return `DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=${q(a.userId)}::uuid AND email=${q(a.email)} AND raw_app_meta_data->>'benchmarkTaskId'=${q(a.benchmarkTaskId)}) THEN RAISE EXCEPTION 'JOB owner assignment mismatch'; END IF; END $guard$;`;
}
async function mcp(a,name,arguments_={},readOnly=false){
 const g=readOnly?read(path.join(root,'grader.private.json')):a;
 const response=await fetch(a.mcpUrl,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:'Bearer '+(g.readToken||g.token)},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:arguments_}}),signal:AbortSignal.timeout(30000)});
 let text=await response.text();if(text.trimStart().startsWith('data:'))text=text.split('\n').find(x=>x.startsWith('data: {')).slice(6);
 const result=JSON.parse(text);if(!response.ok||result.error||result.result?.isError)throw Error('Native operation rejected: '+name);
 const v=result.result.structuredContent??JSON.parse(result.result.content.find(x=>x.type==='text').text);return v.data??v;
}
if(operation==='create'){
 const [caseId,manifest,resume]=args;if(!['JOB03','JOB04'].includes(caseId)||fs.existsSync(root))throw Error('New JOB03/04 owner destination required');
 const original=read(manifest).settings,pdf=fs.readFileSync(resume);
 if(original.answers.length||original.resumes.some(x=>x.content_hash!==hash(pdf)||!x.object_path))throw Error('Candidate requires additional exact source files/provenance');
 const cfg=endpoint?{API_URL:endpoint.backend.apiUrl}:JSON.parse(execFileSync('/opt/homebrew/bin/supabase',['status','-o','json'],{cwd:'/Volumes/External SSD/Lookout/app',encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 if(!endpoint&&cfg.API_URL!=='http://127.0.0.1:54321')throw Error('Existing local stack required');
 const db=endpoint?null:createClient(cfg.API_URL,cfg.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const ok=r=>{if(r.error)throw Error('Local clone operation rejected: '+r.error.code);return r.data;};
 fs.mkdirSync(root,{recursive:true,mode:0o700});
 const email=caseId.toLowerCase()+'-'+randomUUID()+'@example.test';
 const user=endpoint?{id:randomUUID()}:ok(await db.auth.admin.createUser({email,password:randomBytes(32).toString('base64url')+'aA9!',email_confirm:true,app_metadata:{benchmarkTaskId:caseId}})).user;
 if(endpoint)sql(`INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES(${q(user.id)}::uuid,${q(email)},${q(JSON.stringify({benchmarkTaskId:caseId}))}::jsonb);`);
 const a={email,userId:user.id,benchmarkTaskId:caseId,apiUrl:cfg.API_URL,mcpUrl:endpoint?.backend.mcpUrl??'http://127.0.0.1:8080/mcp',...(endpoint?{backendRoot:endpoint.root}:{}),status:'initializing'};write(path.join(root,'account.private.json'),a);
 const mapping=new Map([[original.profile.user_id,user.id],...original.resumes.map(x=>[x.id,randomUUID()])]);
 const remap=x=>typeof x==='string'?[...mapping].reduce((v,[from,to])=>v.replaceAll(from,to),x):Array.isArray(x)?x.map(remap):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,remap(v)])):x;
 const expected=remap(original);
 if(endpoint){
  const insert=(table,row)=>{const keys=Object.keys(row);if(keys.some(k=>!/^[_a-z]+$/.test(k)))throw Error('Invalid source field');const fields=keys.map(k=>'\"'+k+'\"').join(',');return sql(`INSERT INTO public.${table}(${fields}) SELECT ${fields} FROM jsonb_populate_record(NULL::public.${table},${q(JSON.stringify(row))}::jsonb);`);};
  insert('profiles',{...expected.profile,user_id:user.id});insert('preferences',{...expected.preferences,user_id:user.id});
  for(const row of expected.resumes)insert('resumes',row);
 }else{
  ok(await db.from('profiles').upsert({...expected.profile,user_id:user.id}));
  for(const r of expected.resumes){ok(await db.storage.from('resumes').upload(r.object_path,pdf,{contentType:'application/pdf'}));ok(await db.from('resumes').insert(r));}
  ok(await db.from('preferences').upsert({...expected.preferences,user_id:user.id}));
 }
 const canonicalDb=endpoint?{from(table){
  if(!['search_documents','search_document_revisions'].includes(table))throw Error('Canonical fixture table required');
  return {select(fields){if(fields!=='user_id,kind,id,version,content,projection')throw Error('Canonical fixture fields required');return {async eq(field,value){if(field!=='user_id'||value!==user.id)throw Error('Canonical fixture owner mismatch');return {data:JSON.parse(sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'kind',kind,'id',id,'version',version,'content',content,'projection',projection)),'[]'::jsonb) FROM public.${table} WHERE user_id=${q(user.id)}::uuid;`).trim())};}};},async insert(rows){for(const row of rows){if(row.user_id!==user.id)throw Error('Canonical insert owner mismatch');sql(`INSERT INTO public.${table}(user_id,kind,id,version,content,projection) SELECT user_id,kind,id,version,content,projection FROM jsonb_populate_record(NULL::public.${table},${q(JSON.stringify(row))}::jsonb);`);}return {data:null};}};
 }}:db;
 const canonicalClone=await cloneCanonicalProfiles(canonicalDb,expected,user.id);
 const credential=async(name,scopes)=>{const token='jb_agent_'+randomBytes(32).toString('hex'),payload={name,tokenHash:hash(token),expiresInDays:endpoint?90:7,scopes};if(endpoint)sql(`SELECT public.manage_agent_connection(${q(user.id)}::uuid,'connections.issue',${q(JSON.stringify(payload))}::jsonb);`);else ok(await db.rpc('manage_agent_connection',{owner_id:user.id,operation:'connections.issue',payload}));return token;};
 a.scopes=['workspace:read','drafts:write','activity:write','tracking:write','answers:write'];a.token=await credential(caseId+' participant',a.scopes);a.idMapping=Object.fromEntries(mapping);write(path.join(root,'account.private.json'),a);
 const readToken=await credential(caseId+' terminal verification',['workspace:read']);write(path.join(root,'grader.private.json'),{taskId:caseId,userId:user.id,mcpUrl:a.mcpUrl,readToken,scopes:['workspace:read']});
 const actual=await mcp(a,'read_personal_context',{},true),normalize=x=>({...x,resumes:[...x.resumes].sort((a,b)=>a.id.localeCompare(b.id))});
 const canonicalReadback=verifyCanonicalProfiles(expected,await mcp(a,'read_search_context',{},true));write(path.join(root,'canonical-context.private.json'),{...canonicalClone,...canonicalReadback});
 if(!isDeepStrictEqual(normalize(actual.settings),normalize(expected)))throw Error('Candidate differs beyond ownership remapping');
 if(!endpoint)for(const r of expected.resumes){const bytes=ok(await db.storage.from('resumes').download(r.object_path));if(hash(Buffer.from(await bytes.arrayBuffer()))!==hash(pdf))throw Error('Resume hash mismatch');}
 if(endpoint)write(path.join(root,'resume-parity.json'),{inputPdfSha256:hash(pdf),nativeMetadataHashes:expected.resumes.map(r=>r.content_hash),remoteStorageVerified:false,bothParticipantsReceiveExactLocalPdf:true});
 a.status='verified';write(path.join(root,'account.private.json'),a);write(path.join(root,'source-manifest.private.json'),read(manifest));write(path.join(root,'cloned-context.private.json'),actual);fs.closeSync(fs.openSync(path.join(root,'account.lock'),'ax',0o600));
 console.log(JSON.stringify({status:'verified',caseId,profileEquivalent:true,resumeHash:hash(pdf)}));
}else{
 const a=read(path.join(root,'account.private.json')),g=guard(a),uid=q(a.userId)+'::uuid';
 if(operation==='snapshot'){
  const tables=['profiles','preferences','resumes','answer_library','applications','application_milestones','activity_events','approvals','career_artifacts','career_artifact_revisions','preparation_plans','search_documents','search_document_revisions'];
  const selects=tables.map(t=>`${q(t)},(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM public.${t} x WHERE ${t==='career_artifact_revisions'?`x.artifact_id IN (SELECT id FROM public.career_artifacts WHERE user_id=${uid})`:`x.user_id=${uid}`})`);
  console.log(sql(g+`SELECT jsonb_build_object('capturedAt',now(),'ownerId',${uid},'tables',jsonb_build_object(${selects}));`).trim());
 }else if(operation==='seed'){
  const initial=read(path.join(root,'host-initial.json')),ids=initial.map(x=>q(x.id)+'::uuid').join(',');
  let text='BEGIN;'+g+`SELECT pg_advisory_xact_lock(hashtext(${q(a.userId)})); DO $check$ BEGIN IF EXISTS(SELECT 1 FROM public.applications WHERE user_id=${uid} AND id NOT IN (${ids})) THEN RAISE EXCEPTION 'Unexpected application; preserve evidence'; END IF; END $check$; DELETE FROM public.activity_events WHERE user_id=${uid}; DELETE FROM public.applications WHERE user_id=${uid}; DELETE FROM public.career_artifacts WHERE user_id=${uid};`;
  for(const app of initial){const jobId=a.benchmarkTaskId+'-'+a.userId+'-'+app.key,employer={company:app.company,title:app.title,workspaceOwner:a.userId,roleKey:a.benchmarkTaskId};
   text+=`INSERT INTO public.jobs(id,canonical_url,employer) VALUES(${q(jobId)},${q('https://jobs.example.test/'+a.benchmarkTaskId+'/'+a.userId+'/'+app.key)},${q(JSON.stringify(employer))}::jsonb) ON CONFLICT(id) DO NOTHING; DO $job$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.jobs WHERE id=${q(jobId)} AND employer->>'workspaceOwner'=${q(a.userId)}) THEN RAISE EXCEPTION 'Fixture job collision'; END IF; END $job$; INSERT INTO public.applications(id,user_id,job_id,status,revision,draft,receipt) VALUES(${q(app.id)}::uuid,${uid},${q(jobId)},${q(app.status)},0,${q(JSON.stringify(app.draft))}::jsonb,NULL); UPDATE public.applications SET status=${q(app.status)} WHERE id=${q(app.id)}::uuid AND user_id=${uid};`;
   text+=`UPDATE public.applications SET blocker=${app.draft.blocker?q(app.draft.blocker):'NULL'} WHERE id=${q(app.id)}::uuid AND user_id=${uid};`;
  }sql(text+'COMMIT;');console.log(JSON.stringify({seeded:true,ownerId:a.userId}));
 }else if(operation==='surface'){
  sql(g);const data=await mcp(a,'discover_tools',{workflow:'all'});console.log(JSON.stringify({names:[...new Set(data.tools.map(t=>t.name).concat(['discover_tools','call_discovered_tool']))].sort(),scopes:a.scopes}));
 }else if(operation==='audit_probe'){
  sql(g);const modulePath=new URL('../communication/',import.meta.url);
  const script="import sys,json;sys.path.insert(0,sys.argv[1]);from native_contract import audit_probe_sql;v=json.load(sys.stdin);print(audit_probe_sql(v['hash'],v['owner']))";
  const statement=execFileSync('python3',['-B','-c',script,decodeURIComponent(modulePath.pathname)],{input:JSON.stringify({hash:hash(a.token),owner:a.userId}),encoding:'utf8',stdio:['pipe','pipe','pipe']});sql(g+statement);console.log(JSON.stringify({verified:true,rolledBack:true}));
 }else if(operation==='permission_probe'){
  if(!endpoint)throw Error('Isolated permission probe required');sql(g);
  const probe=JSON.parse(fs.readFileSync(0,'utf8')),id=randomUUID(),payload={id,expectedVersion:0,title:'Denied readiness fixture',purpose:'Read-only permission probe',kind:'notes',format:'markdown',body:'Fictional permission probe must not save.',sources:[],links:[{applicationId:probe.applicationId}]};
  await mcp(a,'read_application_record',{applicationId:probe.applicationId},true);
  const raw=async(token,name,args)=>{const response=await fetch(a.mcpUrl,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:'Bearer '+token},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}),signal:AbortSignal.timeout(30000)});return response.json();};
  const readToken=read(path.join(root,'grader.private.json')).readToken;
  const deniedWrite=await raw(readToken,'save_artifact',payload),foreign=read(path.join(backendRoot,'backend.private.json')).token,deniedRead=await raw(foreign,'read_application_record',{applicationId:probe.applicationId});
  write(path.join(root,'permission-probe-'+randomUUID()+'.private.json'),{deniedWrite,deniedRead});
  if(!isScopeDenial(deniedWrite))throw Error('Read-only writer probe did not return scope denial');
  if(!isOwnershipDenial(deniedRead))throw Error('Foreign owner probe did not return ownership denial');
  console.log(JSON.stringify({readOnlyWriteDenied:true,foreignReadDenied:true,readOnlyOwnedReadSucceeded:true,writeReceipt:deniedWrite,foreignReceipt:deniedRead}));
 }else if(operation==='call'){
  sql(g);const req=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify(await mcp(a,req.name,req.arguments,req.readOnly===true)));
 }else throw Error('Unknown host account operation');
}
