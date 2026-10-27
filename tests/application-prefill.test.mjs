import test from 'node:test';import assert from 'node:assert/strict';
import {prefillApplicationQuestions} from '../lib/application-prefill.mjs';
import {prepareDraftWithPrefill} from '../lib/application-prefill-service.mjs';
const user='owner',resume={id:'resume',user_id:user,object_path:'private/resume.pdf'};
const profile={user_id:user,facts:{firstName:'Example',lastName:'Candidate',email:'candidate@example.com',phone:'+1 202 555 0100',github:'https://github.com/example'}};
const q=(question,id,type='text',extra={})=>({question,required:true,fields:[{id,type,options:[],...extra}]});
const fill=questions=>prefillApplicationQuestions({questions,profile,resumes:[resume],resumeId:resume.id,userId:user});

test('direct contact/GitHub/resume fills use explicit sources without AI or fabricated review',()=>{
 const r=fill([q('First Name','first'),q('Last Name','last'),q('Email','email'),q('Phone','phone'),q('Github Profile URL','github'),q('Resume/CV','resume','file')]);
 assert.equal(r.counts.filled,6);assert.equal(r.counts.remaining,0);assert.equal(r.questionsReviewed,false);assert.equal(r.questions[4].profileField,'github');assert.equal(r.questions[5].answer,'resume');
});
test('unknown personal choices and free text remain explicit escapes',()=>{
 const r=fill([q('Preferred First Name','preferred'),q('Current location','location'),q('Why this company?','why','textarea'),q('Privacy acknowledgement','privacy','checkbox'),q('Latitude','lat','hidden')]);
 assert.deepEqual(r.escapes.map(x=>x.reason),['no-direct-match','missing-profile-value','no-direct-match','unsupported-control','unsupported-control']);assert.ok(r.questions.every(x=>x.answer===''));assert.equal(r.questions.some(x=>x.fieldType==='hidden'),false);
});
test('manual answers are preserved and permitted saved answers require exact unique company-scoped provenance',()=>{
 const answers=[{id:'saved',user_id:user,question:'Sponsorship?',answer:'0',autofill_policy:'auto',verified_at:'today',context:{version:3},company_scope:'Example'}];
 const opts={questions:[q('Sponsorship?','sponsor','select',{options:[{value:'0',label:'No'},{value:'1',label:'Yes'}]})],profile,answers,company:'Example',userId:user};
 const r=prefillApplicationQuestions(opts);assert.equal(r.questions[0].answer,'0');assert.equal(r.questions[0].savedAnswerVersion,3);
 assert.equal(prefillApplicationQuestions({...opts,company:'Other'}).counts.remaining,1);
 assert.equal(prefillApplicationQuestions({...opts,answers:[...answers,{...answers[0],id:'second'}]}).escapes[0].reason,'ambiguous-saved-answer');
 assert.equal(prefillApplicationQuestions({...opts,answers:[{...answers[0],autofill_policy:'ask'}]}).escapes[0].reason,'saved-answer-needs-review');
 const existing={fieldId:'email',question:'Email',answer:'manual@example.com'};assert.deepEqual(fill([existing]).questions,[{...existing,fieldType:'text'}]);
});
test('label-only choices, invalid source values and foreign files never silently fill',()=>{
 const answers=[{id:'a',question:'Sponsorship?',answer:'No',policy:'auto',verifiedAt:'today'}];
 assert.equal(prefillApplicationQuestions({questions:[q('Sponsorship?','s','select',{options:[{value:'0',label:'No'}]})],answers}).escapes[0].reason,'option-mismatch');
 const r=prefillApplicationQuestions({questions:[q('Email','e'),q('Github','g'),q('Resume','r','file')],profile:{facts:{email:'broken',github:'javascript:alert(1)'}},resumes:[{...resume,user_id:'other'}],resumeId:resume.id,userId:user});
 assert.deepEqual(r.escapes.map(x=>x.reason),['invalid-value','invalid-value','missing-resume']);
});
test('selected resume skips only its same-group paste alternative, not cover letters',()=>{
 const r=fill([{question:'Resume/CV',required:true,fields:[{id:'resume',type:'file'},{id:'resume_text',type:'textarea'}]},q('Cover Letter','cover','file')]);
 assert.equal(r.counts.filled,1);assert.equal(r.skipped[0].fieldId,'resume_text');assert.equal(r.escapes[0].fieldId,'cover');assert.equal(r.questions.some(q=>q.fieldId==='resume_text'),false);
});
test('duplicate identities and field limits fail or escape loudly',()=>{
 assert.throws(()=>fill([q('Email','same'),q('Phone','same')]),/Unique/);
 assert.equal(fill([q('First Name','name','text',{maxLength:2})]).escapes[0].reason,'invalid-value');
});
function service({version=7}={}){const calls=[];return {calls,call:async(op,p)=>{calls.push({op,p});if(op==='context.personal')return {data:{personalVersion:7,settings:{profile,answers:[],resumes:[resume],preferences:{search:{defaultResumeId:resume.id}}}}};if(op==='context.versions')return {data:{personalVersion:version}};return {data:{id:'app',draft:p.draft}};}};}
test('existing prepare_draft service fills current context and returns escape report without granting approval',async()=>{
 const h=service(),p={responseMode:'full',jobId:'job',expectedRevision:-1,draft:{questions:[q('Email','email'),q('Why us?','why','textarea')],questionsReviewed:true}};
 const r=await prepareDraftWithPrefill(h.call,p,{loadJob:async()=>({employer:{company:'Example'}})});
 assert.equal(r.data.draft.questions[0].answer,profile.facts.email);assert.equal(r.data.draft.questionsReviewed,false);assert.equal(r.data.prefill.counts.remaining,1);assert.equal(r.data.prefill.personalVersion,7);assert.equal(h.calls.at(-1).p.expectedRevision,-1);
});
test('context changes or foreign resume IDs reject before saving',async()=>{
 const h=service({version:8});const p={jobId:'j',draft:{questions:[q('Email','e')]}};
 assert.equal((await prepareDraftWithPrefill(h.call,p,{loadJob:async()=>({employer:{}})})).error.code,'40001');assert.equal(h.calls.some(c=>c.op==='drafts.prepare'),false);
 const other=service();assert.equal((await prepareDraftWithPrefill(other.call,{...p,draft:{questions:[],resumeId:'foreign'}},{loadJob:async()=>({employer:{}})})).error.code,'P0002');
});

test('fresh inspection cannot erase existing manual answers or unrelated draft data',async()=>{
 const h=service(),existing={revision:3,draft:{customNote:'keep',questions:[{fieldId:'e',question:'Email',answer:'manual@example.com'}]},blocker:'Existing blocker'};
 const r=await prepareDraftWithPrefill(h.call,{responseMode:'full',jobId:'j',expectedRevision:3,draft:{questions:[q('Email','e')]}},{loadJob:async()=>({employer:{}}),loadApplication:async()=>existing});
 assert.equal(r.data.draft.questions[0].answer,'manual@example.com');assert.equal(r.data.draft.customNote,'keep');assert.equal(h.calls.at(-1).p.blocker,'Existing blocker');assert.equal(r.data.draft.prefill,undefined);assert.equal(r.data.prefill.counts.preserved,1);
});

test('fictional detached demo exercises direct fill while leaving unresolved questions visible',async()=>{
 const {demoFixtures}=await import('../next-app/lib/demo.mjs');const f=demoFixtures('2026-10-26'),state=f.state.workflow;
 const app=Object.values(state.applications)[0],r=prefillApplicationQuestions({questions:app.questions,profile:state.profile,answers:state.savedAnswers,resumes:state.resumes,resumeId:app.resumeId});
 assert.equal(r.questions.find(q=>q.id==='demo-email-direct').answer,'candidate@example.com');assert.equal(r.counts.filled,1);assert.equal(r.counts.preserved,1);assert.equal(app.questions.find(q=>q.id==='demo-email-direct').answer,'');
});
test('actual migrated SQL draft preparation preserves ownership, revision and approval boundaries',async()=>{
 const {createTestDatabase}=await import('./helpers/database.mjs');const db=await createTestDatabase();
 const owner='11111111-1111-1111-1111-111111111111',hash='f'.repeat(64);
 try{
  await db.query("insert into public.profiles(user_id,facts) values($1,$2) on conflict(user_id) do update set facts=excluded.facts",[owner,{email:'fictional@example.com'}]);
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Prefill fixture',$2,array['workspace:read','drafts:write'],now()+interval '1 day')",[owner,hash]);
  await db.query('insert into public.jobs(id,canonical_url,employer) values($1,$2,$3)',['prefill-fixture','https://example.com/jobs/prefill',{company:'Example'}]);
  const call=async(op,p)=>{try{return {data:(await db.query('select public.agent_dispatch($1,$2,$3) data',[hash,op,p])).rows[0].data,error:null};}catch(e){return {data:null,error:{code:e.code}};}};
  const loaders={loadJob:async id=>(await db.query('select * from public.jobs where id=$1',[id])).rows[0],loadApplication:async id=>(await db.query('select * from public.applications where user_id=$1 and job_id=$2',[owner,id])).rows[0]};
  const payload={responseMode:'full',jobId:'prefill-fixture',expectedRevision:-1,draft:{questions:[q('Email','email'),q('Why this team?','why','textarea')],questionsReviewed:true}};
  const result=await prepareDraftWithPrefill(call,payload,loaders);assert.equal(result.error,null);assert.equal(result.data.draft.questions[0].answer,'fictional@example.com');assert.equal(result.data.draft.questionsReviewed,false);assert.equal(result.data.prefill.counts.remaining,1);assert.equal(result.data.draft.prefill,undefined);
  assert.equal((await db.query('select count(*)::int n from public.approvals')).rows[0].n,0);
  assert.equal((await prepareDraftWithPrefill(call,payload,loaders)).error.code,'40001');
 }finally{await db.close();}
});
