import { identifyJob } from './forms.mjs';
import { openApplicationForm } from './ats.mjs';
import { inspectBrowserForm, prefillApprovedForm } from './browser.mjs';
import { assertExecutionAuthorization } from './prepare.mjs';
import { normalizeApplicationQuestion, RESUME_QUESTION_LABELS } from '../lib/application-field-facts.mjs';
import { failApplication, blockerFromError, applicationBlocker } from '../lib/application-blockers.mjs';
import { CONFIRMATION_RULES, CONFIRMATION_MESSAGE as success, CONFIRMATION_REJECTION as rejected, confirmationUrlMatches } from '../lib/submission-targets.mjs';
export const CONFIRMATION_MARKERS=CONFIRMATION_RULES.greenhouse.markers;

export async function readConfirmation(page,jobUrl) {
  const target=identifyJob(jobUrl), observed=new URL(page.url());
  if(!confirmationUrlMatches(jobUrl,observed.href)) return null;
  for(const marker of CONFIRMATION_RULES[target.ats].markers) {
    const el=page.locator(marker);
    if(await el.count()===1 && await el.isVisible()) {
      const message=(await el.innerText()).replace(/\s+/g,' ').trim();
      if(message.length<=1000 && success.test(message) && !rejected.test(message) && await page.locator('form:visible').count()===0) return {source:`runner-observed-${target.ats}-confirmation`,jobUrl,observedUrl:observed.href,marker,message};
    }
  }
  return null;
}

// Additional documents stay manual even if a draft accidentally references the
// résumé ID for them. Never upload the résumé into a transcript/cover-letter slot.
export function assertSubmitFormScope(form) {
  const uploads=form.questions.flatMap(q=>q.fields.filter(f=>f.type==='file').map(f=>({question:q.question,field:f})));
  if(uploads.length>1 || uploads.some(q=>!RESUME_QUESTION_LABELS.includes(normalizeApplicationQuestion(q.question)))) failApplication('document-required',{questions:form.questions.filter(q=>q.fields.some(f=>f.type==='file'))});
}

// All labels/values are fixed by the trusted execution snapshot, not model choices.
export async function readyToSubmit(page,context,plan) {
  const target=identifyJob(page.url());
  if(target.url!==plan.url) throw new Error('Unsupported submission target');
  assertExecutionAuthorization(context);
  const form=await inspectBrowserForm(page);
  assertSubmitFormScope(form);
  if(form.formFingerprint!==plan.formFingerprint || form.blockers.length) failApplication('form-changed',{questions:form.questions,reasons:form.blockers});
  const valid=await page.evaluate(async ({fields,resumeSha256})=>{
    const forms=[...document.querySelectorAll('form')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;});
    if(forms.length!==1)return {valid:false,fieldIds:[],reason:'form-unavailable'};
    if(!forms[0].checkValidity())return {valid:false,fieldIds:[...forms[0].querySelectorAll('input,select,textarea')].filter(el=>el.willValidate&&!el.validity.valid).map(el=>el.id||el.name),reason:'required-field-invalid'};
    const invalid=(fieldId,reason)=>({valid:false,fieldIds:[fieldId],reason});
    for(const field of fields) {
      const controls=[...forms[0].querySelectorAll('input,select,textarea')].filter(el=>field.type==='radio'?el.name===field.id&&el.value===String(field.value):el.id===field.id||el.name===field.id);
      if(controls.length!==1) return invalid(field.id,'control-ambiguous');
      const el=controls[0];
      if(!el.name || el.disabled || el.form!==forms[0]) return invalid(field.id,'control-not-submittable');
      if(field.type==='radio' && !el.checked) return invalid(field.id,'value-mismatch');
      else if(field.type==='checkbox' && el.checked!==(String(field.value)==='true')) return invalid(field.id,'value-mismatch');
      else if(field.type==='file') {
        if(el.files?.length!==1) return invalid(field.id,'file-missing');
        const digest=await crypto.subtle.digest('SHA-256',await el.files[0].arrayBuffer());
        if([...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')!==resumeSha256) return invalid(field.id,'file-mismatch');
      } else if(!['radio','checkbox'].includes(field.type) && el.value!==String(field.value)) return invalid(field.id,'value-mismatch');
    }
    return true;
  },{fields:plan.fields,resumeSha256:context.application.draft.resumeSha256});
  if(valid!==true) {
    const ids=Array.isArray(valid?.fieldIds)?valid.fieldIds:[];
    failApplication('values-invalid',{questions:ids.length?form.questions.filter(q=>q.fields.some(f=>ids.includes(f.id))):form.questions});
  }
  const buttons=page.locator('form:visible button[type="submit"]:visible, form:visible input[type="submit"]:visible');
  if(await buttons.count()!==1 || !await buttons.isVisible() || !await buttons.isEnabled()) failApplication('submit-control');
  const label=await buttons.evaluate(el=>(el.innerText||el.value||'').trim());
  if(!/^(submit|submit application|apply|apply now)$/i.test(label)) failApplication('submit-control');
  for(const marker of CONFIRMATION_RULES[target.ats].markers) {
    const el=page.locator(marker);
    if(await el.count()===1 && await el.isVisible() && success.test(await el.innerText())) failApplication('existing-confirmation');
  }
  return buttons;
}

export async function submitApplication({applicationId,attemptId,gateway,getPage}) {
  let context,claim,started=false,startRequested=false,claimRequested=false,submitClickAttempted=false,stage='context';
  const execution=()=>({submissionState:started||startRequested?'uncertain':claimRequested?'unknown':'not-started',submitClickAttempted,safeToRetry:context?.allowed===true&&!claimRequested&&!startRequested});
  const describe=(code,details={})=>applicationBlocker({code,stage,...execution(),...details});
  const finish=async(outcome,receipt)=>gateway.call('submission.finish',{applicationId,claimId:claim.id,outcome,...(receipt?{receipt}:{})});
  try {
    context=await gateway.loadSubmissionContext(applicationId);
    if(['Submitted','Interview','Offer'].includes(context.application?.status)) return {status:'Already submitted',applicationId};
    stage='authorization';
    if(!context.allowed) {
      const draftQuestions=context.application?.draft?.questions||[];
      const unanswered=draftQuestions.filter(q=>q.answer==null||!String(q.answer).trim());
      const blocker=describe('authorization-required',{reasons:[context.reason],questions:unanswered.length?unanswered:draftQuestions,submissionState:context.application?.status==='Blocked'?'unknown':'not-started'});
      const result={status:'Needs you',applicationId,reason:context.reason,blocker};
      if(context.application?.status!=='Blocked' && Number.isInteger(context.application?.revision) && !['Rejected','Withdrawn'].includes(context.application.status)) {
        const saved=await gateway.call('runner.report_failure',{applicationId,eventKey:`submit-blocked:${applicationId}:${attemptId}`,expectedRevision:context.application.revision,stage:'approval',outcome:'blocked',reason:context.reason,nextAction:'Review the highlighted blocker, update your settings or approve the exact draft.',attempts:[{stage:'approval',status:'failed'}]});
        result.reported=!!saved.application;
      }
      return result;
    }
    stage='authorization';assertExecutionAuthorization(context);
    stage='target';const target=identifyJob(context.job.canonical_url);
    stage='navigation';const page=await getPage(); await page.goto(target.url,{waitUntil:'domcontentloaded',timeout:30000});
    stage='entry';const entry=await openApplicationForm(page); if(entry.status==='Blocked') failApplication('form-entry',{reasons:entry.blockers});
    stage='inspection';const form=await inspectBrowserForm(page);
    if(form.blockers.length){const unsupported=form.questions.filter(q=>q.fields.some(f=>f.type==='unsupported'));failApplication('form-inspection',{reasons:form.blockers,questions:unsupported.length?unsupported:form.questions});}
    assertSubmitFormScope(form);
    stage='prefill';const plan=await prefillApprovedForm(page,context); if(plan.status!=='Prepared') failApplication(plan.blockerCode||'prefill-blocked',{reasons:plan.blockers,questions:plan.questions});
    stage='validation';await readyToSubmit(page,context,plan);
    const payload={applicationId,expectedRevision:context.application.revision,expectedPersonalVersion:context.personalVersion};
    stage='claim';claimRequested=true;const claimed=await gateway.call('submission.claim',{...payload,attemptId});
    claim=claimed.attempt;
    if(!claimed.canProceed) return {status:'No retry',applicationId,attemptState:claim.state,blocker:applicationBlocker({code:'existing-attempt',stage,submissionState:'existing-attempt',submitClickAttempted:false}),message:'An existing attempt prevents another Submit click. Check its outcome; unresolved attempts require human verification.'};
    stage='start';startRequested=true;const permit=await gateway.call('submission.start',{...payload,claimId:claim.id});
    // A lost/replayed start response never becomes a second click permit.
    started=true;
    if(!permit.canClick) throw new Error('No fresh click permit');
    const button=await readyToSubmit(page,context,plan);
    const remaining=Date.parse(permit.permitExpiresAt)-Date.now();
    if(!Number.isFinite(remaining) || remaining<=0) throw new Error('Click permit expired');
    // Exactly one call. Any exception after start is uncertain, even if click
    // appears not to have happened. No recovery model or automatic retry here.
    stage='submit';submitClickAttempted=true;await button.click({timeout:Math.min(3000,remaining)});
    stage='confirmation';await page.waitForFunction(({markers,successSource})=>{
      const visible=el=>el&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0;
      return ![...document.querySelectorAll('form')].some(visible) && markers.some(marker=>{
        const el=document.querySelector(marker);return visible(el)&&new RegExp(successSource,'i').test(el.innerText||'');
      });
    },{markers:CONFIRMATION_RULES[target.ats].markers,successSource:success.source},{timeout:15000});
    const receipt=await readConfirmation(page,target.url); if(!receipt) throw new Error('No supported confirmation');
    try {
      const saved=await finish('confirmed',receipt);
      return {status:saved.state==='confirmed'?'Submitted':'Needs you',applicationId,receipt,reported:true,...(saved.state!=='confirmed'?{blocker:describe('submission-uncertain')}: {})};
    } catch {
      return {status:'Confirmation observed',applicationId,reported:false,blocker:applicationBlocker({code:'report-pending',stage:'reporting',submissionState:'confirmed',submitClickAttempted}),pendingReport:{applicationId,claimId:claim.id,outcome:'confirmed',receipt},message:'Retry the result report only; never click Submit again.'};
    }
  } catch(error) {
    const codes={context:'context-unavailable',authorization:'authorization-required',target:'unsupported-target',navigation:'navigation-failed',entry:'form-entry',inspection:'form-inspection',prefill:'prefill-failed',validation:'values-invalid',claim:'claim-unavailable',start:'submission-uncertain',submit:'submission-uncertain',confirmation:'submission-uncertain'};
    let blocker=blockerFromError(error,{code:codes[stage],stage,...execution()});
    if(startRequested) {started=true;blocker=describe('submission-uncertain');}
    if(claim) {
      // A start request could have committed even when its response was lost.
      const outcome=started?'uncertain':'cancelled';
      try { await finish(outcome); }
      catch {
        if(!started) { try {await finish('uncertain');started=true;} catch {} }
        if(started)blocker=describe('submission-uncertain');
        return {status:'Needs you',applicationId,reported:false,blocker,pendingReport:{applicationId,claimId:claim.id,outcome:started?'uncertain':'cancelled'},message:'Check employer status. Retry reporting only, never application execution.'};
      }
      if(started) return {status:'Needs you',applicationId,reported:true,blocker,message:'Submission outcome uncertain. Verify employer status before another attempt.'};
    }
    const failure={applicationId,eventKey:`submit-blocked:${applicationId}:${attemptId}`,expectedRevision:context?.application?.revision,stage:'playwright',outcome:'blocked',reason:[blocker.message,...blocker.reasons].join(' ').slice(0,500),nextAction:blocker.recovery.nextAction,attempts:[{stage:'playwright',status:'failed'}]};
    if(Number.isInteger(failure.expectedRevision)) {
      try {await gateway.call('runner.report_failure',failure);return {status:'Needs you',applicationId,reported:true,blocker};} catch {}
    }
    return {status:'Needs you',applicationId,reported:false,blocker,pendingFailure:failure};
  }
}
