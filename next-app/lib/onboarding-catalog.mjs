// Catalog browsing is deterministic; it does not claim personal AI fit or live verification.
export function selectOnboardingRole(roles, {work, employment, location}) {
 const words=work.toLowerCase().match(/[a-z0-9]+/g)||[];
 const meaningful=words.filter(word=>!['engineering','engineer','work','jobs','job','and','or'].includes(word));
 const terms=meaningful.length?meaningful:words;
 if(!terms.length)return null;
 const places=location.toLowerCase().split(/[,;]|\bor\b/).map(s=>s.trim()).filter(Boolean);
 return roles.find(role=>{
  const type=role.employmentType==='FT'?'Full-time':role.employmentType;
  if(employment!=='Open to options'&&type!==employment)return false;
  const description=[role.title,role.category].join(' ').toLowerCase();
  if(!terms.some(term=>description.includes(term)))return false;
  const where=[role.location,role.workSetting].join(' ').toLowerCase();
  return places.some(place=>place==='open to anywhere'||where.includes(place)||(place==='sf bay area'&&/san francisco|bay area/.test(where)));
 })||null;
}
export function onboardingIntent({work,employment,location},role) {
 const preference=`${employment}: ${work.trim()} in ${location.trim()}.`;
 return role ? `${preference} Check this catalog role first: ${role.company} — ${role.title}, ${role.applicationUrl}. Verify that it is open and suitable; if it is unavailable, find one current alternative. Prepare only for my review.` : preference;
}

const sampleOpportunity = {
 id: 'onboarding-sample-opportunity', company: 'ExampleCo', title: 'Frontend engineering',
 employmentType: 'FT', location: 'SF Bay Area', applicationUrl: '',
 whyItFits: 'Your agent brings the role, your experience and your preferences together so you can see what makes it worth a closer look. This is an example of that experience, not a live job or a personal assessment.',
 matchPreview: { percent: 86, factors: [
  {label:'Skills & experience',value:86,rating:'Strong',reason:'Illustrative example only.'},
  {label:'Compensation',value:72,rating:'Strong',reason:'Illustrative example only.'},
  {label:'Wellbeing & culture',value:68,rating:'Strong',reason:'Illustrative example only.'},
  {label:'Location & work setting',value:94,rating:'Strong',reason:'Illustrative example only.'},
 ]},
};
export function onboardingReveal(roles, preferences) {
 const match=selectOnboardingRole(roles,preferences);
 return {role:match||sampleOpportunity, sample:!match};
}
