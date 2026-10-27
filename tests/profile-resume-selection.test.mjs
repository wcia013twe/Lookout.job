import test from 'node:test';
import assert from 'node:assert/strict';
import {selectResume} from '../supabase/functions/agent-gateway/resume-selection.mjs';
import {updateField,profileFromPrompt} from '../lib/search-profile.mjs';
import {createTestDatabase} from './helpers/database.mjs';
import {prepareDraftWithPrefill} from '../lib/application-prefill-service.mjs';
import {authorizeSubmission} from '../supabase/functions/agent-gateway/submission-authorization.mjs';
import {submissionDispatch} from '../supabase/functions/agent-gateway/submission-dispatch.mjs';
const owner='owner';
const resumes=['backend','intern','fallback','legacy'].map(id=>({id,user_id:owner,name:id,object_path:`owner/${id}.pdf`,content_hash:'a'.repeat(64)}));
const assignment=(resumeId,roles='Backend Engineer',employment='Full-time',extra={})=>({id:resumeId||'blank',name:'Fixture assignment',active:true,roles,employment,resumeId,timeline:'',conditions:'',...extra});
function profile(targets=[],fallback='fallback',extra={}){
 let prompt=updateField('','Recruiting targets','Targets',JSON.stringify(targets));
 prompt=updateField(prompt,'Application materials','Default resume ID',fallback);
 return {...profileFromPrompt(prompt,{id:'systems',name:'Systems',active:true}),filters:{Employment:'Full-time, Internship'},...extra};
}
const choose=(p,job={title:'Senior Backend Engineer',employmentType:'FT'},extra={})=>selectResume({userId:owner,job,resumes,preferences:{profiles:[p],defaultResumeId:'legacy',resumeRules:[{keywords:['backend'],resumeId:'legacy'}]},profileId:p.id,...extra});
test('role-title and job-type assignments beat legacy rules and stay inside the selected profile',()=>{
 const p=profile([assignment('backend'),assignment('intern','Backend Engineer','Internship')]);
 assert.equal(choose(p).resumeId,'backend');
 assert.equal(choose(p,{title:'Backend Engineer Intern',employmentType:'Internship'}).resumeId,'intern');
 assert.equal(choose(p,{title:'Data Analyst',employmentType:'FT'}).resumeId,'fallback');
 const second=profile([assignment('intern')],'intern',{id:'second'});
 assert.equal(choose(second).resumeId,'intern');
 assert.equal(selectResume({userId:owner,job:{title:'Backend Engineer',employmentType:'FT'},resumes,preferences:{profiles:[p,second],defaultResumeId:'legacy'}}).status,'Needs selection');
});
test('matching uses normalized title phrases, employment inheritance, paused targets and profile fallback',()=>{
 const p=profile([assignment('backend','Platform Engineer; BACKEND-engineer','')]);
 assert.equal(choose(p).resumeId,'backend');
 assert.equal(choose(profile([assignment('backend','ML')]),{title:'HTML Engineer',employmentType:'FT'}).resumeId,'fallback');
 assert.equal(choose(profile([assignment('backend','ML')]),{title:'ML Engineer',employmentType:'FT'}).resumeId,'backend');
 assert.equal(choose(profile([assignment('backend','Backend Engineer','Full-time',{active:false})])).resumeId,'fallback');
 assert.equal(choose(profile([assignment('','Backend Engineer')])).resumeId,'fallback');
 assert.equal(choose(profile([],'')).status,'Needs selection');
 assert.equal(choose(p,{title:'Backend Engineer'}).status,'Needs selection');
});
test('overlap, missing files, foreign/superseded resumes and unchecked conditions fail closed',()=>{
 const variants=[profile([assignment('backend'),assignment('intern')]),profile([assignment('missing')]),profile([assignment('backend','Backend Engineer','Full-time',{conditions:'Only if based in New York'})]),profile([assignment('backend','Backend Engineer','Full-time',{timeline:'Summer 2027'})]),profile([assignment('backend')],'fallback',{active:false})];
 for(const p of variants)assert.equal(choose(p).status,'Needs selection');
 assert.equal(choose(profile([assignment('backend')]),undefined,{resumes:resumes.map(r=>r.id==='backend'?{...r,user_id:'other'}:r)}).status,'Needs selection');
 assert.equal(choose(profile([assignment('backend')]),undefined,{resumes:resumes.map(r=>r.id==='backend'?{...r,superseded_by:'new'}:r)}).status,'Needs selection');
 const same=profile([assignment('backend'),assignment('backend','Backend','Full-time',{id:'second-match'})]);assert.equal(choose(same).resumeId,'backend');
});
test('malformed/duplicate profile fields never fall through to the account-wide default',()=>{
 const malformed=profile();malformed.instructions=updateField(malformed.instructions,'Recruiting targets','Targets','bad json');assert.equal(choose(malformed).status,'Needs selection');
 const duplicated=profile();duplicated.instructions+='\n## Application materials\n- Default resume ID: legacy';assert.equal(choose(duplicated).status,'Needs selection');
 assert.equal(choose(profile(),undefined,{searchProfile:null}).status,'Needs selection');
});
test('real owned profile preparation pins the mapped file and current SQL context blocks stale mapping authorization',async()=>{
 const db=await createTestDatabase(),u='11111111-1111-1111-1111-111111111111',v='22222222-2222-2222-2222-222222222222',hash='9'.repeat(64);
 try{
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Mapped resume test',$2,array['workspace:read','drafts:write','preferences:write','approvals:read','resumes:read'],now()+interval '1 hour')",[u,hash]);
  await db.query("insert into public.profiles(user_id,facts,verified_at) values($1,'{\"name\":\"Fictional Candidate\",\"email\":\"fictional@example.com\"}',now())",[u]);
  const mapped=(await db.query("insert into public.resumes(user_id,name,object_path,content_hash) values($1,'Mapped',$2,$3) returning *",[u,u+'/mapped.pdf','b'.repeat(64)])).rows[0];
  const legacy=(await db.query("insert into public.resumes(user_id,name,object_path,content_hash) values($1,'Legacy',$2,$3) returning *",[u,u+'/legacy.pdf','a'.repeat(64)])).rows[0];
  const profiles=profile([assignment(mapped.id)],legacy.id,{id:'systems',name:'Systems',filters:{Employment:'Full-time'}});
  profiles.instructions=updateField(profiles.instructions,'Application automation','Auto-apply routine matches','Yes');
  profiles.instructions=updateField(profiles.instructions,'Company priorities','Tier list ID','ft');
  await db.query('insert into public.preferences(user_id,search,tier_lists) values($1,$2,$3)',[u,{autoSubmitApproved:true,defaultResumeId:legacy.id},[{id:'ft',employmentType:'FT',companies:[{id:'example',name:'Example'}],placements:{C:['example']}}]]);
  const call=async(operation,payload)=>{try{return {data:(await db.query('select public.agent_dispatch($1,$2,$3) data',[hash,operation,payload])).rows[0].data,error:null};}catch(error){return {data:null,error};}};
  assert.equal((await call('preferences.profile.save',{expectedVersion:0,profile:profiles})).error,null);
  await db.query("insert into public.jobs(id,canonical_url,employer) values('mapped-role','https://job-boards.greenhouse.io/fixture/jobs/1999',$1)",[{company:'Example',title:'Backend Engineer',employmentType:'FT'}]);
  const result=await prepareDraftWithPrefill(call,{responseMode:'full',jobId:'mapped-role',expectedRevision:-1,draft:{searchProfileId:'systems',url:'https://job-boards.greenhouse.io/fixture/jobs/1999',formFingerprint:'c'.repeat(64),questions:[{fieldId:'email',fieldType:'email',question:'Email',answer:''},{fieldId:'resume',fieldType:'file',question:'Resume',answer:''}]}},{loadJob:async()=> (await db.query("select * from public.jobs where id='mapped-role'")).rows[0]});
  assert.equal(result.error,null);assert.equal(result.data.draft.resumeId,mapped.id);assert.equal(result.data.draft.resumeSha256,mapped.content_hash);
  assert.equal(result.data.draft.questions.find(q=>q.fieldId==='resume').answer,mapped.id);
  const app=result.data.id;
  const context=(await db.query('select public.runner_submission_context($1,$2) data',[hash,app])).rows[0].data;
  assert.equal(context.searchProfile.id,'systems');assert.equal(authorizeSubmission(context).allowed,true);
  const mismatch=structuredClone(context);mismatch.resume=legacy;mismatch.application.draft.resumeId=legacy.id;mismatch.application.draft.resumeSha256=legacy.content_hash;mismatch.application.draft.questions.find(q=>q.fieldId==='resume').answer=legacy.id;
  assert.equal(authorizeSubmission(mismatch).allowed,false);
  const changed={...profiles,instructions:updateField(profiles.instructions,'Recruiting targets','Targets',JSON.stringify([assignment(legacy.id)]))};
  assert.equal((await call('preferences.profile.save',{expectedVersion:1,profile:changed})).error,null);
  const fresh=(await db.query('select public.runner_submission_context($1,$2) data',[hash,app])).rows[0].data;
  assert.notEqual(fresh.searchProfile.version,context.searchProfile.version);assert.equal(authorizeSubmission(fresh).allowed,false);
  const reply=await submissionDispatch({operation:'submission.claim',payload:{applicationId:app,attemptId:'stale-mapping',expectedRevision:context.application.revision,expectedPersonalVersion:context.personalVersion},credentialHash:hash,rpc:async(name,args)=>{assert.equal(name,'runner_submission_context');return {data:fresh};}});
  assert.equal(reply.status,409);assert.equal((await db.query('select count(*)::int n from public.submission_attempts')).rows[0].n,0);
 }finally{await db.close();}
});

test('profile demo covers a deterministic mapping, fallback and a conditional review without account writes',async()=>{
 const {withApplicationProfileDemo}=await import('../next-app/lib/application-profile-demo.mjs');
 const {demoFixtures}=await import('../next-app/lib/demo.mjs');
 const fixtures=withApplicationProfileDemo(demoFixtures('2026-10-20'));
 const state=fixtures.state.workflow,p=state.searchPreferences.profiles[0];
 const args={userId:'demo',resumes:state.resumes.map(r=>({...r,user_id:'demo'})),preferences:state.searchPreferences,profileId:p.id};
 assert.equal(selectResume({...args,job:{title:'Backend Engineer',employmentType:'FT'}}).resumeId,'demo-resume');
 assert.equal(selectResume({...args,job:{title:'Data Analyst',employmentType:'FT'}}).resumeId,'demo-resume');
 assert.equal(selectResume({...args,job:{title:'ML systems Engineer',employmentType:'FT'}}).status,'Needs selection');
 assert.equal(demoFixtures('2026-10-20').state.workflow.resumes[0].objectPath,undefined);
});
