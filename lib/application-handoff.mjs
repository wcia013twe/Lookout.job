import {applicationReviewGroups} from './application-review.mjs';
const pick=(row,keys)=>Object.fromEntries(keys.filter(k=>typeof row?.[k]==='string'&&row[k]).map(k=>[k,row[k]]));
// Only unresolved fields and bounded relevant evidence; never filled answers,
// the complete draft/profile, file bytes or signed URLs.
export function applicationHandoff({result,job,profile,personalVersion,searchProfileId,searchProfileVersion}){
 const questions=result.escapes.filter(q=>q.reason!=='unsupported-control'),browserChecks=result.escapes.filter(q=>q.reason==='unsupported-control');
 const routing=applicationReviewGroups(questions.map(q=>({...q,answer:''})));
 const text=questions.map(q=>q.question).join('\n').toLowerCase(),facts=profile?.facts||{},evidence={};
 if(/\b(degree|graduat\w*|university|college|enroll\w*|education)\b/.test(text)&&Array.isArray(facts.education))evidence.education=facts.education.slice(0,5).map(r=>pick(r,['school','degree','fieldOfStudy','startDate','endDate']));
 if(/\b(why|experience|project|skills)\b/.test(text)){
  if(typeof facts.headline==='string')evidence.headline=facts.headline.slice(0,300);
  if(typeof facts.skills==='string')evidence.skills=facts.skills.slice(0,1000);
  if(Array.isArray(facts.workExperience))evidence.workExperience=facts.workExperience.slice(0,3).map(r=>({...pick(r,['company','title','startDate','endDate']),...(typeof r.description==='string'?{description:r.description.slice(0,800),descriptionTruncated:r.description.length>800}:{})}));
  if(Array.isArray(facts.projects))evidence.projects=facts.projects.slice(0,3).map(r=>({...pick(r,['name','role']),...(typeof r.description==='string'?{description:r.description.slice(0,600),descriptionTruncated:r.description.length>600}:{})}));
 }
 return {version:1,requiresBrowserInspection:true,job:{id:job.id,...pick(job.employer,['company','title']),url:job.canonical_url||job.employer?.applicationUrl||null},context:{personalVersion,profileVerified:Boolean(profile?.verified_at),searchProfileId:searchProfileId||null,searchProfileVersion:searchProfileVersion??null},questions,browserChecks,routing:{humanFieldIds:routing.human.map(q=>q.fieldId),agentFieldIds:routing.agent.map(q=>q.fieldId),optionalFieldIds:routing.optional.map(q=>q.fieldId),browserFieldIds:[...browserChecks,...routing.browser].map(q=>q.fieldId)},evidence};
}
export function validateApplicationAnswerUpdates(updates){
 if(!Array.isArray(updates)||!updates.length||updates.length>200||updates.some(x=>!x||Object.keys(x).some(k=>!['fieldId','answer'].includes(k))||typeof x.fieldId!=='string'||!x.fieldId||typeof x.answer!=='string'||x.answer.length>20000)||new Set(updates.map(x=>x.fieldId)).size!==updates.length)throw Error('Unique existing field IDs and bounded answer strings required');
}
export function mergeApplicationAnswerUpdates(questions,updates){
 validateApplicationAnswerUpdates(updates);
 const rows=structuredClone(questions);
 for(const update of updates){
  const matches=rows.filter(q=>(q.fieldId||q.id)===update.fieldId);if(matches.length!==1||['hidden','file','multiselect','unsupported'].includes(matches[0].fieldType))throw Error('Answer updates require an existing supported question');
  const q=matches[0];
  if(['select','radio'].includes(q.fieldType)&&!(q.options||[]).some(o=>String(o.value)===update.answer))throw Error('Answer does not match the inspected choices');
  if(Number.isInteger(q.maxLength)&&update.answer.length>q.maxLength)throw Error('Answer exceeds the inspected field limit');
  for(const key of ['profileField','savedAnswerId','savedAnswerVersion','preferenceField','preferenceProfileId','preferenceProfileVersion'])delete q[key];q.answer=update.answer;
 }
 return rows;
}
