// A cursor is adopted only alongside its successfully applied rows, per account.
export const WORKSPACE_TABLES=['profiles','preferences','resumes','answer_library','applications','activity_events','submission_attempts','application_milestones','action_inbox','job_batches','batch_items','posting_evidence'];
export function workspaceRowKey(table,row){
 return table==='profiles'||table==='preferences'?row.user_id:table==='batch_items'?`${row.batch_id}:${row.job_id}`:table==='posting_evidence'?row.job_id:row.id;
}
export function mergeWorkspaceSync(previous,message){
 if(!message||!Number.isSafeInteger(message.version)||message.version<0||!['snapshot','delta'].includes(message.mode))throw Error('Invalid workspace sync response');
 if(!Array.isArray(message.signals))throw Error('Missing workspace invalidations');
 if(message.mode==='snapshot'){
  for(const table of WORKSPACE_TABLES)if(!Array.isArray(message.rows?.[table]))throw Error('Incomplete workspace snapshot');
  return message.rows;
 }
 if(!previous)throw Error('Workspace snapshot required');
 const rows={...previous};
 for(const [table,change] of Object.entries(message.changes||{})){
  if(!WORKSPACE_TABLES.includes(table)||!Array.isArray(change.upserts)||!Array.isArray(change.deleted))throw Error('Invalid workspace delta');
  const records=new Map((previous[table]||[]).map(row=>[workspaceRowKey(table,row),row]));
  for(const key of change.deleted)records.delete(key);
  for(const row of change.upserts)records.set(workspaceRowKey(table,row),row);
  rows[table]=[...records.values()];
 }
 return rows;
}
export function workspaceBatches(rows){
 const grouped=new Map(),evidence=new Map((rows.posting_evidence||[]).map(row=>[row.job_id,row]));
 for(const item of rows.batch_items||[]){
  const row=evidence.get(item.job_id);
  const enriched={...item,postingObservation:row?{checkedAt:new Date(row.checked_at).toISOString(),liveness:row.liveness,postedAt:row.employer_posted_at||null,description:row.description||''}:null};
  if(!grouped.has(item.batch_id))grouped.set(item.batch_id,[]);
  grouped.get(item.batch_id).push(enriched);
 }
 return (rows.job_batches||[]).map(batch=>({batch,items:(grouped.get(batch.id)||[]).sort((a,b)=>a.position-b.position)}));
}
