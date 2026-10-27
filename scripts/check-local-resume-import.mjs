// Real local Auth/Storage/RPC proof, with a fictional parser response. Never calls APILayer.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createResumeParser} from '../backend/runtime/resume-parser.ts';
import {createApi} from '../backend/runtime/api.ts';
import {createDispatch} from '../backend/runtime/service.ts';
import {uploadResume} from '../lib/resume-model.mjs';
import {createBackend} from '../backend/client.mjs';
const raw=execFileSync(process.env.SUPABASE_CLI||'supabase',['status','-o','env'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const env=Object.fromEntries(raw.split('\n').map(line=>line.match(/^([A-Z_]+)="(.*)"$/)).filter(Boolean).map(([,k,v])=>[k,v]));
const url=env.API_URL||'http://127.0.0.1:54321';
assert.ok(new URL(url).protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname),'Only loopback local Supabase allowed');
const admin=createClient(url,env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[],paths=[];let api,calls=0;
const ok=({data,error})=>{if(error)throw Error('Local fixture operation rejected: '+error.code);return data;};
try{
 for(let n=0;n<2;n++){
  const email='apilayer-local-'+randomUUID()+'@example.test',password=randomUUID()+'aA!9';
  const {user}=ok(await admin.auth.admin.createUser({email,password,email_confirm:true}));users.push({id:user.id});
  const client=createClient(url,env.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const session=ok(await client.auth.signInWithPassword({email,password})).session;
  Object.assign(users[n],{client,session});
 }
 const [first,second]=users;
 const file=new File(['%PDF-1.4\nFictional local resume fixture\n%%EOF'],'fictional.pdf',{type:'application/pdf'});
 const resume=await uploadResume({client:first.client,getOwner:()=>first.id,file,variant:'Master'});paths.push(resume.object_path);
 const rpc=async(name,args)=>await admin.rpc(name,args);
 const parser=createResumeParser({client:admin,config:()=>({url:'https://parser.invalid/v1/resumes/parse',key:'fictional'}),request:async()=>{calls++;return new Response(JSON.stringify({name:'Fictional Candidate',email:'fictional@example.test',skills:['TypeScript'],experience:[],education:[]}),{headers:{'Content-Type':'application/json'}});}});
 api=createApi({dispatch:createDispatch({rpc,supabaseUrl:url,parseResume:parser.agent}),parseHuman:parser.human});await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+api.address().port;
 const parse=async(session)=>await fetch(base+'/v1/resume-import',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({resumeId:resume.id})});
 assert.equal((await parse(second.session)).status,404,'Foreign account must not read or send the file');assert.equal(calls,0);
 let response=await parse(first.session);assert.equal(response.status,200,'Owned parse failed');const proposal=(await response.json()).data;assert.equal(proposal.facts.name,'Fictional Candidate');assert.equal(calls,1);
 const backend=createBackend(first.client,first.id);
 const row=await backend.performPlatformAction('profile.save',{facts:{...proposal.facts,phone:'Keep this existing value'},expectedUpdatedAt:proposal.profileUpdatedAt});
 const secondProposal=await (await parse(first.session)).json();assert.equal(calls,1,'Same bytes should reuse private process cache');
 const updated=await backend.updateFields('profile.fields.update',{fields:{skills:'TypeScript'},expectedUpdatedAt:row.updated_at});assert.equal(updated.facts.phone,'Keep this existing value');assert.equal(updated.verified_at,null);
 await assert.rejects(backend.updateFields('profile.fields.update',{fields:{name:'Stale replacement'},expectedUpdatedAt:row.updated_at}));
 const agentToken='jb_agent_'+randomBytes(32).toString('hex');
 ok(await admin.rpc('manage_agent_connection',{owner_id:first.id,operation:'connections.issue',payload:{name:'Fictional resume import check',scopes:['workspace:read','profile:write','resumes:read'],expiresInDays:1,tokenHash:createHash('sha256').update(agentToken).digest('hex')}}));
 const mcp=async(name,args)=>await (await fetch(base+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+agentToken,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})})).json();
 const parsed=await mcp('parse_profile_resume',{resumeId:resume.id});assert.ok(!parsed.result.isError,'Owned MCP parsing failed');const agentProposal=JSON.parse(parsed.result.content[0].text);assert.equal(agentProposal.profileUpdatedAt,updated.updated_at);
 const saved=await mcp('update_profile_fields',{fields:{languages:'English'},expectedUpdatedAt:agentProposal.profileUpdatedAt});assert.ok(!saved.result.isError,'MCP versioned profile save failed');
 const reread=ok(await admin.from('profiles').select('facts,verified_at').eq('user_id',first.id).single());assert.equal(reread.facts.phone,'Keep this existing value');assert.equal(reread.facts.languages,'English');assert.equal(reread.verified_at,null);
 console.log('PASS: real local Auth, private Storage/checksum, account isolation, human and MCP parsing, cached extraction, shared versioned saves, stale-write rejection. APILayer was stubbed; no real resumes or credits used.');
}finally{
 api?.closeAllConnections();if(api)await new Promise(resolve=>api.close(resolve));
 if(paths.length)ok(await admin.storage.from('resumes').remove(paths));
 for(const user of users)ok(await admin.auth.admin.deleteUser(user.id));
 console.log('Disposable local accounts and uploaded fixture removed.');
}
