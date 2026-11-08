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
