import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {fetchSource,deduplicate} from './ats.ts';
import type {Rpc,Payload,Claim,Dispatch} from './types.ts';

export function listingBatches(rows:Payload[],maxBytes=48000){
  const batches:{offset:number;listings:Payload[]}[]=[];let batch:Payload[]=[];let offset=0;
  for(const row of rows){
    const candidate=[...batch,row];
    if(candidate.length>25||Buffer.byteLength(JSON.stringify(candidate),'utf8')>maxBytes){
      if(!batch.length)throw Error('Discovery observation exceeds bounded transaction size');
      batches.push({offset,listings:batch});offset+=batch.length;batch=[row];
      if(Buffer.byteLength(JSON.stringify(batch),'utf8')>maxBytes)throw Error('Discovery observation exceeds bounded transaction size');
    }else batch=candidate;
  }
  if(batch.length)batches.push({offset,listings:batch});
  return batches;
}
export async function executeSearch(job:Claim['job'] & {search_run_id?:string},dispatch:Dispatch,{request=fetch}: {request?:typeof fetch}={}) {
  const prefix=`job:${job.id}:`;
  const run=job.search_run_id?await dispatch('search.run.read',{runId:job.search_run_id}):await dispatch('search.run.start',{profileId:job.input.profileId,eventKey:prefix+'start'});
  if(run.state!=='active')return {status:run.state==='completed'?'completed':'partial',result:{runId:run.id,summary:'Previously persisted search result recovered.',screening:'review-needed'}};
  const seen=new Set<string>();
  if(job.search_run_id){
    let offset=0;
    // At most ten sources x 500 observations. Refuse an incomplete identity
    // history instead of silently weakening durable deduplication on retry.
    for(let page=0;page<=50;page++){
      const prior=await dispatch('search.discoveries.read',{runId:run.id,offset,limit:100});
      deduplicate(prior.listings,seen);
      if(prior.nextOffset===null)break;
      if(!Number.isSafeInteger(prior.nextOffset)||prior.nextOffset<=offset||prior.nextOffset>5000||page===50)throw Error('Discovery identity history exceeded bounded pagination');
      offset=prior.nextOffset;
    }
  }
  let saved=0;let blocked=0;let scanned=0;
  const sources=run.sources||[];
  for(const [index,source] of sources.entries()){
    if(source.state==='completed'){continue;}
    const observation=index<10?await fetchSource(source.source_id,source.source,{request}):{listings:[],coverage:'truncated',blocker:'Bounded run supports at most ten configured sources.',total:0};
    const rows=deduplicate(observation.listings,seen);scanned+=observation.total;
    // Each idempotency key is tied to a persisted source version. Re-read and
    // checkpoint observations before completion; interrupted sources can repeat
    // safely through canonical database deduplication.
    const checkpoint=source.checkpoint||{};
    let offset=Number.isSafeInteger(checkpoint.savedOffset)?checkpoint.savedOffset:0;
    const sourceKey=createHash('sha256').update(source.source_id).digest('hex');
    // Fetch snapshots may change across retries. Save a source atomically under
    // attempt-specific keys; DB canonical identity prevents duplicate listings.
    const attempt=`${source.version}a${job.attempts}`;
    for(const batch of listingBatches(rows)){
      await dispatch('search.discoveries.save',{runId:run.id,listings:batch.listings,eventKey:`${prefix}${sourceKey}:v${attempt}:batch:${batch.offset}`});
      saved+=batch.listings.length;
    }
    const complete=observation.coverage==='exhaustive';
    if(!complete)blocked++;
    await dispatch('search.progress',{runId:run.id,sourceId:source.source_id,expectedVersion:source.version,state:complete?'completed':'blocked',checkpoint:{savedOffset:offset+rows.length},counts:{observed:observation.total,saved:rows.length},coverage:observation.coverage,blocker:observation.blocker,eventKey:`${prefix}${sourceKey}:v${attempt}:progress`});
  }
  const latest=await dispatch('search.run.read',{runId:run.id});
  const partial=blocked>0 || !latest.sources.every((s:Payload)=>s.state==='completed'&&s.coverage==='exhaustive');
  const summary=`Fetched ${scanned} postings and saved ${saved} canonical discovery observations. ${blocked} sources need review. Eligibility and narrative profile fit require agent review.`;
  await dispatch('search.run.finish',{runId:run.id,expectedVersion:latest.version,state:partial?'partial':'completed',summary,eventKey:prefix+'finish'});
  return {status:partial?'partial':'completed',result:{runId:run.id,observed:scanned,saved,blockedSources:blocked,summary,screening:'review-needed'}};
}
export async function workOnce(rpc:Rpc,{request=fetch}: {request?:typeof fetch}={}){
  const call=async(operation:string,payload:Payload)=>{
    const {data,error}=await rpc('backend_worker',{operation,payload});
    if(error)throw Error('Worker transaction rejected');return data;
  };
  await call('enqueue_due',{});
  const claim:Claim|null=await call('claim',{});
  if(!claim)return false;
  const fencedDispatch:Dispatch=(operation,payload)=>call('dispatch',{jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,operation,payload});
  try{
    if(claim.job.kind!=='search_ats')throw Error('Unsupported backend job');
    const outcome=await executeSearch(claim.job,fencedDispatch,{request});
    await call('finish',{jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,...outcome});
  }catch{
    // Expired/cancelled/revoked jobs reject this too, preserving the newer state.
    await call('finish',{jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,status:'failed',result:{summary:'Search execution failed. Inspect the persisted run before requesting another job.'}}).catch(()=>{});
  }
  return true;
}
export async function runWorker(rpc:Rpc,signal:AbortSignal){
  while(!signal.aborted){
    try{await workOnce(rpc);}catch{console.error('Worker database unavailable; retrying on next poll.');}
    try{await delay(5000,undefined,{signal});}catch{break;}
  }
}
