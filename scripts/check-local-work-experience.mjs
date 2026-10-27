// Local-only real Node -> isolated Edge -> local Supabase proof.
// Never resets/restarts shared services or mutates the retained review profile.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFile,readdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createApi} from '../backend/runtime/api.ts';
import {createDispatch} from '../backend/runtime/service.ts';
import {createBackend} from '../backend/client.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:4*1024*1024});
const info=JSON.parse(docker('inspect','supabase_edge_runtime_lookout-local'))[0];
assert.ok(info.State.Running&&info.Config.Image.includes('supabase/edge-runtime'));
const functionsMount=info.Mounts.find(m=>m.Destination.endsWith('/supabase/functions'));
assert.ok(functionsMount,'Expected existing local Edge function mount');
const sourceRoot=functionsMount.Destination.replace(/\/supabase\/functions$/,'');
const local=JSON.parse(execFileSync(process.env.SUPABASE_CLI||'/opt/homebrew/bin/supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const url=new URL(local.API_URL);assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname),'Loopback Supabase only');
const admin=createClient(url.origin,local.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
const ok=({data,error})=>{if(error)throw Error('Local test operation rejected: '+(error.code||error.name||error.message));return data;};
const profileHash=async id=>createHash('sha256').update(JSON.stringify(ok(await admin.from('profiles').select('*').eq('user_id',id)))).digest('hex');
// Saved test identity is inspected read-only. The write exercise uses a disposable account.
const retained=JSON.parse(await readFile(process.env.LOOKOUT_REVIEW_SESSION||join(sourceRoot,'backend/runtime/.review-session.local.json'),'utf8'));
const retainedBefore=await profileHash(retained.account.id);
for(const suffix of ['_work_experience_edits.sql',...(process.env.LOOKOUT_PROFILE_FLOW_UI==='1'?['_durable_action_inbox.sql','_profile_edit_flow.sql']:[])]) {
const migrationName=(await readdir(join(root,'supabase/migrations'))).find(name=>name.endsWith(suffix));
assert.ok(migrationName);const version=migrationName.split('_')[0];
const applied=docker('exec','supabase_db_lookout-local','psql','-U','postgres','-d','postgres','-Atc',"select count(*) from supabase_migrations.schema_migrations where version='"+version+"'").trim();
if(applied==='0') {
 const migration=await readFile(join(root,'supabase/migrations',migrationName),'utf8');
 // Apply only this additive migration, never unrelated pending work or a reset.
 execFileSync('docker',['exec','-i','supabase_db_lookout-local','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:"begin;\n"+migration+"\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('"+version+"','"+migrationName.slice(version.length+1,-4)+"',array[$migration$"+migration+"$migration$]);\nnotify pgrst,'reload schema';\ncommit;",stdio:['pipe','pipe','pipe']});
}
}
const temp=await mkdtemp(join(tmpdir(),'work-history-proof-'));
const container='lookout-work-history-proof-'+randomUUID().slice(0,8);let started=false,api,user;
try {
 const env=info.Config.Env.map(line=>line.replaceAll(sourceRoot,root.replace(/\/$/,''))).join('\n');
 const envPath=join(temp,'edge.env');await writeFile(envPath,env,{mode:0o600});
 const entrypoint=info.Config.Entrypoint;assert.equal(entrypoint[0],'sh');assert.equal(entrypoint[1],'-c');
 const network=Object.keys(info.NetworkSettings.Networks)[0];assert.equal(network,'supabase_network_lookout-local');
 const cache=info.Mounts.find(m=>m.Destination==='/root/.cache/deno');assert.ok(cache?.Name);
 docker('run','-d','--workdir',root,'--name',container,'--network',network,'--env-file',envPath,'-p','127.0.0.1::8081','-v',root+':'+root+':ro','-v',cache.Name+':/root/.cache/deno','--entrypoint','sh',info.Config.Image,'-c',entrypoint[2].replaceAll(sourceRoot,root.replace(/\/$/,'')));started=true;
 const port=JSON.parse(docker('inspect',container))[0].NetworkSettings.Ports['8081/tcp'][0].HostPort;
 const edge='http://127.0.0.1:'+port;
 let ready=false;for(let n=0;n<50;n++){try{const response=await fetch(edge+'/agent-gateway',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(response.status===401){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,200));}
 if(!ready)throw Error('Isolated Edge did not become ready: '+JSON.stringify({state:JSON.parse(docker('inspect',container))[0].State,logs:(()=>{const log=spawnSync('docker',['logs','--tail','12',container],{encoding:'utf8'});return log.stdout+log.stderr;})()}));
 const email='work-history-'+randomUUID()+'@example.test',password=randomUUID()+'aA!9';
 user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
 const client=createClient(url.origin,local.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});ok(await client.auth.signInWithPassword({email,password}));
 const facts={name:'Fictional history check',phone:'Keep phone',education:[{school:'Keep school'}],workExperience:[{company:'First fictional employer',title:'Intern',description:'Keep description'},{company:'Second fictional employer',title:'Engineer'}]};
 const initial=ok(await admin.from('profiles').insert({user_id:user.id,facts,verified_at:new Date().toISOString()}).select().single());
 const token='jb_agent_'+randomBytes(32).toString('hex');
 ok(await admin.rpc('manage_agent_connection',{owner_id:user.id,operation:'connections.issue',payload:{name:'Fictional work-history proof',scopes:['workspace:read','profile:write'],expiresInDays:1,tokenHash:createHash('sha256').update(token).digest('hex')}}));
 const rpc=async(name,args)=>await admin.rpc(name,args);let edgeCalls=0;
 api=createApi({dispatch:createDispatch({rpc,supabaseUrl:edge,request:async(input,options)=>{edgeCalls++;const target=new URL(input);target.pathname=target.pathname.replace(/^\/functions\/v1/,'');try{const response=await fetch(target,{...options,headers:{...options.headers,Connection:'close'}});return response;}catch(error){throw error;}}})});await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+api.address().port;
 const mcp=async(name,args)=>{
  const response=await fetch(base+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});
  const body=await response.json();assert.equal(response.status,200);assert.ok(!body.error,'MCP argument or protocol error');return body.result;
 };
 const add={action:'add',expectedUpdatedAt:initial.updated_at,fields:{company:'Third fictional employer',title:'Backend Intern'}};
 const added=await mcp('edit_work_experience',add);assert.ok(!added.isError,'MCP add failed');const a=JSON.parse(added.content[0].text);
 assert.deepEqual(a.facts.workExperience.slice(0,2),facts.workExperience);assert.deepEqual(a.facts.education,facts.education);assert.equal(a.verified_at,null);
 const retry=await mcp('edit_work_experience',add);assert.equal(retry.isError,true);assert.equal(JSON.parse(retry.content[0].text).status,409);
 const update=await mcp('edit_work_experience',{action:'update',entryIndex:0,fields:{title:'Senior Intern'},expectedUpdatedAt:a.updated_at});assert.ok(!update.isError);const b=JSON.parse(update.content[0].text);assert.equal(b.facts.workExperience[0].description,'Keep description');assert.equal(b.facts.workExperience[1].company,'Second fictional employer');
 const browser=createBackend(client,user.id);
 const c=await browser.editWorkExperience({action:'remove',entryIndex:2,expectedUpdatedAt:b.updated_at});assert.equal(c.facts.workExperience.length,2);
 const stale=await mcp('edit_work_experience',{action:'remove',entryIndex:0,expectedUpdatedAt:b.updated_at});assert.equal(stale.isError,true);assert.equal(JSON.parse(stale.content[0].text).status,409);
 const read=await mcp('workspace_read',{});assert.ok(!read.isError);assert.ok(edgeCalls>=5);
 const stored=ok(await admin.from('profiles').select('facts').eq('user_id',user.id).single());assert.deepEqual(stored.facts,c.facts);
 const fullFlow=process.env.LOOKOUT_PROFILE_FLOW_UI==='1'?await (await import('./profile-flow-ui.mjs')).checkProfileFlowUI({root,local,admin,client,user,mcp}):null;
 assert.equal(await profileHash(retained.account.id),retainedBefore,'Retained test profile must remain unchanged');
 const receipt={...(fullFlow?{flow:fullFlow}:{}),checkedAt:new Date().toISOString(),localOnly:true,transport:'task Node MCP -> isolated Supabase Edge runtime -> real local Supabase PostgreSQL',checks:{addPreservesHistory:true,updatePreservesEntryFields:true,browserRemovalSameSql:true,staleAddRetryRejected:true,staleRemovalRejected:true,profileReadBackMatches:true,verificationInvalidated:true,retainedProfileUnchanged:true},limits:['No hosted deployment','No shared runtime restart or rebind','Retained profile inspected read-only; writes used a disposable fictional account']};
 await writeFile(join(root,process.env.LOOKOUT_PROFILE_FLOW_UI==='1'?'backend/local/profile-edit-flow-proof.json':'backend/local/work-experience-proof.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log('PASS: real Node -> isolated Edge -> local SQL; add/update/remove, shared browser RPC, stale retry rejection, read-back and retained test profile preservation.');
} catch(error) {
 if(started){const log=spawnSync('docker',['logs','--tail','20',container],{encoding:'utf8'});console.error(log.stdout+log.stderr);}
 throw error;
} finally {
 if(api){api.closeAllConnections();await new Promise(resolve=>api.close(resolve));}
 try {if(user)ok(await admin.auth.admin.deleteUser(user.id));}
 finally {if(started)docker('rm','-f',container);await rm(temp,{recursive:true});}
 console.log('Disposable account and isolated Edge test container removed. Shared services and retained profile preserved.');
}
