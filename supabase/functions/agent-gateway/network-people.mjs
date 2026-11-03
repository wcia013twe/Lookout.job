const text = v => typeof v === 'string' ? v.trim() : '';
const object = v => v && typeof v === 'object' && !Array.isArray(v);
export const PERSON_FIELDS = ['professionalTitle','technicalInterests','relationshipSummary','relationshipUpdates','nextAction','suggestion','sources'];
const day = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
const https = v => {try {const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
export function validatePersonContext(record) {
 for (const key of ['professionalTitle','technicalInterests','relationshipSummary','nextAction']) if(record[key]!==undefined && (typeof record[key]!=='string'||record[key].length>10000)) throw Error('Invalid person '+key);
 if(record.company!==undefined && (typeof record.company!=='string'||record.company.length>200))throw Error('Invalid person company');
 if(record.relationshipUpdates!==undefined){
  if(!Array.isArray(record.relationshipUpdates)||record.relationshipUpdates.length>100)throw Error('Keep up to 100 relationship updates');
  const ids=new Set();for(const u of record.relationshipUpdates){if(!object(u)||Object.keys(u).some(k=>!['id','date','body'].includes(k))||!text(u.id)||u.id.length>100||ids.has(u.id)||!day(u.date)||!text(u.body)||u.body.length>4000)throw Error('Relationship updates need a unique ID, date and note');ids.add(u.id);}
 }
 function sources(value){if(!Array.isArray(value)||value.length>30)throw Error('Save up to 30 person sources');for(const s of value)if(!object(s)||Object.keys(s).some(k=>!['title','url','observedAt','summary'].includes(k))||!text(s.title)||s.title.length>200||!https(s.url)||s.url.length>2048||!day(s.observedAt)||(s.summary!==undefined&&(typeof s.summary!=='string'||s.summary.length>2000)))throw Error('Sources need a title, HTTPS URL and observation date');}
 if(record.sources!==undefined)sources(record.sources);
 if(record.suggestion!==undefined && record.suggestion!==null){const s=record.suggestion;
  if(!object(s)||Object.keys(s).some(k=>!['id','purpose','rationale','action','role','roleUrl','sources','createdAt','updatedAt','state'].includes(k))||!text(s.id)||s.id.length>100||!['connect','maintain','referral'].includes(s.purpose)||!['active','done','dismissed'].includes(s.state)||!text(s.rationale)||s.rationale.length>4000||!text(s.action)||s.action.length>1000||!['createdAt','updatedAt'].every(k=>typeof s[k]==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(s[k])&&Number.isFinite(Date.parse(s[k]))))throw Error('Invalid networking suggestion');
  if(s.role!==undefined&&(typeof s.role!=='string'||s.role.length>500))throw Error('Invalid suggested role');
  if(s.roleUrl!==undefined&&s.roleUrl!==''&&(!https(s.roleUrl)||s.roleUrl.length>2048))throw Error('Use an HTTPS role link');sources(s.sources);
 }
 return record;
}
export function personName(p){return text(p.contact)||text(p.name)||'Unnamed person';}
export function personSummary(p){return text(p.relationshipSummary)||text(p.relationship)||text(p.connection);}
export function searchPeople(people,query='',company='',today=new Date().toISOString().slice(0,10)){
 const q=query.trim().toLowerCase();return people.filter(p=>(!company||text(p.company)===company)&&[personName(p),p.company,p.professionalTitle,p.technicalInterests,personSummary(p),p.nextAction,...(p.relationshipUpdates||[]).map(u=>u.body)].join(' ').toLowerCase().includes(q)).sort((a,b)=>{
  const due=p=>day(p.followUpDate)&&p.followUpDate<=today?p.followUpDate:'';const ad=due(a),bd=due(b);if(ad||bd){if(!ad)return 1;if(!bd)return -1;if(ad!==bd)return ad.localeCompare(bd);}return text(b._updatedAt).localeCompare(text(a._updatedAt))||personName(a).localeCompare(personName(b))||a.id.localeCompare(b.id);
 });
}
export function activeSuggestions(people){return people.filter(p=>p.suggestion?.state==='active').sort((a,b)=>text(b.suggestion.updatedAt).localeCompare(text(a.suggestion.updatedAt))||a.id.localeCompare(b.id));}
export function setSuggestionState(person,state,now=new Date().toISOString()){
 if(!person.suggestion||!['done','dismissed'].includes(state))throw Error('Choose an existing suggestion');
 return {...person,suggestion:{...person.suggestion,state,updatedAt:now}};
}
export function addRelationshipUpdate(person,update,nextAction=person.nextAction||'',followUpDate=person.followUpDate||''){
 if(followUpDate&&!day(followUpDate))throw Error('Choose a valid follow-up date');
 const result={...person,relationshipUpdates:[...(person.relationshipUpdates||[]),update],nextAction,followUpDate};validatePersonContext(result);return result;
}
