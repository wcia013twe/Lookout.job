const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const unique=(values,max,valid)=>Array.isArray(values)&&values.length<=max&&new Set(values).size===values.length&&values.every(valid);
export function validateCardPacks(packs){
 if(!Array.isArray(packs)||packs.length>8)throw Error('Choose up to eight card packs.');
 const ids=new Set();
 for(const p of packs){
  if(!p||typeof p!=='object'||Object.keys(p).some(k=>!['id','title','enabled','taskId','archive'].includes(k))||!uuid(p.id)||ids.has(p.id)||typeof p.title!=='string'||!p.title.trim()||p.title.length>80||typeof p.enabled!=='boolean'||typeof p.taskId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(p.taskId)||p.archive!==undefined&&!['none','zero2sudo'].includes(p.archive))throw Error('Each pack needs a unique ID, name, enabled state, a My Agent task ID.');
  ids.add(p.id);
 }
 return packs;
}
export function validateAutomationSchedule(schedule){
 if(!schedule||typeof schedule!=='object'||!Array.isArray(schedule.routines)||schedule.routines.length>30||typeof schedule.enabled!=='boolean'||typeof schedule.timezone!=='string')throw Error('Choose up to 30 automation tasks and a time zone.');
 try{new Intl.DateTimeFormat('en',{timeZone:schedule.timezone}).format();}catch{throw Error('Valid time zone required.');}
 const ids=new Set();
 for(const task of schedule.routines){
  if(!task||typeof task.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(task.id)||ids.has(task.id)||typeof task.enabled!=='boolean'||task.title!==undefined&&(typeof task.title!=='string'||!task.title.trim()||task.title.length>120)||task.description!==undefined&&(typeof task.description!=='string'||task.description.length>4000)||task.mode!==undefined&&!['manual','scheduled'].includes(task.mode)||task.mode!=='manual'&&(typeof task.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(task.time))||task.sourceIds!==undefined&&!unique(task.sourceIds,8,s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(s))||task.connectionIds!==undefined&&!unique(task.connectionIds,4,uuid))throw Error('Tasks need unique IDs, valid timing, and bounded source and agent assignments.');
  if((task.sourceIds!==undefined||task.connectionIds!==undefined)&&(!Array.isArray(task.sourceIds)||!Array.isArray(task.connectionIds)||!Number.isSafeInteger(schedule.configVersion)))throw Error('Task assignments require both ID lists and an incremented configVersion.');
  ids.add(task.id);
 }
 if(schedule.configVersion!==undefined&&(!Number.isSafeInteger(schedule.configVersion)||schedule.configVersion<1))throw Error('Increment the saved schedule configVersion.');
 return schedule;
}
export function validatePackRecommendation(r){
 if(r?.cardPackId===undefined)return;
 if(!uuid(r.cardPackId)||typeof r.sourceId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(r.sourceId)||r.dropStatus!==undefined&&!['added','pending','skipped'].includes(r.dropStatus)||['note','skipReason'].some(k=>r[k]!==undefined&&r[k]!==null&&(typeof r[k]!=='string'||r[k].length>4000)))throw Error('Pack cards need cardPackId, a configured sourceId, and bounded notes/status.');
}
export function packAgentRequest(pack){
 return `Update my Lookout card pack ${JSON.stringify(pack.title)} (ID ${pack.id}). Read personal context first and find preferences.theme.cardPacks. Resolve taskId to preferences.search.schedule.routines; read the task instructions, sourceIds and connectionIds there. Use only its selected sources and an assigned, active connection with batches:write. A paused or removed task cannot publish. Verify employer postings; do not invent source access or dates. Publish using publish_batch with a stable eventKey and the actual observation date. Every jobs item needs recommendation.cardPackId=${JSON.stringify(pack.id)}, recommendation.sourceId from the linked task sourceIds, optional dropStatus (added/pending/skipped), note and skipReason. Reuse catalog jobId or a verified canonicalUrl and public employer fields; keep personal analysis in recommendation. One pack per batch. This request does not activate a schedule, send outreach or submit applications.`;
}
export function batchPackDrops(batches,items){
 const dates=new Map(batches.map(b=>[b.id,b.batch_date]));
 return items.map(item=>{const job=item.jobs,rec=item.recommendation||{},employer=job?.employer||{};return {searchProfileId:rec.searchProfileId,company:employer.company||'Unknown company',title:employer.title||'Untitled role',dateSeen:dates.get(item.batch_id),type:employer.employmentType||'',location:employer.location||null,comp:typeof employer.compensation==='string'?employer.compensation:null,status:rec.dropStatus||'pending',note:typeof rec.note==='string'?rec.note:typeof rec.whyItFits==='string'?rec.whyItFits:null,skipReason:rec.skipReason||null,url:job?.canonical_url||null};}).filter(d=>d.dateSeen);
}
