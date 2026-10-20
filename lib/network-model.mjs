// Company presentation model over existing private outreach notes.
export const COMPANY_PRIORITIES = ['Apply Now', 'Strong Consider', 'Skip Unless Team Fit'];
export const companyKey = name => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
export const emptyCompany = name => ({name:name.trim(),website:'',priority:'Strong Consider',interest:'',targetTeams:'',concerns:'',research:'',nextAction:'',followUpDate:'',sources:[],contactIds:[],applicationIds:[],archived:false});
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const https = v => {try {const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
const date = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
export function validateCompany(record) {
 const shape=emptyCompany('');
 if(!object(record)||Object.keys(record).some(k=>!Object.hasOwn(shape,k))||Object.keys(shape).some(k=>!Object.hasOwn(record,k)))throw Error('Complete company record required.');
 for(const k of ['name','website','priority','interest','targetTeams','concerns','research','nextAction','followUpDate'])if(typeof record[k]!=='string'||record[k].length>({name:200,website:2048,priority:30,followUpDate:10}[k]||10000))throw Error('Invalid company '+k+'.');
 if(!record.name.trim()||!COMPANY_PRIORITIES.includes(record.priority)||typeof record.archived!=='boolean')throw Error('Company name and valid priority required.');
 if(record.website&&!https(record.website))throw Error('Use an HTTPS company website.');
 if(record.followUpDate&&!date(record.followUpDate))throw Error('Use a valid follow-up date.');
 if(!Array.isArray(record.sources)||record.sources.length>30)throw Error('Save up to 30 research sources.');
 for(const s of record.sources)if(!object(s)||Object.keys(s).some(k=>!['title','url','observedAt','summary'].includes(k))||!['title','url','observedAt','summary'].every(k=>typeof s[k]==='string'&&s[k].length<=({title:200,url:2048,observedAt:10,summary:2000}[k]))||!s.title.trim()||!https(s.url)||!date(s.observedAt))throw Error('Research sources need a title, HTTPS URL, observation date and summary.');
 for(const k of ['contactIds','applicationIds'])if(!Array.isArray(record[k])||record[k].length>100||new Set(record[k]).size!==record[k].length||record[k].some(id=>typeof id!=='string'||!id||id.length>200))throw Error('Invalid company links.');
 if(new TextEncoder().encode(JSON.stringify(record)).length>20000)throw Error('Company record is too large.');
 return record;
}
export function companyIndex(records,contacts,applications) {
 const entries=new Map(records.map(row=>[companyKey(row.record.name),{...row,contacts:[],applications:[],suggested:false}]));
 for(const item of [...contacts,...applications]){const name=item.company||'Other contacts',key=companyKey(name);if(key&&!entries.has(key)&&!records.some(r=>r.record.contactIds.includes(item.id)||r.record.applicationIds.includes(item.backendId||item.id)))entries.set(key,{id:'suggested:'+key,revision:0,record:emptyCompany(name),contacts:[],applications:[],suggested:true});}
 for(const row of entries.values()){
  row.contacts=contacts.filter(c=>row.record.contactIds.includes(c.id)||companyKey(c.company||'Other contacts')===companyKey(row.record.name));
  row.applications=applications.filter(a=>row.record.applicationIds.includes(a.backendId||a.id)||companyKey(a.company)===companyKey(row.record.name));
 }
 return [...entries.values()].sort((a,b)=>COMPANY_PRIORITIES.indexOf(a.record.priority)-COMPANY_PRIORITIES.indexOf(b.record.priority)||a.record.name.localeCompare(b.record.name));
}
export function companyFollowUps(rows,today){return rows.filter(r=>!r.record.archived&&r.record.followUpDate&&r.record.followUpDate<=today&&r.record.nextAction.trim()).sort((a,b)=>a.record.followUpDate.localeCompare(b.record.followUpDate));}

// Existing outreach storage supports collections and freeform notes. Company targets
// use those fields; they are never represented as a person or a messaging thread.
export const isCompanyRecord = record => record?.collection === 'companies';
export function decodeCompany(row) {
 let record;
 try {record=validateCompany(JSON.parse(row.notes));}
 catch {record={...emptyCompany(row.company||'Unnamed company'),research:typeof row.notes==='string'?row.notes.slice(0,10000):''};}
 return {id:row.id,record,revision:row._revision??row.revision??0};
}
export function encodeCompany(row) {
 validateCompany(row.record);
 return {id:row.id,collection:'companies',company:row.record.name,notes:JSON.stringify(row.record),followUpDate:row.record.followUpDate};
}

// Process references live in existing contact tags/job URLs, never application state.
export const processTag = application => `application:${application.backendId||application.id}`;
function postingKey(value){try{const u=new URL(value);if(u.protocol!=='https:')return '';u.hash='';for(const k of [...u.searchParams.keys()])if(k.startsWith('utm_'))u.searchParams.delete(k);u.searchParams.sort();return u.href.replace(/\/$/,'');}catch{return '';}}
export function contactsForProcess(contacts,application){
 const tagsForApplication=new Set([processTag(application),`application:${application.id}`]),urls=[application.url,application.applicationUrl].map(postingKey).filter(Boolean);
 return contacts.filter(c=>{
  const tags=Array.isArray(c.tags)?c.tags:[];
  if(tags.some(t=>typeof t==='string'&&t.startsWith('application:')))return tags.some(t=>tagsForApplication.has(t));
  return [c.jobUrl,c.link].some(v=>{const key=postingKey(v);return key&&urls.includes(key);});
 });
}
export function processContactDraft(person,application,id){
 const fields=['contact','name','contactType','linkedin','email','evidence','sourceUrl'];
 const identity=Object.fromEntries(fields.filter(k=>typeof person[k]==='string').map(k=>[k,person[k]]));
 return {...identity,id,company:application.company,title:application.title,jobUrl:application.url||application.applicationUrl||'',tags:[processTag(application)],status:'Not asked',subject:'',message:'',source:'Manual'};
}
