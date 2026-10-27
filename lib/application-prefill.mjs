import {APPLICATION_FACT_LABELS,RESUME_QUESTION_LABELS,normalizeApplicationQuestion as normalize} from './application-field-facts.mjs';
/** @typedef {'missing-profile-value'|'no-direct-match'|'missing-resume'|'unsupported-control'|'saved-answer-needs-review'|'ambiguous-saved-answer'|'option-mismatch'|'invalid-value'} PrefillEscapeReason */
// Proposal-only. No model, network, browser writes, consent or submission authority.
/** @param {{questions?:any[],profile?:any,answers?:any[],resumes?:any[],resumeId?:string,company?:string,userId?:string,existingQuestions?:any[]}} [options] */
export function prefillApplicationQuestions({questions=[],profile={},answers=[],resumes=[],resumeId,company='',userId,existingQuestions=[]}={}){
 if(!Array.isArray(questions)||questions.length>200)throw Error('At most 200 employer questions required');
 const facts=profile.facts||profile,filled=[],preserved=[],escapes=[],skipped=[],output=[];
 const selected=resumes.find(r=>r.id===resumeId&&(!userId||!r.user_id||r.user_id===userId)&&!(r.superseded_by||r.supersededBy)&&(r.object_path||r.objectPath));
 const ids=new Set();
 for(const [index,group]of questions.entries()){
  if(!group||typeof group.question!=='string'||!group.question.trim())throw Error('Employer question text required');
  const label=normalize(group.question),fields=Array.isArray(group.fields)?group.fields:[{id:group.fieldId||group.id||`question-${index}`,type:group.fieldType||'text',options:group.options||[]}];
  if(!fields.length)throw Error('Employer control metadata required');
  const resumeGroup=RESUME_QUESTION_LABELS.includes(label)&&selected&&fields.some(f=>f.type==='file');
  for(const field of fields){
   const fieldId=field.id;
   if(typeof fieldId!=='string'||!fieldId||ids.has(fieldId))throw Error('Unique employer field identities required');ids.add(fieldId);
   const nested=Array.isArray(group.fields);let q=nested?{id:fieldId,fieldId,question:group.question,fieldType:field.type,required:group.required,answer:''}:{...group,fieldType:field.type};
   const existing=existingQuestions.filter(old=>(old.fieldId||old.id)===fieldId&&normalize(old.question)===label);
   if(existing.length>1)throw Error('Ambiguous existing employer answers');
   if(!(typeof q.answer==='string'&&q.answer.trim())&&typeof existing[0]?.answer==='string'&&existing[0].answer.trim())q={...existing[0],...q,answer:existing[0].answer,...(existing[0].profileField?{profileField:existing[0].profileField}:{}),...(existing[0].savedAnswerId?{savedAnswerId:existing[0].savedAnswerId,savedAnswerVersion:existing[0].savedAnswerVersion}:{})};
   const info={fieldId,question:group.question,fieldType:field.type,required:group.required===true};
   if(typeof q.answer==='string'&&q.answer.trim()){output.push(q);preserved.push(info);continue;}
   if(resumeGroup&&field.type==='textarea'){skipped.push({...info,reason:'resume-file-selected'});continue;}
   const miss=reason=>{output.push(q);escapes.push({...info,reason});};
   if(!['text','email','tel','url','textarea','select','radio','file'].includes(field.type)){miss('unsupported-control');continue;}
   if(field.type==='file'){
    if(RESUME_QUESTION_LABELS.includes(label)&&selected){output.push({...q,answer:selected.id,fieldType:'file'});filled.push({...info,source:'selected-resume'});}else miss(RESUME_QUESTION_LABELS.includes(label)?'missing-resume':'no-direct-match');
    continue;
   }
   const key=Object.keys(APPLICATION_FACT_LABELS).find(k=>APPLICATION_FACT_LABELS[k].includes(label));
   let value,provenance,source;
   if(key&&typeof facts[key]==='string'&&facts[key].trim()){
    value=facts[key];provenance={profileField:key};source='profile';
   }else{
    const matches=answers.filter(a=>(!userId||!a.user_id||a.user_id===userId)&&normalize(a.question)===label&&(!(a.company_scope||a.companyScope)||normalize(a.company_scope||a.companyScope)===normalize(company)));
    if(matches.length>1){miss('ambiguous-saved-answer');continue;}
    const saved=matches[0];
    if(saved&&(saved.autofill_policy||saved.policy)==='auto'&&(saved.verified_at||saved.verifiedAt)&&typeof saved.answer==='string'&&saved.answer.trim()){
     value=saved.answer;provenance={savedAnswerId:saved.id,savedAnswerVersion:saved.context?.version||saved.version||1};source='saved-answer';
    }else{miss(saved?'saved-answer-needs-review':key?'missing-profile-value':'no-direct-match');continue;}
   }
   if(['select','radio'].includes(field.type)&&!(field.options||[]).some(o=>String(o.value)===value)){miss('option-mismatch');continue;}
   const max=field.maxLength??group.maxLength;
   let invalid=Number.isInteger(max)&&max>=0&&value.length>max;
   if(key==='email')invalid||=!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
   if(key==='phone')invalid||=value.replace(/\D/g,'').length<7;
   if(['linkedin','portfolio','github'].includes(key)||field.type==='url'){try{const url=new URL(value);invalid||=!['https:','http:'].includes(url.protocol)||Boolean(url.username||url.password);}catch{invalid=true;}}
   if(invalid){miss('invalid-value');continue;}
   const {profileField,savedAnswerId,savedAnswerVersion,...clean}=q;
   output.push({...clean,answer:value,...provenance});filled.push({...info,source,...provenance});
  }
 }
 return {questions:output,questionsReviewed:false,resumeId:selected?.id||resumeId||null,filled,preserved,escapes,skipped,counts:{filled:filled.length,preserved:preserved.length,remaining:escapes.length,requiredRemaining:escapes.filter(x=>x.required).length,skippedAlternatives:skipped.length}};
}
