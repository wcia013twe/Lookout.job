import {readField,updateField,promptFromProfile} from '../../lib/search-profile.mjs';

const aliases={
 backend:['backend','back-end','platform','infrastructure','distributed','database'],
 frontend:['frontend','front-end','web','ui'],
 software:['software','backend','frontend','platform','infrastructure','full stack','fullstack'],
 infrastructure:['infrastructure','platform','distributed','database','systems'],
 design:['design','designer'],product:['product'],data:['data','analytics','machine learning'],ai:['ai','machine learning','ml'],
};
const normalize=value=>String(value||'').toLowerCase().replace(/\s+/g,' ').trim();
export function selectOnboardingRole(roles,{work,employment,location}) {
 const terms=(normalize(work).match(/[a-z0-9]+/g)||[]).filter(word=>!['engineering','engineer','work','jobs','job','and','or'].includes(word));
 if(!terms.length)return null;
 const places=normalize(location).split(/[,;]|\bor\b/).map(s=>s.trim()).filter(Boolean);
 const candidates=roles.map((role,index)=>{
  const type=role.employmentType==='FT'?'Full-time':role.employmentType;
  if(employment!=='Open to options'&&type!==employment)return null;
  const title=normalize(role.title),description=normalize([role.title,role.category].join(' '));
  const words=terms.flatMap(term=>aliases[term]||[term]);
  const matching=words.filter(term=>description.includes(term));
  if(!matching.length)return null;
  const where=normalize([role.location,role.workSetting].join(' '));
  const locationMatch=places.some(place=>place==='open to anywhere'||where.includes(place)||(place==='sf bay area'&&/san francisco|bay area/.test(where))||(['united states','usa','us','u.s.'].includes(place)&&/united states|\busa?\b|u\.s\./.test(where)));
  if(!locationMatch)return null;
  return {role,index,score:matching.reduce((score,term)=>score+(title.includes(term)?2:1),0)};
 }).filter(Boolean).sort((a,b)=>b.score-a.score||a.index-b.index);
 return candidates[0]?.role||null;
}
export function onboardingIntent({work,employment,location},role) {
 const preference=`${employment}: ${work.trim()} in ${location.trim()}.`;
 return role ? `${preference} Check this catalog role first: ${role.company} — ${role.title}, ${role.applicationUrl}. Verify that it is open and suitable; if it is unavailable, find one current alternative. Compare my saved profile and résumé when available; leave unsupported facts unknown. Find and recommend only. Preparing a draft or applying needs its separate next step.` : `${preference} Find one current employer posting and explain its fit using my saved profile and résumé when available. Leave unsupported facts unknown. Find and recommend only.`;
}
const sampleOpportunity={id:'onboarding-sample-opportunity',company:'ExampleCo',title:'Frontend engineering',employmentType:'FT',location:'SF Bay Area',applicationUrl:'',whyItFits:'This fictional example shows how your agent can explain a role after reviewing your experience. Sample scores are illustrative, not a personal assessment.',matchPreview:{percent:86,assessedAt:'2026-10-23T12:00:00Z',evidence:'Fictional onboarding example only.',factors:[['Skills & experience',86],['Compensation',72],['Wellbeing & culture',68],['Location & work setting',94]].map(([label,value])=>({label,value,rating:'Strong',reason:'Illustrative example only.'}))}};
export function isRealCatalogRole(role) {
 if(role.active===false||role.available===false||role.status==='closed')return false;
 try {const url=new URL(role.applicationUrl);return url.protocol==='https:'&&!url.username&&!url.password&&!/(^|\.)example\.(com|org|net)$/.test(url.hostname)&&!String(role.id).startsWith('demo-')&&!/\((demo|fictional)\)/i.test(role.company||'');}catch{return false;}
}
export function onboardingReveal(roles,preferences,{demo=false}={}) {
 const match=selectOnboardingRole(demo?roles:roles.filter(isRealCatalogRole),preferences);
 if(match)return {role:demo?{...match,matchPreview:match.matchPreview||sampleOpportunity.matchPreview}:match,sample:false,pending:false};
 return demo?{role:sampleOpportunity,sample:true,pending:false}:{role:null,sample:false,pending:true};
}
const heading='First opportunity';
// The catalog owns job details. Persist only a stable reference and selection time
// through the existing owner-scoped, versioned search-profile boundary.
export function saveOnboardingSelection(prompt,role,{selectedAt=new Date().toISOString()}={}) {
 const previousId=readField(prompt,heading,'Catalog role ID');
 const previousTime=readField(prompt,heading,'Selected at');
 const time=role&&previousId.value===role.id&&!previousTime.conflict&&Number.isFinite(Date.parse(previousTime.value))?previousTime.value:selectedAt;
 let section=false;
 prompt=String(prompt||'').split('\n').filter(line=>{
  if(/^##\s+/.test(line))section=line.trim()==='## '+heading;
  return !(section&&/^- (Catalog role ID|Selected at|Employer URL|Company|Title):/.test(line));
 }).join('\n');
 if(!role)return prompt;
 prompt=updateField(prompt,heading,'Catalog role ID',role.id);
 return updateField(prompt,heading,'Selected at',time);
}
export function savedOnboardingRole(profiles,roles,{preferences,demo=false}={}) {
 for(const profile of profiles||[]){
  if(profile.active===false)continue;
  const prompt=profile.prompt??promptFromProfile(profile),id=readField(prompt,heading,'Catalog role ID'),url=readField(prompt,heading,'Employer URL');
  if(id.conflict||url.conflict||!id.value)continue;
  const role=roles.find(role=>role.id===id.value&&(!url.value||role.applicationUrl===url.value)&&(demo||isRealCatalogRole(role)));
  if(role&&(!preferences||selectOnboardingRole([role],preferences)))return role;
 }
 return null;
}
export function chooseOnboardingPreview(roles,preferences,{prompt='',demo=false}={}) {
 const saved=savedOnboardingRole([{prompt}],roles,{preferences,demo});
 return saved?{role:saved,sample:false,pending:false}:onboardingReveal(roles,preferences,{demo});
}
