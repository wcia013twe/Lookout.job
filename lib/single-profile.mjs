import {readField,updateField} from './search-profile.mjs';
import {parseRecruitingTargets,recruitingTargetsHeading,recruitingTargetsKey} from './recruiting-targets.mjs';
// Assignment UI: preserve every stored profile/file, expose one stable profile.
// Existing application records keep their original profile and resume references.
export const SINGLE_PROFILE_UI = true;
export function primaryApplicationProfile(profiles=[]) {
  return profiles.find(p=>p.id==='general') || profiles.find(p=>p.active!==false) || profiles[0];
}

// A deliberate resume selection retires role-specific assignments without deleting
// their saved contents. Existing submitted applications keep their pinned files.
export function singleResumePrompt(prompt,resumeId) {
  let next=updateField(prompt,'Application materials','Default resume ID',resumeId);
  const field=next.includes('## '+recruitingTargetsHeading)?parseRecruitingTargetsSection(next):null;
  if(field)next=updateField(next,recruitingTargetsHeading,recruitingTargetsKey,JSON.stringify(field.map(target=>({...target,active:false}))));
  return next;
}
function parseRecruitingTargetsSection(prompt) {
  const field=readField(prompt,recruitingTargetsHeading,recruitingTargetsKey);
  if(field.conflict)throw Error('Conflicting saved role assignments. Ask your agent to reconcile them before selecting a resume.');
  return field.value?parseRecruitingTargets(field.value):null;
}
