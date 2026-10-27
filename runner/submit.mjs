import { identifyJob } from './forms.mjs';
import { openApplicationForm } from './ats.mjs';
import { inspectBrowserForm, prefillApprovedForm } from './browser.mjs';
import { assertExecutionAuthorization } from './prepare.mjs';
export const CONFIRMATION_MARKERS=['#confirmation','#application_confirmation','[data-testid="application-confirmation"]'];
const success=/thank you for applying|application (?:has been |was )?submitted|application (?:has been |was )?received/i;

export async function readConfirmation(page,jobUrl) {
  const expected=new URL(jobUrl), observed=new URL(page.url());
  if(observed.origin!==expected.origin || ![expected.pathname,expected.pathname+'/confirmation'].includes(observed.pathname) || observed.search || observed.hash || observed.username || observed.password) return null;
  for(const marker of CONFIRMATION_MARKERS) {
    const el=page.locator(marker);
    if(await el.count()===1 && await el.isVisible()) {
      const message=(await el.innerText()).replace(/\s+/g,' ').trim();
      if(message.length<=1000 && success.test(message) && await page.locator('form:visible').count()===0) return {source:'runner-observed-greenhouse-confirmation',jobUrl,observedUrl:observed.href,marker,message};
    }
  }
  return null;
}

// Additional documents stay manual even if a draft accidentally references the
// résumé ID for them. Never upload the résumé into a transcript/cover-letter slot.
export function assertSubmitFormScope(form) {
  const uploads=form.questions.flatMap(q=>q.fields.filter(f=>f.type==='file').map(f=>({question:q.question,field:f})));
  const labels=['resume','resume/cv','resume / cv','cv','upload resume','attach resume'];
  if(uploads.length>1 || uploads.some(q=>!labels.includes(q.question.toLowerCase().replace(/[ *:]+$/g,'').trim()))) throw new Error('Additional document upload requires manual completion');
}

// All labels/values are fixed by the trusted execution snapshot, not model choices.
export async function readyToSubmit(page,context,plan) {
  if(identifyJob(page.url()).ats!=='greenhouse' || identifyJob(page.url()).url!==plan.url) throw new Error('Unsupported submission target');
  assertExecutionAuthorization(context);
  const form=await inspectBrowserForm(page);
  assertSubmitFormScope(form);
  if(form.formFingerprint!==plan.formFingerprint || form.blockers.length) throw new Error('Employer form changed');
  const valid=await page.evaluate(async ({fields,resumeSha256})=>{
    const forms=[...document.querySelectorAll('form')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;});
    if(forms.length!==1 || !forms[0].checkValidity()) return false;
    for(const field of fields) {
      const controls=[...forms[0].querySelectorAll('input,select,textarea')].filter(el=>field.type==='radio'?el.name===field.id&&el.value===String(field.value):el.id===field.id||el.name===field.id);
      if(controls.length!==1) return false;
      const el=controls[0];
      if(!el.name || el.disabled || el.form!==forms[0]) return false;
      if(field.type==='radio' && !el.checked) return false;
      else if(field.type==='checkbox' && el.checked!==(String(field.value)==='true')) return false;
      else if(field.type==='file') {
        if(el.files?.length!==1) return false;
        const digest=await crypto.subtle.digest('SHA-256',await el.files[0].arrayBuffer());
        if([...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')!==resumeSha256) return false;
      } else if(!['radio','checkbox'].includes(field.type) && el.value!==String(field.value)) return false;
    }
    return true;
  },{fields:plan.fields,resumeSha256:context.application.draft.resumeSha256});
  if(!valid) throw new Error('Required fields or filled values are invalid');
  const buttons=page.locator('form:visible button[type="submit"], form:visible input[type="submit"]');
  if(await buttons.count()!==1 || !await buttons.isVisible() || !await buttons.isEnabled()) throw new Error('Submit control is ambiguous or unavailable');
  const label=await buttons.evaluate(el=>(el.innerText||el.value||'').trim());
  if(!/^(submit|submit application|apply|apply now)$/i.test(label)) throw new Error('Unsupported submit control');
  for(const marker of CONFIRMATION_MARKERS) if(await page.locator(marker).count()>0 && await page.locator(marker).isVisible()) throw new Error('Existing confirmation marker; verify manually');
  return buttons;
}

export async function submitApplication({applicationId,attemptId,gateway,getPage}) {
  let context,claim,started=false;
  const finish=async(outcome,receipt)=>gateway.call('submission.finish',{applicationId,claimId:claim.id,outcome,...(receipt?{receipt}:{})});
  try {
    context=await gateway.loadSubmissionContext(applicationId);
    if(['Submitted','Interview','Offer'].includes(context.application?.status)) return {status:'Already submitted',applicationId};
    if(!context.allowed) {
      const result={status:'Needs you',applicationId,reason:context.reason};
      if(context.application?.status!=='Blocked' && Number.isInteger(context.application?.revision) && !['Rejected','Withdrawn'].includes(context.application.status)) {
        const saved=await gateway.call('runner.report_failure',{applicationId,eventKey:`submit-blocked:${applicationId}:${attemptId}`,expectedRevision:context.application.revision,stage:'approval',outcome:'blocked',reason:context.reason,nextAction:'Review the highlighted blocker, update your settings or approve the exact draft.',attempts:[{stage:'approval',status:'failed'}]});
        result.reported=!!saved.application;
      }
      return result;
    }
    assertExecutionAuthorization(context);
    const target=identifyJob(context.job.canonical_url);
    if(target.ats!=='greenhouse') throw new Error('Unsupported ATS');
    const page=await getPage(); await page.goto(target.url,{waitUntil:'domcontentloaded',timeout:30000});
    const entry=await openApplicationForm(page); if(entry.status==='Blocked') throw new Error('Form entry unavailable');
    assertSubmitFormScope(await inspectBrowserForm(page));
    const plan=await prefillApprovedForm(page,context); if(plan.status!=='Prepared') throw new Error('Prefill blocked');
    await readyToSubmit(page,context,plan);
    const payload={applicationId,expectedRevision:context.application.revision,expectedPersonalVersion:context.personalVersion};
    const claimed=await gateway.call('submission.claim',{...payload,attemptId});
    claim=claimed.attempt;
    if(!claimed.canProceed) return {status:'No retry',applicationId,attemptState:claim.state,message:'An existing attempt prevents another Submit click. Check its outcome; unresolved attempts require human verification.'};
    const permit=await gateway.call('submission.start',{...payload,claimId:claim.id});
    // A lost/replayed start response never becomes a second click permit.
    started=true;
    if(!permit.canClick) throw new Error('No fresh click permit');
    const button=await readyToSubmit(page,context,plan);
    const remaining=Date.parse(permit.permitExpiresAt)-Date.now();
    if(!Number.isFinite(remaining) || remaining<=0) throw new Error('Click permit expired');
    // Exactly one call. Any exception after start is uncertain, even if click
    // appears not to have happened. No recovery model or automatic retry here.
    await button.click({timeout:Math.min(3000,remaining)});
    await page.waitForFunction(({markers})=>{
      const visible=el=>el&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0;
      return ![...document.querySelectorAll('form')].some(visible) && markers.some(marker=>{
        const el=document.querySelector(marker);return visible(el)&&/thank you for applying|application (?:has been |was )?submitted|application (?:has been |was )?received/i.test(el.innerText||'');
      });
    },{markers:CONFIRMATION_MARKERS},{timeout:15000});
    const receipt=await readConfirmation(page,target.url); if(!receipt) throw new Error('No supported confirmation');
    try {
      const saved=await finish('confirmed',receipt);
      return {status:saved.state==='confirmed'?'Submitted':'Needs you',applicationId,receipt,reported:true};
    } catch {
      return {status:'Confirmation observed',applicationId,reported:false,pendingReport:{applicationId,claimId:claim.id,outcome:'confirmed',receipt},message:'Retry the result report only; never click Submit again.'};
    }
  } catch {
    if(claim) {
      // A start request could have committed even when its response was lost.
      const outcome=started?'uncertain':'cancelled';
      try { await finish(outcome); }
      catch {
        if(!started) { try {await finish('uncertain');started=true;} catch {} }
        return {status:'Needs you',applicationId,reported:false,pendingReport:{applicationId,claimId:claim.id,outcome:started?'uncertain':'cancelled'},message:'Check employer status. Retry reporting only, never application execution.'};
      }
      if(started) return {status:'Needs you',applicationId,reported:true,message:'Submission outcome uncertain. Verify employer status before another attempt.'};
    }
    const failure={applicationId,eventKey:`submit-blocked:${applicationId}:${attemptId}`,expectedRevision:context?.application?.revision,stage:'playwright',outcome:'blocked',reason:'Supported submission could not complete its pre-click checks.',nextAction:'Review the employer form and current settings; resolve the blocker before retrying.',attempts:[{stage:'playwright',status:'failed'}]};
    if(Number.isInteger(failure.expectedRevision)) {
      try {await gateway.call('runner.report_failure',failure);return {status:'Needs you',applicationId,reported:true};} catch {}
    }
    return {status:'Needs you',applicationId,reported:false,pendingFailure:failure};
  }
}
