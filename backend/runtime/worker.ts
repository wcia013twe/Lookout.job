import {screenSearchDiscoveries} from '../../lib/search-screening.mjs';
import {deduplicateDiscoveryRows} from '../../lib/search-dedup.mjs';
import {executeCareerTask} from '../../runner/career-tools.mjs';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {fetchSource} from './ats.ts';
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
export async function executeSearch(job:Claim['job'] & {search_run_id?:string},dispatch:Dispatch,{execute}: {execute?:import('./ats.ts').Execute}={}) {
  const prefix=`job:${job.id}:`;
  const run=job.search_run_id?await dispatch('search.run.read',{runId:job.search_run_id}):await dispatch('search.run.start',{profileId:job.input.profileId,eventKey:prefix+'start'});
  const seen:Payload[]=[];
  if(job.search_run_id){
    let offset=0;
    // At most ten sources x 500 observations. Refuse an incomplete identity
    // history instead of silently weakening durable deduplication on retry.
    for(let page=0;page<=50;page++){
      const prior=await dispatch('search.discoveries.read',{runId:run.id,offset,limit:100});
      seen.push(...prior.listings);
      if(prior.nextOffset===null)break;
      if(!Number.isSafeInteger(prior.nextOffset)||prior.nextOffset<=offset||prior.nextOffset>5000||page===50)throw Error('Discovery identity history exceeded bounded pagination');
      offset=prior.nextOffset;
    }
  }
  let saved=0;let blocked=0;let scanned=0;const provenance:Payload[]=[];
  const sources=run.sources||[];
  for(const [index,source] of (run.state==='active'?sources:[]).entries()){
    if(source.state==='completed'){continue;}
    const observation=index<10?await fetchSource(source.source_id,source.source,{execute,previous:seen}):{listings:[],coverage:'truncated',blocker:'Bounded run supports at most ten configured sources.',total:0,examined:0,provenance:undefined,diagnostics:[]};
    if(observation.provenance)provenance.push(observation.provenance);
    const rows=observation.listings;seen.push(...rows);scanned+=observation.examined??observation.total;
    // Each idempotency key is tied to a persisted source version. Re-read and
    // checkpoint observations before completion; interrupted sources can repeat
    // safely through canonical database deduplication.
    const checkpoint=source.checkpoint||{};
    const offset=Number.isSafeInteger(checkpoint.savedOffset)?checkpoint.savedOffset:0;
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
    await dispatch('search.progress',{runId:run.id,sourceId:source.source_id,expectedVersion:source.version,state:complete?'completed':'blocked',checkpoint:{savedOffset:offset+rows.length,diagnostics:observation.diagnostics||[]},counts:{observed:observation.examined??observation.total,available:observation.total,saved:rows.length},coverage:observation.coverage,blocker:observation.blocker,eventKey:`${prefix}${sourceKey}:v${attempt}:progress`});
  }
  // Every deterministic stage belongs to this one leased job. Only the final
  // shortlist goes to Muse; narrative analysis and four ratings remain agent work.
  const context=await dispatch('search.context',{profileId:run.profile_id||job.input.profileId});
  const profile=context.documents.find((d:Payload)=>d.kind==='profile'&&d.id===(run.profile_id||job.input.profileId));
  if(!profile)throw Error('Current job profile unavailable');
  const discoveries:Payload[]=[];
  for(let offset=0;;){
    const page=await dispatch('search.discoveries.read',{runId:run.id,offset,limit:100,purpose:'screening'});
    discoveries.push(...page.listings);
    if(discoveries.length>250)throw Error('Job exceeds the bounded 250-discovery shortlist pipeline');
    if(page.nextOffset===null)break;
    if(!Number.isSafeInteger(page.nextOffset)||page.nextOffset<=offset||page.nextOffset>5000)throw Error('Invalid job discovery page');
    offset=page.nextOffset;
  }
  const call=async(operation:string,payload:Payload)=>({data:await dispatch(operation,operation==='search.discoveries.read'?{...payload,purpose:'screening'}:payload),error:null});
  const retained=new Set<string>();
  for(let offset=0;offset<discoveries.length;offset+=10){
    const rows=discoveries.slice(offset,offset+10);
    const digest=createHash('sha256').update(JSON.stringify(rows.map(r=>[r.id,r.observation.id]))).digest('hex');
    const request={runId:run.id,listingIds:rows.map(r=>r.id),eventKey:`${prefix}screen:${context.personalVersion}:${profile.version}:${digest}`};
    const screening=await screenSearchDiscoveries(call,request,{evaluate:(input:Payload)=>(execute||executeCareerTask)('filter-discovery',input)});
    if(screening.error)throw Error('Job screening failed or current settings changed');
    if(screening.data.personalVersion!==context.personalVersion||screening.data.evaluatedProfileVersion!==profile.version)throw Error('Job screening settings changed');
    for(const row of screening.data.screenings)if(row.decision!=='ineligible')retained.add(row.listing_id||row.listingId);
  }
  const deduplication=await deduplicateDiscoveryRows(discoveries.filter(row=>retained.has(row.id)),[],{execute:execute||executeCareerTask});
  const current=await dispatch('search.context',{profileId:run.profile_id||job.input.profileId});
  if(current.personalVersion!==context.personalVersion||current.documents.find((d:Payload)=>d.kind==='profile'&&d.id===profile.id)?.version!==profile.version)throw Error('Job settings changed before shortlist completion');
  const latest=await dispatch('search.run.read',{runId:run.id});
  const partial=latest.state==='partial'||!latest.sources.every((s:Payload)=>s.state==='completed'&&s.coverage==='exhaustive');
  const shortlist={...deduplication,evaluatedProfileVersion:profile.version,personalVersion:context.personalVersion,screenedCount:discoveries.length,excludedCount:discoveries.length-retained.size,applicantEligibility:'not-evaluated',reporting:'pending-muse'};
  const summary=`Screened ${discoveries.length} verified discoveries; ${shortlist.retainedListingIds.length} retained after Career Ops deduplication. ${latest.sources.filter((s:Payload)=>s.state!=='completed'||s.coverage!=='exhaustive').length} sources have incomplete coverage. Personal eligibility and reports require Muse review.`;
  if(latest.state==='active')await dispatch('search.run.finish',{runId:run.id,expectedVersion:latest.version,state:partial?'partial':'completed',summary,eventKey:prefix+'finish'});
  return {status:partial?'partial':'completed',result:{pipelineVersion:1,runId:run.id,observed:scanned,saved,blockedSources:blocked,summary,shortlist,stages:{collection:'finished',verification:'finished',screening:'finished',deduplication:'finished'},provenance}};

}
export async function workOnce(rpc:Rpc,{execute}: {execute?:import('./ats.ts').Execute}={}){
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
    const outcome=await executeSearch(claim.job,fencedDispatch,{execute});
    await call('finish',{jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,...outcome});
  }catch{
    // Expired/cancelled/revoked jobs reject this too, preserving the newer state.
    await call('finish',{jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version,status:'failed',result:{summary:'Search execution failed. Inspect the persisted run before requesting another job.'}}).catch(()=>{});
  }
  return true;
}
export function workerDiagnostics(write:(message:string)=>void=console.error,now:()=>number=Date.now){
  let down=false,last=0;
  return {
    unavailable(){const time=now();if(!down||time-last>=60000){write('Worker database unavailable; retrying quietly.');last=time;}down=true;},
    recovered(){if(down)write('Worker database connection recovered.');down=false;},
  };
}
export async function runWorker(rpc:Rpc,signal:AbortSignal){
  const diagnostics=workerDiagnostics();
  while(!signal.aborted){
    try{await workOnce(rpc);diagnostics.recovered();}catch{diagnostics.unavailable();}
    try{await delay(5000,undefined,{signal});}catch{break;}
  }
}
