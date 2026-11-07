import {screenSearchDiscoveries} from '../../lib/search-screening.mjs';
import {deduplicateDiscoveryRows} from '../../lib/search-dedup.mjs';
import {executeCareerTask} from '../../runner/career-tools.mjs';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {SearchStaging,pruneSearchStaging,observationHash} from './search-staging.ts';
import {assertDiscoveryResults} from '../../lib/discovery-filter-contract.mjs';
import {tmpdir} from 'node:os';
import path from 'node:path';
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

// Prioritize aggregate defaults, then deterministically order the full employer
// catalog. The seed is durable across job retries.
export function orderedSearchSources(sources:Payload[],runId:string){
 const primary=new Set(['hiringcafe','simplify-summer','simplify-newgrad','simplify-offseason','jobright-newgrad','jobright-internship']);
 const rank=(s:Payload)=>createHash('sha256').update(runId+':'+s.source_id).digest('hex');
 return [...sources].sort((a,b)=>Number(primary.has(b.source?.id))-Number(primary.has(a.source?.id))||rank(a).localeCompare(rank(b)));
}
// Career Ops scan.mjs worker-pool pattern: bound concurrent fetches, not coverage.
// Drain active workers before propagating a failure so no writes outlive the job.
export async function scanAllSources<T>(sources:T[],visit:(source:T)=>Promise<void>,concurrency=10,onError?:(error:unknown)=>void){
  if(!Number.isSafeInteger(concurrency)||concurrency<1)throw Error('Invalid scan concurrency');
  let index=0;let failed=false;
  const next=async()=>{while(!failed&&index<sources.length){const source=sources[index++];try{await visit(source);}catch(error){failed=true;onError?.(error);throw error;}}};
  const results=await Promise.allSettled(Array.from({length:Math.min(concurrency,sources.length)},next));
  const failure=results.find(result=>result.status==='rejected');
  if(failure?.status==='rejected')throw failure.reason;
}

export async function executeSearch(job:Claim['job'],dispatch:Dispatch,{execute=executeCareerTask,request,signal,onFailure,stagingRoot=process.env.LOOKOUT_SEARCH_STAGING_DIR||path.join(tmpdir(),'lookout-search-staging')}: {execute?:import('./ats.ts').Execute;request?:typeof fetch;signal?:AbortSignal;onFailure?:(error:unknown)=>void;stagingRoot?:string}={}) {
 const prefix=`job:${job.id}:`;
 let run=job.search_run_id?await dispatch('search.run.read',{runId:job.search_run_id}):null;
 const profileId=run?.profile_id||job.input.profileId;
 const context=await dispatch('search.context',{profileId});
 const profile=context.documents.find((d:Payload)=>d.kind==='profile'&&d.id===profileId);
 if(!profile)throw Error('Current job profile unavailable');
 const portals=context.documents.find((d:Payload)=>d.kind==='portals')?.projection||{};
 const filterPlan=await execute('inspect-discovery-filters',{profile:profile.projection,portals});
 if(!filterPlan.ready)return {status:'failed',result:{code:'search_filters_not_ready',summary:'Configure the selected profile filters before searching.',profileId,filterPlan,evaluatedProfileVersion:profile.version,personalVersion:context.personalVersion,recovery:{tool:'read_search_filter_plan',arguments:{profileId}}}};
 if(!run)run=await dispatch('search.run.start',{profileId,eventKey:prefix+'start'});
 const staging=new SearchStaging(stagingRoot,job.id,run.id);
 await pruneSearchStaging(stagingRoot);
 const history:Payload[]=[];
 for(let offset=0;;){const page=await dispatch('search.history.read',{offset,limit:100});history.push(...page.listings);if(page.nextOffset===null)break;if(!Number.isSafeInteger(page.nextOffset)||page.nextOffset<=offset)throw Error('Invalid search history page');offset=page.nextOffset;}
 const persisted:Payload[]=[];
 for(let offset=0;;){const page=await dispatch('search.discoveries.read',{runId:run.id,offset,limit:100,purpose:'screening'});persisted.push(...page.listings);if(page.nextOffset===null)break;if(!Number.isSafeInteger(page.nextOffset)||page.nextOffset<=offset)throw Error('Invalid discovery page');offset=page.nextOffset;}
 const sources=orderedSearchSources(run.sources||[],run.id),snapshots=new Map<string,Payload>(),seen:Payload[]=[];
 for(const source of sources){const snapshot=await staging.read(source.checkpoint?.stagingKey);if(snapshot){snapshots.set(source.source_id,snapshot);seen.push(...snapshot.seen);}}
 await scanAllSources(run.state==='active'?sources:[],async source=>{
  signal?.throwIfAborted();let snapshot=snapshots.get(source.source_id);
  // A completed SQL checkpoint without its files must be recollected, never
  // treated as an empty source. Only committed immutable snapshots are resumed.
  if(source.state==='completed'&&snapshot?.finished)return;
  snapshot=snapshot||{accepted:[],seen:[],processed:0,screened:0,excluded:0,available:0};
  snapshot.currentProcessed=0;
  snapshots.set(source.source_id,snapshot);
  let version=source.version,index=0;
  const checkpoint=async(state:string,coverage:string,blocker:string,diagnostics:Payload[]=[])=>{
   signal?.throwIfAborted();const stagingKey=await staging.write(job.version,source.source_id,snapshot!);
   const result=await dispatch('search.progress',{runId:run.id,sourceId:source.source_id,expectedVersion:version,state,coverage,blocker,
    checkpoint:{stage:state==='active'?'temporary-staging':'finished',stagingKey,processed:snapshot!.processed,diagnostics:diagnostics.slice(-10).map(d=>({status:d.status,reason:String(d.reason||'').slice(0,300)}))},
    counts:{observed:snapshot!.processed,available:snapshot!.available,staged:snapshot!.accepted.length,saved:0},eventKey:`${prefix}stage:${source.source_id}:v${job.version}:${source.version}:${index++}`});
   version=result?.version??version+1;
  };
  await checkpoint('active','unknown','');
  const collected=await fetchSource(source.source_id,source.source,{execute,previous:[...seen,...history.filter(h=>h.tracked)],profile:profile.projection,request,signal,prefilter:filterPlan.config||true,days:run.days||(run.mode==='backlog'?30:3),onBatch:async(result,progress)=>{
   signal?.throwIfAborted();
   const rows=result.listings.map(row=>({...row,id:row.url}));
   const evaluated=rows.length?await execute('filter-discovery',{profile:profile.projection,portals,listings:rows.map(row=>({...row,canonical_url:row.url,employment_type:row.employmentType,observation:{description:row.description,employer_posted_at:row.employerPostedAt}})),now:Date.now()}):{results:[]};
   assertDiscoveryResults(evaluated.results,rows);
   const passing=new Set(evaluated.results.filter((r:Payload)=>r.passed).map((r:Payload)=>r.listingId));
   snapshot!.accepted.push(...rows.filter(row=>passing.has(row.id)).map(row=>({listing:row,screening:evaluated.results.find((r:Payload)=>r.listingId===row.id)})));
   const identities=result.listings.map(({description,...row})=>row);
   snapshot!.seen.push(...identities);seen.push(...identities);
   snapshot!.processed+=progress.processed-(snapshot!.currentProcessed||0);snapshot!.currentProcessed=progress.processed;
   snapshot!.screened+=rows.length;snapshot!.excluded+=rows.length-passing.size;snapshot!.available=progress.available;
   await checkpoint('active','unknown','',result.diagnostics);
  }});
  snapshot!.currentProcessed=0;snapshot!.finished=true;snapshot!.coverage=collected.coverage;snapshot!.blocker=collected.blocker;snapshot!.available=collected.total;
  snapshot!.examined=collected.examined??collected.total;snapshot!.prefilterExcluded=collected.provenance?.prefilterExcluded||0;
  await checkpoint(collected.coverage==='exhaustive'?'completed':'blocked',collected.coverage,collected.blocker,collected.diagnostics);
 },10,onFailure);
 const latestContext=await dispatch('search.context',{profileId});
 if(latestContext.personalVersion!==context.personalVersion||latestContext.documents.find((d:Payload)=>d.kind==='profile'&&d.id===profileId)?.version!==profile.version)throw Error('Job settings changed during source collection');
 // Compare unchanged content only after fresh verification. Existing tracked
 // applications are excluded before verification and are never updated here.
 const pool=[...snapshots.values()].flatMap(snapshot=>snapshot.accepted);
 const alreadyCommitted=new Set(persisted.map(row=>row.id));
 const unchanged=history.filter(h=>h.tracked||!alreadyCommitted.has(h.id)&&pool.some(({listing:r})=>h.contentHash===observationHash(r)&&h.company===r.company&&h.title===r.title&&(h.location||'')===(r.location||'')&&(h.employment_type||'')===(r.employmentType||'')));
 const candidates=[...new Map(pool.map(item=>[item.listing.id,item])).values()];
 const dedup=await deduplicateDiscoveryRows(candidates.map(({listing})=>listing),unchanged,{execute});
 const keep=new Set(dedup.retainedListingIds);
 const selected=candidates.filter(({listing})=>keep.has(listing.id));
 // No discovery rows are written until every source has finished and the full
 // filtered, verified, history-deduplicated shortlist is ready.
 for(const batch of listingBatches(selected.map(({listing:{id,...row}})=>row))){
  signal?.throwIfAborted();const digest=createHash('sha256').update(JSON.stringify(batch.listings)).digest('hex');
  await dispatch('search.discoveries.save',{runId:run.id,listings:batch.listings,eventKey:prefix+'shortlist:'+digest});

 }
 const finalRows:Payload[]=[];
 for(let offset=0;;){const page=await dispatch('search.discoveries.read',{runId:run.id,offset,limit:100,purpose:'screening'});finalRows.push(...page.listings);if(page.nextOffset===null)break;if(!Number.isSafeInteger(page.nextOffset)||page.nextOffset<=offset)throw Error('Invalid shortlist page');offset=page.nextOffset;}
 const call=async(operation:string,payload:Payload)=>({data:await dispatch(operation,operation==='search.discoveries.read'?{...payload,purpose:'screening'}:payload),error:null});
 for(let offset=0;offset<finalRows.length;offset+=10){
  const rows=finalRows.slice(offset,offset+10),digest=createHash('sha256').update(JSON.stringify(rows.map(r=>[r.id,r.observation.id]))).digest('hex');
  const result=await screenSearchDiscoveries(call,{runId:run.id,listingIds:rows.map(r=>r.id),eventKey:prefix+'shortlist-screen:'+digest},{evaluate:(input:Payload)=>execute('filter-discovery',input)});
  if(result.error)throw Error('Shortlist screening commit rejected');
 }
 const latest=await dispatch('search.run.read',{runId:run.id});
 if(latest.state==='active')for(const source of latest.sources){
  const count=finalRows.filter(row=>selected.some(({listing:r})=>r.sourceId===source.source_id&&(row.canonical_url===r.url||row.identity==='ats:'+r.atsIdentity))).length;
  await dispatch('search.progress',{runId:run.id,sourceId:source.source_id,expectedVersion:source.version,state:source.state,coverage:source.coverage,blocker:source.blocker||'',checkpoint:{...source.checkpoint,stage:'shortlist-ready'},counts:{...source.counts,saved:count},eventKey:`${prefix}shortlist-progress:${source.source_id}:v${source.version}`});
 }
 const finishedRun=await dispatch('search.run.read',{runId:run.id});
 const incomplete=latest.sources.filter((s:Payload)=>s.state!=='completed'||s.coverage!=='exhaustive').length;
 const shortlist={runId:run.id,retainedListingIds:finalRows.slice(0,100).map(r=>r.id),totalRetained:finalRows.length,nextOffset:finalRows.length>100?100:null,evaluatedProfileVersion:profile.version,personalVersion:context.personalVersion,screenedCount:[...snapshots.values()].reduce((n,s)=>n+s.screened,0),excludedCount:[...snapshots.values()].reduce((n,s)=>n+s.excluded,0),unchangedOrDuplicate:pool.length-selected.length,applicantEligibility:'not-evaluated',reporting:'pending-muse'};
 const summary=`${finalRows.length} new or changed jobs ready for agent review. ${incomplete} sources have incomplete coverage. Unfiltered postings were temporary and are not saved as discoveries.`;
 if(finishedRun.state==='active')await dispatch('search.run.finish',{runId:run.id,expectedVersion:finishedRun.version,state:incomplete?'partial':'completed',summary,eventKey:prefix+'finish'});
 // Cleanup happens after the fenced job finish, not before a retry can recover.
 return {status:incomplete?'partial':'completed',result:{pipelineVersion:2,runId:run.id,storage:'direct-shortlist',observed:[...snapshots.values()].reduce((n,s)=>n+(s.examined||0),0),prefilterExcluded:[...snapshots.values()].reduce((n,s)=>n+(s.prefilterExcluded||0),0),filterPlan:{ready:true,config:{title_filter:filterPlan.config?.title_filter,skip_tiers:filterPlan.config?.skip_tiers}},saved:finalRows.length,shortlist,summary,stages:{collection:'finished',verification:'finished',screening:'finished',deduplication:'finished'}}};
}

export async function workOnce(rpc:Rpc,{execute,applicationExecutor,signal,heartbeatMs=30000,stagingRoot}: {execute?:import('./ats.ts').Execute;applicationExecutor?:(claim:Claim,rpc:Rpc)=>Promise<Payload>;signal?:AbortSignal;heartbeatMs?:number;stagingRoot?:string}={}){
  const call=async(operation:string,payload:Payload)=>{
    const {data,error}=await rpc('backend_worker',{operation,payload});
    if(error)throw Object.assign(Error(['Backend lease changed','Search lease changed','Source changed','Invalid observed listing','Invalid source progress','Invalid worker payload','Run is closed','Discovery observation exceeds bounded transaction size'].includes(error.message)?error.message:'Worker transaction rejected'),{code:error.code||'unknown',operation:operation==='dispatch'?payload.operation:operation});return data;
  };
  signal?.throwIfAborted();
  const applicationClaim:Claim|null=applicationExecutor?await call('claim_application',{}):null;
  const claim:Claim|null=applicationClaim||await call('claim',{});if(!claim)return false;
  const controller=new AbortController();const abort=()=>controller.abort(signal?.reason||Error('Worker stopped'));
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const fence={jobId:claim.job.id,leaseToken:claim.leaseToken,expectedVersion:claim.job.version};
  let stopped=false,timer:ReturnType<typeof setTimeout>|undefined,pending:Promise<void>=Promise.resolve();
  const renew=()=>{timer=setTimeout(()=>{pending=(async()=>{
    try{await call('heartbeat',fence);}catch(error){if(!stopped)controller.abort(error);}
    if(!stopped&&!controller.signal.aborted)renew();
  })();},heartbeatMs);};
  const stop=async()=>{stopped=true;clearTimeout(timer);await pending;};
  const fencedDispatch:Dispatch=async(operation,payload)=>{
    controller.signal.throwIfAborted();
    try{return await call('dispatch',{...fence,operation,payload});}
    catch(error){controller.abort(error);throw error;}
  };
  const runTask:import('./ats.ts').Execute=async(task,input)=>{
    controller.signal.throwIfAborted();return (execute||executeCareerTask)(task,input,{signal:controller.signal});
  };
  try{
    if(!['search_ats','application_submit'].includes(claim.job.kind))throw Error('Unsupported backend job');
    if(claim.job.kind==='search_ats')renew();
    const outcome=claim.job.kind==='application_submit'&&applicationExecutor?await applicationExecutor(claim,rpc):await executeSearch(claim.job,fencedDispatch,{execute:runTask,stagingRoot,signal:controller.signal,onFailure:error=>controller.abort(error),request:(url,init={})=>fetch(url,{...init,signal:AbortSignal.any([controller.signal,...(init.signal?[init.signal]:[])])})});
    await stop();controller.signal.throwIfAborted();await call('finish',{...fence,...outcome});
    if(claim.job.kind==='search_ats'&&outcome.result?.pipelineVersion===2)await new SearchStaging(stagingRoot||process.env.LOOKOUT_SEARCH_STAGING_DIR||path.join(tmpdir(),'lookout-search-staging'),claim.job.id,outcome.result.runId).clear();
  }catch(error){
    const failure=error as Error & {code?:string;operation?:string};
    console.error(JSON.stringify({service:'lookout-worker',event:'execution-interrupted',kind:claim.job.kind,operation:failure.operation||'pipeline',code:failure.code||'execution',reason:['Backend lease changed','Search lease changed','Source changed','Invalid observed listing','Invalid source progress','Invalid worker payload','Run is closed','Discovery observation exceeds bounded transaction size'].includes(failure.message)?failure.message:'Execution interrupted'}));
    const lostOwnership=controller.signal.aborted;
    controller.abort(Error('Search execution interrupted'));await stop();
    // Lost ownership or shutdown leaves the pinned run reclaimable after expiry.
    if(!lostOwnership)await call('finish',{...fence,status:'failed',result:{summary:claim.job.kind==='application_submit'?'Application execution interrupted. Inspect its saved attempt before requesting another job.':'Search execution interrupted. Previously saved observations and source checkpoints are retained.'}}).catch(()=>{});
  }finally{await stop();signal?.removeEventListener('abort',abort);}
  return true;
}

export function workerDiagnostics(write:(message:string)=>void=console.error,now:()=>number=Date.now){
  let down=false,last=0;
  return {
    unavailable(){const time=now();if(!down||time-last>=60000){write('Worker database unavailable; retrying quietly.');last=time;}down=true;},
    recovered(){if(down)write('Worker database connection recovered.');down=false;},
  };
}
export async function runWorker(rpc:Rpc,signal:AbortSignal,options:Parameters<typeof workOnce>[1]={}){
  const diagnostics=workerDiagnostics();
  while(!signal.aborted){
    try{await workOnce(rpc,{...options,signal});diagnostics.recovered();}catch{diagnostics.unavailable();}
    try{await delay(5000,undefined,{signal});}catch{break;}
  }
}
