import {validateImport} from '../../supabase/functions/agent-gateway/simplify-import.mjs';
import {validateImportedActions} from '../../lib/imported-actions.mjs';
import {parseSimplifyCsv,simplifyColumns,importStatusRank,importStatuses,importEmploymentTypes} from '../../lib/simplify-import.mjs';
export const simplifyDemoCsv=[simplifyColumns.join(','),
 'Platform Intern,Example Systems (demo),Fictional City,https://example.com/demo/platform,2026-10-20,APPLIED,2026-10-20,No,N/A,Fictional imported application,Internship',
 'Platform Intern,Example Systems (demo),Fictional City,https://example.com/demo/platform,2026-10-19,APPLIED,2026-10-19,No,N/A,Earlier fictional report,Internship',
 'Database Engineer,Example Compute (demo),Remote,N/A,N/A,SAVED,2026-10-21,No,N/A,Fictional saved job without a URL,Full-time',
 'Systems Intern,Example Archive (demo),Remote,N/A,2026-09-01,REJECTED,2026-10-01,Yes,2026-10-01,Fictional rejected application,Part-time'].join('\n');
export function createDemoSimplifyImport(initial=[]){
 let version=initial.length?1:0,records=structuredClone(initial);const events=new Map();
 return async(action,p={})=>{
  if(action==='list')return structuredClone({version,records});
  if(['save','update'].includes(action)&&events.has(p.eventKey)){const old=events.get(p.eventKey);if(old.request!==JSON.stringify(p))throw Error('Event key changed. Preview again.');return structuredClone(old.result);}
  if(['save','update'].includes(action)&&p.expectedVersion!==version)throw Error('Your tracker changed. Preview again.');
  if(action==='update'){
   validateImport('imports.update',p);
   const old=records.find(r=>r.id===p.id);if(!old)throw Error('Imported job not found.');
   if(!Object.hasOwn(importStatuses,p.changes.status||old.record.status)||!Object.hasOwn(importEmploymentTypes,p.changes.employmentType||old.record.employmentType))throw Error('Unsupported tracker value.');
   const merged={...old.record,...p.changes};
   const stage=['SAVED','APPLIED','SCREEN','INTERVIEW','OFFER'];const roundRank=Math.max(0,...(merged.rounds||[]).filter(r=>!r.cancelled).map(r=>r.stage==='INTERVIEW'?3:2));if(stage.includes(merged.status)&&roundRank>stage.indexOf(merged.status))merged.status=stage[roundRank];
   validateImportedActions(merged);
   old.record=merged;version++;
   const result={version,record:structuredClone(old),verifiedSubmission:false};events.set(p.eventKey,{request:JSON.stringify(p),result:structuredClone(result)});return result;
  }
  const groups=new Map();for(const row of p.rows){const key=row.url||`${row.company}:${row.title}:${row.location}`.toLowerCase();groups.set(key,[...(groups.get(key)||[]),row]);}
  const decisions=[...groups].map(([key,sourceRows])=>{
   const record=[...sourceRows].sort((a,b)=>importStatusRank(b.status)-importStatusRank(a.status)||(b.statusDate||'').localeCompare(a.statusDate||''))[0];
   const old=records.find(r=>r.key===key);return {key,record:{...record,appliedDate:record.appliedDate||sourceRows.map(r=>r.appliedDate).filter(Boolean).sort()[0]||null,notes:[...new Set(sourceRows.map(r=>r.notes).filter(Boolean))].join('\n\n')},sourceRows,disposition:old?'already imported':'new',id:old?.id,duplicateRows:sourceRows.length-1};
  });
  if(['save','update'].includes(action)){for(const d of decisions)if(d.disposition==='new'){d.id=`00000000-0000-4000-8000-${String(records.length+1).padStart(12,'0')}`;records.push({id:d.id,key:d.key,record:d.record,source_rows:d.sourceRows});}version++;}
  const result={version,added:decisions.filter(d=>d.disposition==='new').length,skipped:decisions.filter(d=>d.disposition!=='new').length,duplicateRows:p.rows.length-decisions.length,decisions};
  if(['save','update'].includes(action))events.set(p.eventKey,{request:JSON.stringify(p),result:structuredClone(result)});
  return result;
 };
}
export const parseDemoSimplify=()=>parseSimplifyCsv(simplifyDemoCsv);
