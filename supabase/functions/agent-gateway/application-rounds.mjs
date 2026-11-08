export const ROUND_STAGES=['SCREEN','INTERVIEW'];
export const ROUND_TYPES=['recruiter','oa','take_home','technical','system_design','behavioral','hiring_manager','onsite','other'];
export const ROUND_PHASES=['received','scheduled','completed'];
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
export function roundDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)||!Number.isFinite(Date.parse(value)))return null;
 return new Date(value.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)===value.slice(0,10)?value:null;
}
export function validateRoundMetadata(round){
 if(!round||typeof round!=='object'||Array.isArray(round)||Object.keys(round).some(k=>!['stage','type','cancelled'].includes(k))||!ROUND_STAGES.includes(round.stage)||!ROUND_TYPES.includes(round.type)||(round.cancelled!==undefined&&typeof round.cancelled!=='boolean'))throw Error('Round needs Screen/Interview stage, a supported type and optional cancelled boolean.');
}
export function validateImportedRounds(rounds){
 if(!Array.isArray(rounds)||rounds.length>100)throw Error('Use up to 100 rounds per application.');
 const ids=new Set();
 for(const r of rounds){
  if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).some(k=>!['id','label','stage','type','phase','date','notes','cancelled'].includes(k))||!text(r.id,80)||!/^[-\w:.]+$/.test(r.id)||ids.has(r.id)||!text(r.label,300)||!ROUND_PHASES.includes(r.phase)||typeof r.notes!=='string'||r.notes.length>2000||typeof r.cancelled!=='boolean'||(r.date!==null&&!roundDate(r.date)))throw Error('Each round needs a unique ID, label, stage/type, phase, date or null, notes and cancelled flag.');
  validateRoundMetadata({stage:r.stage,type:r.type,cancelled:r.cancelled});ids.add(r.id);
 }
}
const legacy={recruiter_call:['SCREEN','recruiter'],phone_screen:['SCREEN','recruiter'],technical_round:['INTERVIEW','technical'],interview:['INTERVIEW','other'],onsite:['INTERVIEW','onsite']};
// Counts only real saved rounds. Status placeholders, activity text and notes do
// not become rounds. Corrections replace an event instead of adding a round.
/** @param {any} application
 * @returns {Array<{id:string,label:string,stage:string,type:string,phase:string,date:string|null,notes:string,cancelled:boolean,status:string}>} */
export function applicationRounds(application={}){
 if(application.imported)return (application.imported.record?.rounds||[]).map(r=>({...r,status:r.cancelled?'cancelled':r.phase==='received'?'pending':r.phase}));
 const rows=Array.isArray(application.milestones)?application.milestones:[];
 const byId=new Map(rows.map((row,index)=>[row.id,{row,index}]));
 const rootIndex=id=>{let value=byId.get(id),seen=new Set();while(value?.row.supersedes_id&&byId.has(value.row.supersedes_id)&&!seen.has(value.row.supersedes_id)){seen.add(value.row.supersedes_id);value=byId.get(value.row.supersedes_id);}return value?.index??Infinity;};
 const replaced=new Set(rows.map(r=>r.supersedes_id).filter(Boolean)),seen=new Set();
 return rows.flatMap((r,index)=>{
  if(replaced.has(r.id)||!legacy[r.kind]||r.id==='current-status')return [];
  const id=r.id||`legacy-round-${index}`;if(seen.has(id))return [];seen.add(id);
  const defaults=legacy[r.kind],meta=r.round||{};
  return [{id,label:r.label||'Recorded round',stage:ROUND_STAGES.includes(meta.stage)?meta.stage:defaults[0],type:ROUND_TYPES.includes(meta.type)?meta.type:defaults[1],phase:ROUND_PHASES.includes(r.phase)?r.phase:'received',date:roundDate(r.occurred_at),notes:r.source?.note||r.source?.excerpt||'',cancelled:meta.cancelled===true,status:meta.cancelled?'cancelled':r.phase==='completed'?'completed':r.phase==='scheduled'?'scheduled':'pending'}];
 }).sort((a,b)=>rootIndex(a.id)-rootIndex(b.id));
}
export function applicationRoundLevel(application){return Math.max(0,...applicationRounds(application).filter(r=>!r.cancelled).map(r=>r.stage==='INTERVIEW'?3:2));}
export function applicationRoundStats(applications=[]){
 const empty=()=>({total:0,pending:0,scheduled:0,completed:0,cancelled:0});
 const result={...empty(),applicationsWithRounds:0,byStage:{SCREEN:empty(),INTERVIEW:empty()},byType:Object.fromEntries(ROUND_TYPES.map(type=>[type,empty()]))};
 for(const app of applications){const rounds=applicationRounds(app);if(rounds.length)result.applicationsWithRounds++;
  for(const round of rounds){for(const count of [result,result.byStage[round.stage],result.byType[round.type]]){count.total++;count[round.status]++;}}
 }
 return result;
}
export function roundStatsFromContext(context){
 const native=context.applications||[];
 const imports=(context.imports||[]).filter(row=>!native.some(app=>(row.record.url&&row.record.url===app.url)||['company','title','location'].every(k=>String(row.record[k]||'').toLowerCase()===String(app[k]||'').toLowerCase()))).map(row=>({imported:row}));
 return applicationRoundStats([...native,...imports]);
}
