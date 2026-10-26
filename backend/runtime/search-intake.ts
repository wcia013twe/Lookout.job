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
 const verified=await verify(payload.sourceId,payload.leads);
 const diagnostics=verified.diagnostics||[];
 return call('search.leads.commit',{request:payload,observations:verified.listings,diagnostics});
}

export async function readSearchSourceLeads(call:Call,payload:Payload){
 const result=await call('search.run.read',{runId:payload.runId});if(result.error)return result;
 const source=result.data?.sources?.find((s:Payload)=>s.source_id===payload.sourceId);
 if(!source)return {error:{code:'P0002',message:'Owned run source not found'}};
 const address=source.source?.careers_url;
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
