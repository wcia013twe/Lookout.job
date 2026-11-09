// Application-specific saved instructions outrank generic contact details.
export function applicationEmailAuthority(settings,resumeEmail){
 const valid=x=>typeof x==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.trim());
 const normalize=x=>x.trim().replace(/@([^@]+)$/,(_,domain)=>'@'+domain.toLowerCase());
 const profiles=(settings.preferences?.search?.profiles||[]).filter(p=>p.active!==false),found=[];
 for(const p of profiles){const text=p.instructions||'';const labels=text.split('\n').filter(line=>/^\s*[-*]?\s*application email\s*:/i.test(line));
  for(const line of labels){const value=line.replace(/^\s*[-*]?\s*application email\s*:\s*/i,'').trim();if(!valid(value))throw Error('Active application email instruction is unresolved');found.push({profileId:p.id,value:normalize(value)});}}
 const values=[...new Set(found.map(x=>x.value))];if(values.length>1)throw Error('Active application email instructions conflict');
 if(values.length)return {value:values[0],source:'active_application_profile_instruction',profileIds:found.map(x=>x.profileId)};
 if(!valid(resumeEmail))throw Error('Verified contact email fallback unavailable');return {value:normalize(resumeEmail),source:'verified_resume_contact_fallback',profileIds:profiles.map(x=>x.id)};
}
