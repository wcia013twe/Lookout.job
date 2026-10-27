import {readField} from '../../../lib/search-profile.mjs';
import {parseRecruitingTargets,recruitingTargetsHeading,recruitingTargetsKey} from '../../../lib/recruiting-targets.mjs';
const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu,' ').trim();
const employment=value=>({FT:'Full-time',Internship:'Internship'}[value]||value||'');
const split=value=>String(value||'').split(/[,;\n]+/).map(value=>value.trim()).filter(Boolean);
function field(profile,heading,key){
 const text=profile.instructions??profile.prompt??'';
 if(text.split('\n').filter(line=>line.trim()==='## '+heading).length>1)throw Error('Duplicate '+heading+' sections');
 const result=readField(text,heading,key);if(result.conflict)throw Error('Duplicate '+key+' fields');return result.value;
}
function hasProfileResumes(profile){
 try{return Boolean(field(profile,'Application materials','Default resume ID')||field(profile,recruitingTargetsHeading,recruitingTargetsKey));}catch{return true;}
}
// One selector for preparation and automatic authorization. Selection never grants consent.
// searchProfile is authoritative when supplied by the owned search-document context.
export function selectResume({userId,job,resumes,preferences={},profileId,searchProfile}){
 if(!userId||!job||!Array.isArray(resumes))throw Error('Owner, job and resume records required');
 const owned=resumes.filter(resume=>resume.user_id===userId&&!(resume.superseded_by||resume.supersededBy));
 const candidates=owned.map(({id,name,variant})=>({id,name,variant}));
 const needs=reason=>({status:'Needs selection',reason,candidates,...(profileId?{searchProfileId:profileId}:{})});
 let selectedId,reason,matchedTargetIds=[];
 if(profileId!==undefined){
  const matches=(preferences.profiles||[]).filter(profile=>profile.id===profileId);
  const profile=searchProfile===undefined?(matches.length===1?matches[0]:null):searchProfile;
  if(!profile||profile.id!==profileId||profile.active!==true)return needs('Choose an active application profile before selecting its resume.');
  let targets,fallback,inherited;
  try{
   targets=parseRecruitingTargets(field(profile,recruitingTargetsHeading,recruitingTargetsKey));
   fallback=field(profile,'Application materials','Default resume ID');
   inherited=split(profile.filters?.Employment||field(profile,'Search Filters','Employment'));
  }catch{return needs('Repair conflicting or malformed resume assignments in this application profile.');}
  const title=[job.title,job.category,job.employer?.title,job.employer?.category].filter(Boolean).map(value=>' '+normalize(value)+' ');
  const type=employment(job.employmentType||job.employer?.employmentType);
  const active=targets.filter(target=>target.active);
  if(active.some(target=>target.resumeId&&!target.roles.trim()))return needs('Add job titles to the incomplete resume assignment.');
  const roleMatches=active.filter(target=>split(target.roles).some(role=>title.some(text=>text.includes(' '+normalize(role)+' '))));
  if(roleMatches.some(target=>(target.employment||inherited.length)&&!type))return needs('Verify the job type before choosing its assigned resume.');
  const matching=roleMatches.filter(target=>target.employment?target.employment===type:!inherited.length||inherited.includes(type));
  if(matching.some(target=>target.conditions.trim()||target.timeline.trim()))return needs('Review this matching assignment’s additional conditions or timeline before choosing a resume.');
  if(matching.length){
   if(matching.some(target=>!target.resumeId&&!fallback))return needs('Choose this profile’s fallback resume for the matching assignment.');
   const ids=[...new Set(matching.map(target=>target.resumeId||fallback))];
   if(ids.length!==1)return needs('Overlapping role assignments select different resumes; choose a variant.');
   selectedId=ids[0];matchedTargetIds=matching.map(target=>target.id);reason='Matched this profile’s job-title and job-type assignment';
  }else{
   if(inherited.length&&!inherited.includes(type))return needs('The job type does not match this application profile.');
   selectedId=fallback;reason='Used this profile’s fallback resume';
  }
  if(!selectedId)return needs('Choose this application profile’s fallback resume.');
  const file=owned.find(resume=>resume.id===selectedId);
  if(!file||!(file.object_path||file.objectPath))return needs('The assigned resume is missing, superseded, not privately uploaded, or belongs to another account.');
 }else{
  if((preferences.profiles||[]).some(profile=>profile.active&&hasProfileResumes(profile)))return needs('Choose the application profile so its resume assignments are used.');
  // Compatibility for accounts/drafts without per-profile resume configuration.
  const rules=preferences.resumeRules||[];if(!Array.isArray(rules))throw Error('resumeRules must be an array');
  const text=[job.title,job.category,job.employer?.title,job.employer?.category].filter(Boolean).join(' ').toLowerCase();
  const matches=rules.filter(rule=>Array.isArray(rule.keywords)&&rule.keywords.length&&rule.keywords.every(word=>typeof word==='string'&&word.trim())&&rule.keywords.some(word=>text.includes(word.toLowerCase().trim())));
  const ids=[...new Set(matches.map(rule=>rule.resumeId).filter(Boolean))];
  if(ids.length>1)return needs('Overlapping resume rules; choose a variant');
  selectedId=ids[0]||preferences.defaultResumeId;reason=matches.length?'Matched your resume rule':'Used your default resume';
  if(!selectedId)return needs('No matching rule or default resume');
 }
 const selected=owned.find(resume=>resume.id===selectedId);
 if(!selected)return needs('Configured resume is missing, superseded, or belongs to another account');
 return {status:'Selected',resumeId:selected.id,reason,requiresApproval:true,...(profileId?{searchProfileId:profileId,matchedTargetIds}:{})};
}
