import {batchRoles} from './cloud-model.mjs';
// Derived from immutable owned batches. No new publication, table or writer.
export function cumulativeDiscoverBatch(batches){
 if(!batches.length)return null;
 const ordered=[...batches].sort((a,b)=>(Date.parse(b.batch.created_at||b.batch.batch_date)-Date.parse(a.batch.created_at||a.batch.batch_date))||String(b.batch.id).localeCompare(String(a.batch.id)));
 const latest=new Map(),firstDates=new Map();
 for(const {batch,items} of ordered)for(const item of items){
  if(!item.jobs)continue;
  const key=item.jobs.canonical_url||item.job_id;
  if(!latest.has(key))latest.set(key,{item,date:batch.batch_date});
  if(!firstDates.has(key)||batch.batch_date<firstDates.get(key))firstDates.set(key,batch.batch_date);
 }
 const roles=[...latest].flatMap(([key,{item,date}])=>batchRoles([item],firstDates.get(key)||date));
 return {roles,date:ordered.map(b=>b.batch.batch_date).sort().at(-1),label:'All reviewed jobs',cumulative:true,batchCount:batches.length};
}
