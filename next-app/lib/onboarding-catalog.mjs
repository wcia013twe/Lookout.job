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
