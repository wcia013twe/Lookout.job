import {identifySubmissionTarget} from './submission-targets.mjs';
// Disclosure text does not grant human verification, approval, or reuse permission.
export function answerDisclosure(question,{edited=false}={}) {
 if(edited)return 'Your edit · not saved';
 if(!String(question.answer??'').trim()||String(question.answer).trim().toLowerCase()==='ask me')return 'Your answer is needed';
 if(question.answerSource==='inferred')return 'Inferred answer · verify before accepting';
 if(question.answerSource==='ai_generated')return 'AI-drafted answer · review before accepting';
 if(question.profileField)return 'Answer from Profile';
 if(question.savedAnswerId)return 'Answer from a saved answer';
 if(question.preferenceField)return 'Answer from saved preferences';
 return 'Answer source not recorded · review before accepting';
}
export function draftInferences(value) {
 return Array.isArray(value)?value.filter(i=>i&&typeof i.field==='string'&&typeof i.reason==='string'&&i.field.trim()&&i.reason.trim()).slice(0,20):[];
}
export function applicationActionLabel(item) {
 return ['review_application','prepared_application','submit_application'].includes(item.kind)?'Submission':
  ['resolve_blocker','check_submission','missing_answer','verify_answer'].includes(item.kind)?'Need your input':null;
}

// Presentation only: retain the complete ordered question list for versioned writes.
export function showAnswerOnCard(question) {
 if(question.fieldType==='hidden')return false;
 const answer=String(question.answer??'').trim();
 if(!answer||answer.toLowerCase()==='ask me')return true;
 if(['inferred','ai_generated'].includes(question.answerSource))return true;
 // Unrecorded provenance still needs review; never silently treat it as a fact.
 return !question.profileField&&!question.savedAnswerId&&!question.preferenceField;
}

// Presentation hints only. Completing these actions records a human update;
// it never grants browser permissions, verifies answers or approves submission.
export function blockerCompletionAction(item,application) {
 if(item.kind!=='resolve_blocker'||(item.questions||[]).some(showAnswerOnCard))return null;
 const reason=String(item.reason||'');
 const employerUrl=applicationEmployerUrl(application);
 let companySite=false;
 if(employerUrl){try{identifySubmissionTarget(employerUrl);}catch{companySite=true;}}
 if(companySite||/manual application handoff|\bworkday\b/i.test(reason))return {
  kind:'manual_application',heading:'Continue on the employer’s site',
  instruction:'Workday and company-site applications are yours to complete for now.',
  label:'Open application',note:'',
 };

 if(/host auto-review|public-inspection-only|(?:host|browser) (?:permission|access).*denied/i.test(reason))return {
  kind:'host_permission',heading:'Allow access in Muse',
  instruction:'Authorize the requested browser access in Muse, then return here. This card cannot change Muse’s browser permissions.',
  label:'Access approved — resume Muse',note:'I approved the requested browser access in Muse.',
 };
 if(/(?:password|credential).*(?:human|secure[ -]entry|cannot|can't|denied|not permitted)|(?:cannot|can't|denied|not permitted).*(?:enter|fill|autofill).*(?:password|credential)/i.test(reason))return {
  kind:'secure_entry',heading:'Enter your password securely',
  instruction:'Enter your password in Muse’s secure browser prompt or the existing employer application session. Keep it out of Lookout and chat; Muse can continue after you finish.',
  label:'Password entered — resume Muse',note:'I completed the required secure credential entry in the existing application session.',
 };
 if(/\b(?:sign[ -]?in|log[ -]?in|create (?:an? )?account|account setup)\b/i.test(reason)&&!/\bno (?:sign[ -]?in|log[ -]?in) (?:is )?required\b/i.test(reason))return {
  kind:'sign_in',heading:'Sign in to continue',
  instruction:'Muse couldn’t access the application questions. Sign in on the employer’s site, then return here.',
  label:'I signed in — resume Muse',note:'I completed employer sign-in or secure account setup in the existing application session.',
 };
 if(/\b(?:captcha|human verification|employer verification)\b/i.test(reason))return {
  kind:'verification',heading:'Complete employer verification',
  instruction:'Complete verification in the existing employer application session, then return here.',
  label:'Verification completed — resume Muse',note:'I completed the employer verification step in the existing application session.',
 };
 return null;
}

// Employer handoff links come from the saved application, never diagnostic prose.
export function applicationEmployerUrl(application) {
 for(const value of [application?.url,application?.applicationUrl]) {
  try {const url=new URL(value);if(['https:','http:'].includes(url.protocol)&&!url.username&&!url.password)return url.href;}catch{}
 }
 return null;
}
