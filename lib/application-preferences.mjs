import {readField} from './search-profile.mjs';
import {normalizeApplicationQuestion as normalize} from './application-field-facts.mjs';
const yesNo=new Set(['Requires sponsorship','F-1 student status','Return to school after internship','Available for 12-week full-time internship','Willing to relocate']);
const labels={
 'Requires sponsorship':['will you now or in the future require sponsorship?','do you require sponsorship?','will you require visa sponsorship?'],
 'F-1 student status':['are you a student in f-1 status who plans to work pursuant to curricular practical training (cpt), or optional practical training (opt)?'],
 'Return to school after internship':['are you currently enrolled in a university or program and will return to the program upon completion of internship?'],
 'Graduation month':['expected graduation date','when do you expect to graduate?','if you are currently enrolled in a university or program, when do you expect to graduate or complete your program? (select the closest date.)'],
 'Degree pursued':['degree pursued','if you are enrolled in university, what degree are you currently pursuing?'],
 'Earliest start date':['earliest start date','when can you start?','when are you available to start?'],
 'Available for 12-week full-time internship':['are you available for a 12-week full-time (40 hours per week) internship during your select term(s)?'],
 'Willing to relocate':['are you willing to relocate?','willing to relocate'],
 'Desired salary':['desired salary','what is your desired salary?','salary expectation','salary expectations'],
};
const preferred={
 'Work arrangement':['preferred work arrangement','what is your preferred work arrangement?'],
 Schedule:['preferred schedule','what is your preferred schedule?'],
 Location:['preferred work location','preferred locations'],
 Specializations:['area of interest in software engineering'],
};
export function applicationPreference(question,searchProfile,company=''){
 if(!searchProfile||searchProfile.active===false)return null;
 const text=normalize(question),instructions=searchProfile.instructions||'';
 let key=Object.keys(labels).find(k=>labels[k].includes(text));
 if(!key&&company&&text===normalize(`Do you now or will you in the future require immigration sponsorship to work at ${company}?`))key='Requires sponsorship';
 if(key){
  const field=readField(instructions,'Application answers',key);
  if(field.conflict)throw Error(`Resolve duplicate application preference: ${key}`);
  if(!field.value)return {key,value:null,reason:'missing-application-preference'};
  let value=field.value;
  if(yesNo.has(key)){if(!/^(yes|no)$/i.test(value))return {key,value:null,reason:'invalid-application-preference'};value=/^yes$/i.test(value)?'Yes':'No';}
  if(key==='Graduation month'){
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))return {key,value:null,reason:'invalid-application-preference'};
   value=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'-01T00:00:00Z'));
  }
  if(key==='Earliest start date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))return {key,value:null,reason:'invalid-application-preference'};
  return {key,value,rawValue:field.value,kind:'application-answer'};
 }
 key=Object.keys(preferred).find(k=>preferred[k].includes(text));if(!key)return null;
 const field=key==='Specializations'?readField(instructions,'Role preferences',key):{value:searchProfile.filters?.[key]||'',conflict:false};
 if(field.conflict)throw Error(`Resolve duplicate preference: ${key}`);
 let value=field.value;
 if(key==='Work arrangement')value=value.replace(/^Remote preferred$/i,'Remote').replace(/^Remote required$/i,'Remote');
 return {key,value:value||null,rawValue:field.value,kind:'search-preference',reason:'missing-application-preference'};
}
export function preferenceOption(value,options){
 const exact=options.filter(o=>String(o.value)===value);if(exact.length===1)return String(exact[0].value);
 const label=v=>normalize(v).normalize('NFKC').replace(/[’‘]/g,"'");
 const match=options.filter(o=>label(o.label)===label(value));return match.length===1?String(match[0].value):null;
}
