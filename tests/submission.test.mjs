import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { authorizeSubmission } from '../supabase/functions/agent-gateway/submission-authorization.mjs';
import { submissionDispatch } from '../supabase/functions/agent-gateway/submission-dispatch.mjs';
import { validateRequest } from '../supabase/functions/agent-gateway/contract.mjs';
import { submitApplication } from '../runner/submit.mjs';
import { formResult, identifyJob } from '../runner/forms.mjs';
const aid='00000000-0000-4000-8000-000000000001', rid='00000000-0000-4000-8000-000000000002', claimId='00000000-0000-4000-8000-000000000003';
const url='https://job-boards.greenhouse.io/example/jobs/123', user='owner';
function fixture() {
  const bytes=Buffer.from('%PDF-fixture'), hash=createHash('sha256').update(bytes).digest('hex');
  const questions=[{question:'Email',required:true,fields:[{id:'email',type:'email',options:[]}]},{question:'Resume',required:true,fields:[{id:'resume',type:'file',options:[]}]}];
  const form=formResult(identifyJob(url),questions,[]);
  const draft={url,resumeId:rid,resumeSha256:hash,formFingerprint:form.formFingerprint,questionsReviewed:false,questions:[{fieldId:'email',question:'Email',answer:'test@example.com',profileField:'email'},{fieldId:'resume',question:'Resume',answer:rid,fieldType:'file'}]};
  const resume={id:rid,user_id:user,object_path:'owner/resume.pdf',content_hash:hash};
  const context={application:{id:aid,user_id:user,job_id:'job',revision:1,status:'Draft',draft},job:{id:'job',canonical_url:url,employer:{company:'Oracle',employmentType:'FT',title:'Engineer'}},resume,resumes:[resume],resumeBytes:bytes,profile:{user_id:user,verified_at:'today',facts:{name:'Test',email:'test@example.com'}},answers:[],personalVersion:4,preferences:{search:{autoSubmitApproved:true,defaultResumeId:rid},tier_lists:[{id:'ft',employmentType:'FT',companies:[{id:'or',name:'Oracle'}],placements:{C:['or']}}]}};
  let clicks=0,state=null;const calls=[];
  const gateway={loadSubmissionContext:async()=>({...context,...authorizeSubmission(context)}),call:async(op,payload)=>{
    calls.push({op,payload});
    if(op==='submission.claim') {if(state) return {canProceed:false,attempt:{id:claimId,state}};state='claimed';return {canProceed:true,attempt:{id:claimId,state}};}
    if(op==='submission.start') {state='started';return {canClick:true,permitExpiresAt:new Date(Date.now()+5000).toISOString()};}
    if(op==='submission.finish') {state=payload.outcome; if(state==='confirmed') context.application.status='Submitted';return {state};}
    return {application:{status:'Blocked'}};
  }};
  const locator=selector=>({count:async()=>selector==='form:visible'?(clicks?0:1):selector.startsWith('#confirmation')?(clicks?1:0):selector.startsWith('#application_confirmation')||selector.startsWith('[data-testid')?0:1,
    isVisible:async()=>true,isEnabled:async()=>true,innerText:async()=> 'Thank you for applying. Your application has been submitted.',evaluate:async()=> 'Submit application',fill:async()=>{},setInputFiles:async()=>{},click:async()=>{clicks++;}});
  const page={url:()=>url,goto:async()=>{},locator,evaluate:async(_fn,arg)=>arg?.fields?true:{questions,blockers:[]},waitForFunction:async()=>{}};
  return {context,gateway,page,calls,get clicks(){return clicks;}};
}
test('routine authorization uses verified facts and explicit resume rules without human approval',()=>{
  const f=fixture(),result=authorizeSubmission(f.context); assert.equal(result.allowed,true);assert.equal(result.authorization.mode,'automatic');assert.equal(result.authorization.snapshot.draft.questionsReviewed,false);
});
test('important companies require exact approval, not an automatic flag or claimed success',()=>{
  const f=fixture();f.context.preferences.tier_lists[0].placements={S:['or']};
  assert.equal(authorizeSubmission(f.context).allowed,false);
  f.context.application.status='Approved';f.context.application.draft.questionsReviewed=true;
  f.context.approval={id:'human',application_id:aid,user_id:user,revision:1,snapshot:{draft:structuredClone(f.context.application.draft),resume:structuredClone(f.context.resume),profile:structuredClone(f.context.profile.facts)}};
  assert.equal(authorizeSubmission(f.context).authorization.mode,'human');
  f.context.application.draft.questions[0].answer='changed'; assert.equal(authorizeSubmission(f.context).allowed,false);
});
test('automatic answers reject unknown facts, unverified or ambiguous libraries and resume changes',()=>{
  for(const mutate of [f=>f.context.profile.verified_at=null,f=>f.context.application.draft.questions[0].answer='invented',f=>f.context.application.draft.questions[0].question='Are you eligible?',f=>f.context.preferences.search.defaultResumeId='other',f=>f.context.resume.content_hash='bad']) {
    const f=fixture();mutate(f);assert.equal(authorizeSubmission(f.context).allowed,false);
  }
  const f=fixture(),q=f.context.application.draft.questions[0];q.question='Why us?';q.answer='My verified answer';delete q.profileField;q.savedAnswerId='saved';q.savedAnswerVersion=2;
  const saved={id:'saved',user_id:user,question:'Why us?',answer:q.answer,context:{version:2},autofill_policy:'auto',verified_at:'today',company_scope:'Oracle'};f.context.answers=[saved];
  assert.equal(authorizeSubmission(f.context).allowed,true);
  f.context.answers.push({...saved,id:'ambiguous'});assert.equal(authorizeSubmission(f.context).allowed,false);
});
test('supported form submits once, records observed confirmation and repeat stops',async()=>{
  const f=fixture();const run=()=>submitApplication({applicationId:aid,attemptId:'run1',gateway:f.gateway,getPage:async()=>f.page});
  assert.equal((await run()).status,'Submitted');assert.equal(f.clicks,1);
  assert.equal(f.calls.at(-1).payload.receipt.source,'runner-observed-greenhouse-confirmation');
  assert.equal((await run()).status,'Already submitted');assert.equal(f.clicks,1);
});
test('timeout after click is uncertain and a duplicate claim prevents any second click',async()=>{
  const f=fixture();f.page.waitForFunction=async()=>{throw Error('timeout');};
  const run=()=>submitApplication({applicationId:aid,attemptId:'run1',gateway:f.gateway,getPage:async()=>f.page});
  assert.equal((await run()).status,'Needs you');assert.equal(f.calls.at(-1).payload.outcome,'uncertain');assert.equal(f.clicks,1);
  assert.ok(['No retry','Needs you'].includes((await run()).status));assert.equal(f.clicks,1);
});
test('lost confirmation reporting retains receipt and retries reporting instead of submission',async()=>{
  const f=fixture(),call=f.gateway.call;f.gateway.call=async(op,payload)=>{if(op==='submission.finish')throw Error('offline');return call(op,payload);};
  const result=await submitApplication({applicationId:aid,attemptId:'run1',gateway:f.gateway,getPage:async()=>f.page});
  assert.equal(result.status,'Confirmation observed');assert.equal(result.reported,false);assert.equal(result.pendingReport.outcome,'confirmed');assert.equal(f.clicks,1);
});
test('changed settings before claim or invalid filled values stop without clicking',async()=>{
  for(const changed of [true,false]) {
    const f=fixture(),call=f.gateway.call;
    if(changed) f.gateway.call=async(op,payload)=>{if(op==='submission.claim')throw Error('settings changed');return call(op,payload);};
    else f.page.evaluate=async(_fn,arg)=>arg?.fields?false:{questions:formResult(identifyJob(url),[],[]).questions,blockers:['changed']};
    const result=await submitApplication({applicationId:aid,attemptId:'run1',gateway:f.gateway,getPage:async()=>f.page});assert.equal(result.status,'Needs you');assert.equal(f.clicks,0);
  }
});
test('stale or replayed click permits never click',async()=>{
  for(const canClick of [false,true]) {
    const f=fixture(),call=f.gateway.call;
    f.gateway.call=async(op,payload)=>op==='submission.start'?{canClick,permitExpiresAt:new Date(0).toISOString()}:call(op,payload);
    const result=await submitApplication({applicationId:aid,attemptId:'run1',gateway:f.gateway,getPage:async()=>f.page});assert.equal(result.status,'Needs you');assert.equal(f.clicks,0);
  }
});
test('submission payloads cannot inject owners/snapshots or fabricate generic receipts',()=>{
  const payload={applicationId:aid,attemptId:'run',expectedRevision:1,expectedPersonalVersion:4};
  assert.doesNotThrow(()=>validateRequest({operation:'submission.claim',payload}));
  for(const extra of [{userId:'other'},{authorization:{mode:'automatic'}},{expectedContext:{}}]) assert.throws(()=>validateRequest({operation:'submission.claim',payload:{...payload,...extra}}));
  assert.throws(()=>validateRequest({operation:'submission.finish',payload:{applicationId:aid,claimId,outcome:'confirmed',receipt:{message:'done'}}}));
});
test('gateway dispatch derives authorization server-side and checks preflight settings version',async()=>{
  const f=fixture();let transitions=0;
  const rpc=async name=> name==='runner_submission_context'?{data:f.context}:{data:{canProceed:true},...(transitions++,{})};
  const result=await submissionDispatch({operation:'submission.claim',payload:{applicationId:aid,attemptId:'r',expectedRevision:1,expectedPersonalVersion:3},credentialHash:'hash',rpc});
  assert.equal(result.status,409);assert.equal(transitions,0);
});
test('another worker holding the claim prevents a Submit click',async()=>{
  const f=fixture(),call=f.gateway.call;
  f.gateway.call=async(op,payload)=>op==='submission.claim'?{canProceed:false,attempt:{id:claimId,state:'started'}}:call(op,payload);
  const result=await submitApplication({applicationId:aid,attemptId:'other',gateway:f.gateway,getPage:async()=>f.page});
  assert.equal(result.status,'No retry');assert.equal(f.clicks,0);
});
test('lost start response cannot click and reports uncertainty when start committed',async()=>{
  const f=fixture(),call=f.gateway.call;
  f.gateway.call=async(op,payload)=>{
    if(op==='submission.start'){await call(op,payload);throw Error('response lost');}
    if(op==='submission.finish'&&payload.outcome==='cancelled')throw Error('already started');
    return call(op,payload);
  };
  const result=await submitApplication({applicationId:aid,attemptId:'lost',gateway:f.gateway,getPage:async()=>f.page});
  assert.equal(result.status,'Needs you');assert.equal(f.clicks,0);assert.equal(f.calls.at(-1).payload.outcome,'uncertain');
});
test('a changed field after permit is uncertain without clicking',async()=>{
  const f=fixture();let checks=0;const evaluate=f.page.evaluate;
  f.page.evaluate=async(fn,arg)=>arg?.fields?(++checks===1):evaluate(fn,arg);
  const result=await submitApplication({applicationId:aid,attemptId:'changed',gateway:f.gateway,getPage:async()=>f.page});
  assert.equal(result.status,'Needs you');assert.equal(f.clicks,0);assert.equal(f.calls.at(-1).payload.outcome,'uncertain');
});
test('generic success text without supported confirmation marker cannot mark Submitted',async()=>{
  const f=fixture(),locator=f.page.locator;
  f.page.locator=selector=>selector==='#confirmation'?{count:async()=>0}:locator(selector);
  const result=await submitApplication({applicationId:aid,attemptId:'unsupported',gateway:f.gateway,getPage:async()=>f.page});
  assert.equal(result.status,'Needs you');assert.equal(f.clicks,1);assert.equal(f.calls.at(-1).payload.outcome,'uncertain');
});
