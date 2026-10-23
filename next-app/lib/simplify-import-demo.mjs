import {parseSimplifyCsv,simplifyColumns} from '../../lib/simplify-import.mjs';
export const simplifyDemoCsv=[simplifyColumns.join(','),
 'Platform Intern,Example Systems (demo),Fictional City,https://example.com/demo/platform,2026-10-20,APPLIED,2026-10-20,No,N/A,Fictional imported application,Internship',
 'Platform Intern,Example Systems (demo),Fictional City,https://example.com/demo/platform,2026-10-19,APPLIED,2026-10-19,No,N/A,Earlier fictional report,Internship',
 'Database Engineer,Example Compute (demo),Remote,N/A,N/A,SAVED,2026-10-21,No,N/A,Fictional saved job without a URL,Full-time',
 'Systems Intern,Example Archive (demo),Remote,N/A,2026-09-01,APPLIED,2026-09-01,Yes,2026-10-01,Fictional archived application,Internship'].join('\n');
export function createDemoSimplifyImport(){
 let version=0,records=[];const events=new Map();
 return async(action,p={})=>{
  if(action==='list')return structuredClone({version,records});
  if(action==='save'&&events.has(p.eventKey)){const old=events.get(p.eventKey);if(old.request!==JSON.stringify(p))throw Error('Event key changed. Preview again.');return structuredClone(old.result);}
  if(action==='save'&&p.expectedVersion!==version)throw Error('Your tracker changed. Preview again.');
  const groups=new Map();for(const row of p.rows){const key=row.url||`${row.company}:${row.title}:${row.location}`.toLowerCase();groups.set(key,[...(groups.get(key)||[]),row]);}
  const decisions=[...groups].map(([key,sourceRows])=>{
   const record=[...sourceRows].sort((a,b)=>Number(b.status==='APPLIED')-Number(a.status==='APPLIED')||(b.statusDate||'').localeCompare(a.statusDate||''))[0];
   const old=records.find(r=>r.key===key);return {key,record:{...record,notes:[...new Set(sourceRows.map(r=>r.notes).filter(Boolean))].join('\n\n')},sourceRows,disposition:old?'already imported':'new',id:old?.id,duplicateRows:sourceRows.length-1};
  });
  if(action==='save'){for(const d of decisions)if(d.disposition==='new'){d.id=`demo-import-${records.length+1}`;records.push({id:d.id,key:d.key,record:d.record,source_rows:d.sourceRows});}version++;}
  const result={version,added:decisions.filter(d=>d.disposition==='new').length,skipped:decisions.filter(d=>d.disposition!=='new').length,duplicateRows:p.rows.length-decisions.length,decisions};
  if(action==='save')events.set(p.eventKey,{request:JSON.stringify(p),result:structuredClone(result)});
  return result;
 };
}
export const parseDemoSimplify=()=>parseSimplifyCsv(simplifyDemoCsv);
