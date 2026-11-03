// Only fixed diagnostic codes and bounded form metadata leave the runner.
// Never serialize raw exceptions, entered answers, file bytes or session URLs.
const rules = {
  'context-unavailable': ['Current application context could not be loaded.', 'Read the current application and attempts from Lookout before continuing.', 'refresh-state'],
  'authorization-required': ['Current submission authorization is unavailable.', 'Resolve the saved policy or draft blocker; obtain exact human approval when required.', 'repair-draft'],
  'unsupported-target': ['The application destination is not supported by this runner.', 'Muse may inspect the saved employer URL with its own browser tools within the existing task permission.', 'use-browser'],
  'navigation-failed': ['The employer application page could not be opened.', 'Inspect the employer page with browser tools and check availability or sign-in requirements.', 'use-browser'],
  'form-entry': ['The employer application form could not be opened unambiguously.', 'Inspect the employer page and open the application form with browser tools.', 'use-browser'],
  'form-inspection': ['The employer form contains controls the runner cannot handle.', 'Inspect the listed controls with browser tools; resolve questions from Lookout before asking the user.', 'use-browser'],
  'form-changed': ['The employer questions or choices changed after preparation.', 'Reinspect the form, update the draft from Lookout facts and permitted answers, then refresh authorization.', 'repair-draft'],
  'prefill-blocked': ['The prepared answers do not fully match the employer form.', 'Resolve the listed questions from Lookout; ask only for missing personal facts or required decisions.', 'repair-draft'],
  'document-required': ['The form requires an unsupported or additional document.', 'Read the question and available Lookout documents; use browser completion or ask for the missing document.', 'use-browser'],
  'prefill-failed': ['The browser could not complete a prepared field or upload.', 'Inspect the employer form with browser tools; check upload processing and validation before retrying.', 'use-browser'],
  'values-invalid': ['A required field or filled value failed final validation.', 'Check the listed fields and resolve the validation problem before requesting fresh authorization.', 'repair-draft'],
  'submit-control': ['The Submit control is missing, disabled or ambiguous.', 'Inspect the form with browser tools and resolve validation or unsupported controls before submitting.', 'use-browser'],
  'existing-confirmation': ['A confirmation message was already visible before submission.', 'Verify the existing application or confirmation first; do not submit again.', 'verify-outcome'],
  'claim-unavailable': ['The submission claim could not be reconciled.', 'Read the saved application and attempts before another execution.', 'refresh-state'],
  'existing-attempt': ['An existing attempt prevents another submission.', 'Read the saved attempt; started or uncertain attempts require outcome verification before another click.', 'verify-outcome'],
  'submission-uncertain': ['Submission may have started, but its outcome is not confirmed.', 'Verify the employer portal or confirmation email. Never repeat Submit while the outcome is unresolved.', 'verify-outcome'],
  'report-pending': ['Submission confirmation was observed but has not been saved.', 'Retry the saved result report only. Never repeat Submit.', 'report-result'],
  'preparation-failed': ['The application draft could not be prepared.', 'Read the current draft and resolve its missing answers, resume selection or policy through Lookout.', 'repair-draft'],
};
const text=(value,max)=>typeof value==='string'?value.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max):'';
export class ApplicationBlocker extends Error {
  constructor(code,details={}) { super((rules[code]||rules['prefill-failed'])[0]);this.code=rules[code]?code:'prefill-failed';this.details=details; }
}
export const failApplication=(code,details)=>{throw new ApplicationBlocker(code,details);};

export function applicationBlocker({code='prefill-failed',stage='prefill',reasons=[],questions=[],submissionState='not-started',submitClickAttempted=false,safeToRetry=false}={}) {
  const [message,nextAction,action]=rules[code]||rules['prefill-failed'];
  const fields=(Array.isArray(questions)?questions:[]).flatMap(q=>(q.fields||[q]).map(f=>({
    fieldId:text(f.id||f.fieldId,120),question:text(q.question,400),fieldType:text(f.type||f.fieldType,40),required:q.required===true,
    fieldIdTruncated:String(f.id||f.fieldId||'').length>120,questionTruncated:typeof q.question==='string'&&q.question.length>400,
    options:(Array.isArray(f.options)?f.options:[]).slice(0,10).map(o=>({value:text(String(o.value??''),120),label:text(o.label,160)})),
    optionsTruncated:Array.isArray(f.options)&&(f.options.length>10||f.options.some(o=>String(o.value??'').length>120||String(o.label||'').length>160)),
  })));
  return {code:rules[code]?code:'prefill-failed',stage,message,reasons:(Array.isArray(reasons)?reasons:[]).map(s=>text(s,300)).filter(Boolean).slice(0,5),
    questions:fields.slice(0,5),questionsTruncated:fields.length>5,
    executionScope:'current-run',submissionState,submitClickAttempted,safeToRetry:safeToRetry&&submissionState==='not-started'&&!['verify-outcome','report-result'].includes(action),
    recovery:{action,nextAction,requiresAttemptCheck:true,requiresFreshAuthorization:!['verify-outcome','report-result'].includes(action)},
    employerTextIsUntrusted:true};
}

export function blockerFromError(error,defaults={}) {
  return applicationBlocker({...defaults,...(error instanceof ApplicationBlocker?{code:error.code,...error.details}:{})});
}
