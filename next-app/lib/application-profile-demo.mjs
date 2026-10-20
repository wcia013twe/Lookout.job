import {promptFromProfile, profileFromPrompt, updateField} from '../../lib/search-profile.mjs';
// Decorate the existing fictional profiles; never read or write real account data.
export function withApplicationProfileDemo(fixtures) {
 const copy=structuredClone(fixtures);
 copy.state.workflow.searchPreferences.profiles=copy.state.workflow.searchPreferences.profiles.map(profile=>{
  const employment=profile.id==='internships'?'Internship':'Full-time';
  let prompt=promptFromProfile(profile);
  for(const [heading,key,value] of [
   ["Application identity","Preferred first name",employment === "Internship" ? "Demo" : "Dee"],
   ["Application identity","Preferred last name","Candidate"],
   ['Application identity','Application email',employment === 'Internship' ? 'candidate@example.edu' : 'candidate@example.com'],
   ['Application identity','Email account',employment === 'Internship' ? 'University Outlook (demo)' : 'Personal Gmail (demo)'],
   ['Application identity','Document account','Personal Drive (demo)'],
   ['Application identity','Outreach identity',employment === 'Internship' ? 'University Outlook (demo)' : 'Personal Gmail (demo)'],
   ['Application materials','Default resume ID','demo-resume'],
   ['Application materials','Saved answer IDs','demo-answer'],
   ['Employer answer writing','Tone',employment === 'Internship' ? 'Warm & conversational' : 'Professional & direct'],
   ['Employer answer writing','Length','Balanced'],
   ['Employer answer writing','Guidance','Use concrete examples from my verified background (demo).'],
   ['Outreach writing','Tone','Warm & conversational'],
   ['Outreach writing','Length','Brief'],
   ['Outreach writing','Guidance','Lead with the reason for contacting them; avoid flattery (demo).'],

  ]) prompt=updateField(prompt,heading,key,value);
  return {...profileFromPrompt(prompt,profile),version:profile.version||0};
 });
 return copy;
}
