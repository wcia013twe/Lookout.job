import {promptFromProfile, profileFromPrompt, updateField} from '../../lib/search-profile.mjs';
// Decorate the existing fictional profiles; never read or write real account data.
export function withApplicationProfileDemo(fixtures) {
 const copy=structuredClone(fixtures);
 copy.state.workflow.savedAnswers.push({id:"demo-worked-before",question:"Have you worked for this company before?",answer:"Ask me",companyScope:"Example Systems (demo)",policy:"ask",verifiedAt:null});
 copy.state.workflow.searchPreferences.profiles=copy.state.workflow.searchPreferences.profiles.map(profile=>{
  const employment=profile.id==='internships'?'Internship':'Full-time';
  let prompt=promptFromProfile(profile);
  for(const [heading,key,value] of [
   ["Profile evaluation","Rules",employment === "Internship" ? "Fictional demo: weigh learning, mentorship, conversion potential, and whether a graduation delay is justified. Surface uncertain team details for review." : "Fictional demo: prioritize long-term team fit, systems ownership, compensation, and career growth."],
   ["Recruiting targets","Targets",JSON.stringify(employment === "Internship" ? [{id:"demo-summer-systems",name:"Summer systems",active:true,roles:"Systems engineering",timeline:"Summer 2027 (demo)",resumeId:"demo-resume",conditions:"Fictional demo: verify enrollment eligibility and mentorship."}] : [{id:"demo-backend",name:"Backend SWE",active:true,roles:"Backend, distributed systems",timeline:"After graduation (demo)",resumeId:"demo-resume",conditions:"Fictional demo: ownership of production systems."},{id:"demo-mle",name:"ML infrastructure",active:false,roles:"ML systems",timeline:"After graduation (demo)",resumeId:"demo-resume",conditions:"Fictional demo: substantial model-serving or training systems scope."}])],
   ["Eligibility & availability","Work authorization country","United States"],
   ["Eligibility & availability","Authorized to work in this country","Yes"],
   ["Eligibility & availability","Sponsorship required now","No"],
   ["Eligibility & availability","Notice period","Two weeks (fictional demo)"],
   ["Eligibility & availability","Enrollment status",employment === "Internship" ? "Currently enrolled" : "Not currently enrolled"],
   ["Application identity","Preferred first name",employment === "Internship" ? "Demo" : "Dee"],
   ["Application identity","Preferred last name","Candidate"],
   ['Application identity','Application email',employment === 'Internship' ? 'candidate@example.edu' : 'candidate@example.com'],
   ['Application identity','Email account',employment === 'Internship' ? 'University Outlook (demo)' : 'Personal Gmail (demo)'],
   ['Application identity','Document account','Personal Drive (demo)'],
   ['Application identity','Outreach identity',employment === 'Internship' ? 'University Outlook (demo)' : 'Personal Gmail (demo)'],
   ['Application materials','Default resume ID',employment === 'Internship' ? '' : 'demo-resume'],
   ['Application materials','Saved answer IDs',employment === 'Internship' ? '' : 'demo-answer'],
   ['Employer answer writing','Tone',employment === 'Internship' ? 'Warm & conversational' : 'Professional & direct'],
   ['Employer answer writing','Length','Balanced'],
   ['Employer answer writing','Guidance','Use concrete examples from my verified background (demo).'],
   ['Outreach writing','Tone','Warm & conversational'],
   ['Outreach writing','Length',employment === 'Internship' ? '' : 'Brief'],
   ['Outreach writing','Guidance','Lead with the reason for contacting them; avoid flattery (demo).'],

  ]) prompt=updateField(prompt,heading,key,value);
  return {...profileFromPrompt(prompt,profile),version:profile.version||0};
 });
 return copy;
}
