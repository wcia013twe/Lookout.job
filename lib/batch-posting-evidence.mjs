// Owned live posting evidence overlays immutable publication snapshots.
// No profile, answers or AI assessment are loaded or modified here.
export async function withLatestPostingEvidence(client,batch,userId){
 if(!batch||batch.batch?.user_id!==userId||!Array.isArray(batch.items)||batch.items.length>100)throw Error('Owned bounded batch required');
 const ids=[...new Set(batch.items.map(i=>i.job_id))];
 const evidence=new Map(await Promise.all(ids.map(async id=>{
  const {data,error}=await client.from('search_observations')
   .select('checked_at,liveness,employer_posted_at,description,search_listings!inner(job_id)')
   .eq('user_id',userId).eq('search_listings.user_id',userId).eq('search_listings.job_id',id)
   .order('checked_at',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1);
  if(error)throw error;
  const row=data?.[0];
  if(!row)return [id,null];
  if(!Number.isFinite(Date.parse(row.checked_at))||!['active','expired','uncertain'].includes(row.liveness))throw Error('Invalid posting observation');
  return [id,{checkedAt:new Date(row.checked_at).toISOString(),liveness:row.liveness,postedAt:row.employer_posted_at||null,description:row.description||''}];
 })));
 return {...batch,items:batch.items.map(i=>({...i,postingObservation:evidence.get(i.job_id)||null}))};
}
export function postingRecency(observation){
 if(!observation)return null;
 const posted=observation.postedAt,checked=observation.checkedAt;
 const age=posted&&Date.parse(checked)-Date.parse(posted)>72*3600000;
 return `Employer checked ${checked} · ${observation.liveness}. ${posted?`Published ${new Date(posted).toISOString()}${age?' · older than 72 hours':''}.`:'Publication date not disclosed.'}`;
}
