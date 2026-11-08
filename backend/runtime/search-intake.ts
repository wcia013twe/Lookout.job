import {SearchStaging} from './search-staging.ts';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {jobrightFeed} from './jobright.ts';
import {assertDiscoveryResults} from '../../lib/discovery-filter-contract.mjs';
import {executeCareerTask} from '../../runner/career-tools.mjs';
import {readSimplifyLeads,simplifyFeed} from './simplify.ts';
import {verifyLeadSource} from './ats.ts';
import type {Payload} from './types.ts';
type Call=(operation:string,payload:Payload)=>Promise<{data?:any;error?:any}>;
export async function submitSearchLeads(call:Call,payload:Payload,{verify=verifyLeadSource}={}){
 // The internal replay read authorizes scopes/ownership/source before any network
 // access and prevents an exact retry from re-fetching changed employer content.
 const replay=await call('search.leads.read',{request:payload});
 if(replay.error)return replay;
 if(replay.data)return {data:{...replay.data,replayed:true},error:null};
 const run=await call('search.run.read',{runId:payload.runId});if(run.error)return run;
 const source=run.data.sources?.find((s:Payload)=>s.source_id===payload.sourceId)?.source;
 const verified=await verify(payload.sourceId,payload.leads,{source});
 const diagnostics=verified.diagnostics||[];
 return call('search.leads.commit',{request:payload,observations:verified.listings,diagnostics});
}

export async function readSearchSourceLeads(call:Call,payload:Payload,{stagingRoot=process.env.LOOKOUT_SEARCH_STAGING_DIR||path.join(tmpdir(),'lookout-search-staging'),readJob=(args:Payload)=>call('backend.jobs.read',args)}={}){
 const result=await call('search.run.read',{runId:payload.runId});if(result.error)return result;
 const source=result.data?.sources?.find((s:Payload)=>s.source_id===payload.sourceId);
 if(!source)return {error:{code:'P0002',message:'Owned run source not found'}};
 const address=source.source?.careers_url;
 if(jobrightFeed(address)){
  const jobId=source.checkpoint?.stagingJobId;
  if(typeof jobId!=='string')return {error:{code:'P0002',message:'This run has no retained Jobright pool. A new authorized search is needed; historical rows cannot be reconstructed.'}};
  const jobs=await readJob({jobId});if(jobs.error)return jobs;
  const job=jobs.data?.jobs?.find((j:Payload)=>j.id===jobId&&j.search_run_id===payload.runId);
  if(!job)return {error:{code:'42501',message:'Retained source pool must belong to this owned backend run.'}};
  const snapshot=await new SearchStaging(stagingRoot,jobId,payload.runId).read(source.checkpoint?.stagingKey);
  if(!Array.isArray(snapshot?.rawLeads)||!Number.isFinite(Date.parse(snapshot.retainedAt))||Date.now()-Date.parse(snapshot.retainedAt)>7*86400000)return {error:{code:'P0002',message:'Temporary Jobright pool is unavailable or expired. Start a new authorized search; no leads were inferred.'}};
  const offset=payload.offset||0,limit=payload.limit||50,total=snapshot.rawLeads.length;
  return {data:{sourceId:payload.sourceId,total,offset,nextOffset:offset+limit<total?offset+limit:null,leads:snapshot.rawLeads.slice(offset,offset+limit),storage:'temporary-source-leads',verified:false,applicantEligibility:'not-evaluated',retentionDays:7},error:null};
 }

 if(!simplifyFeed(address))return {error:{code:'22023',message:'Source requires the agent runtime or supported copied provider scanner; aggregate lead paging supports official Simplify feeds only.'}};
 try{
  const context=await call('search.context',{profileId:result.data.profile_id});if(context.error)return context;
  const profile=context.data.documents.find((d:Payload)=>d.kind==='profile'&&d.id===result.data.profile_id);
  if(!profile)return {error:{code:'P0002'}};
  const page=await readSimplifyLeads(address,{offset:payload.offset,limit:payload.limit});
  const filtered:any=await executeCareerTask('filter-discovery',{profile:profile.projection,listings:page.leads,portals:context.data.documents.find((d:Payload)=>d.kind==='portals')?.projection||{}});
  assertDiscoveryResults(filtered.results,page.leads);
  const nextContext=await call('search.context',{profileId:result.data.profile_id});if(nextContext.error)return nextContext;
  if(nextContext.data.personalVersion!==context.data.personalVersion)return {error:{code:'40001'}};
  return {data:{...page,sourceId:payload.sourceId,evaluatedProfileVersion:profile.version,unfilteredPageCount:page.leads.length,leads:page.leads.filter((_lead:Payload,index:number)=>filtered.results[index].passed),excluded:page.leads.flatMap((lead:Payload,index:number)=>filtered.results[index].passed?[]:[{url:lead.url,rejectedBy:filtered.results[index].rejectedBy}]),diagnostics:filtered.diagnostics,filterProvenance:filtered.provenance},error:null};
 }catch(error){return {error:{code:'22023',message:'Source lead retrieval failed: '+(error instanceof Error?error.message:'unavailable')}};}
}

export async function readSearchFilterPlan(call:Call,payload:Payload,{execute=executeCareerTask}={}) {
 const context=await call('search.context',{profileId:payload.profileId});if(context.error)return context;
 const profile=context.data.documents?.find((d:Payload)=>d.kind==='profile'&&d.id===payload.profileId);
 if(!profile)return {error:{code:'P0002'}};
 try{
  const plan=await execute('inspect-discovery-filters',{profile:profile.projection,portals:context.data.documents.find((d:Payload)=>d.kind==='portals')?.projection||{}});
  const current=await call('search.context',{profileId:payload.profileId});if(current.error)return current;
  if(current.data.personalVersion!==context.data.personalVersion||current.data.documents?.find((d:Payload)=>d.kind==='profile'&&d.id===payload.profileId)?.version!==profile.version)return {error:{code:'40001'}};
  return {data:{...plan,profileId:profile.id,evaluatedProfileVersion:profile.version,personalVersion:context.data.personalVersion},error:null};
 }catch(error){return {error:{code:'22023',message:'Invalid discovery filters: '+(error instanceof Error?error.message:'unavailable')}};}
}
