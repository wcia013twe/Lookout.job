// Owned live posting evidence overlays immutable publication snapshots.
// Reuse evidence until an explicit workspace invalidation; share concurrent reads.
const caches=new WeakMap();
const PAGE=200, CHUNK=50;
export function invalidatePostingEvidence(client){caches.delete(client);}
async function evidenceFor(client,userId,ids){
 let state=caches.get(client);
 if(!state||state.owner!==userId){state={owner:userId,entries:new Map()};caches.set(client,state);}
 const missing=ids.filter(id=>!state.entries.has(id));
 for(let start=0;start<missing.length;start+=CHUNK){
  const chunk=missing.slice(start,start+CHUNK);
  const pending=(async()=>{
   const found=new Map();
   for(let offset=0;;offset+=PAGE){
    const {data,error}=await client.from('search_observations')
     .select('checked_at,liveness,employer_posted_at,description,search_listings!inner(job_id)')
     .eq('user_id',userId).eq('search_listings.user_id',userId).in('search_listings.job_id',chunk)
     .order('checked_at',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+PAGE-1);
    if(error)throw error;
    for(const row of data||[]){
     const id=row.search_listings?.job_id;
     if(!chunk.includes(id)||found.has(id))continue;
     if(!Number.isFinite(Date.parse(row.checked_at))||!['active','expired','uncertain'].includes(row.liveness))throw Error('Invalid posting observation');
     found.set(id,{checkedAt:new Date(row.checked_at).toISOString(),liveness:row.liveness,postedAt:row.employer_posted_at||null,description:row.description||''});
    }
    if((data||[]).length<PAGE||found.size===chunk.length)break;
   }
   return found;
  })();
  for(const id of chunk){
   const entry={settled:false,promise:null};
   entry.promise=pending.then(found=>{
    entry.settled=true;
    return found.get(id)||null;
   },error=>{if(state.entries.get(id)===entry)state.entries.delete(id);throw error;});
   state.entries.set(id,entry);
  }
 }
 const result=new Map(await Promise.all(ids.map(async id=>[id,await state.entries.get(id).promise])));
 // Bound retained entries even for a long-lived session with many historical jobs.
 for(const [id,entry] of state.entries){if(state.entries.size<=2000)break;if(entry.settled)state.entries.delete(id);}
 return result;
}
export async function withLatestPostingEvidenceForBatches(client,batches,userId){
 for(const batch of batches)if(batch?.batch?.user_id!==userId||!Array.isArray(batch.items)||batch.items.length>100)throw Error('Owned bounded batch required');
 const ids=[...new Set(batches.flatMap(batch=>batch.items.map(i=>i.job_id)))];
 const evidence=await evidenceFor(client,userId,ids);
 return batches.map(batch=>({...batch,items:batch.items.map(i=>({...i,postingObservation:evidence.get(i.job_id)||null}))}));
}
export async function withLatestPostingEvidence(client,batch,userId){
 return (await withLatestPostingEvidenceForBatches(client,[batch],userId))[0];
}
export function postingRecency(observation){
 if(!observation)return null;
 const posted=observation.postedAt,checked=observation.checkedAt;
 const age=posted&&Date.parse(checked)-Date.parse(posted)>72*3600000;
 return `Employer checked ${checked} · ${observation.liveness}. ${posted?`Published ${new Date(posted).toISOString()}${age?' · older than 72 hours':''}.`:'Publication date not disclosed.'}`;
}
