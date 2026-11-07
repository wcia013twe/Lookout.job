import {collectSource} from './source-providers.ts';
import {discoveryDedupRow} from '../../lib/search-dedup.mjs';
import {executeCareerTask} from '../../runner/career-tools.mjs';
import type {Payload} from './types.ts';
export interface Listing {sourceId:string;url:string;company:string;title:string;location:string|null;checkedAt:string;liveness:'active';evidence:string;employerPostedAt:string|null;sourceListAgeDays:number|null;description:string;atsIdentity?:string;requisitionId?:string;listingIdentity?:Payload;employmentType?:string}
export interface SourceResult {listings:Listing[];coverage:'exhaustive'|'truncated'|'inaccessible';blocker:string;total:number;examined?:number;provenance?:Payload;diagnostics?:{url:string;status:string;reason:string}[]}
export type Execute=(task:string,input:Payload,options?:{signal?:AbortSignal})=>Promise<any>;
export type VerificationBatch=(result:SourceResult,progress:{processed:number;batchIndex:number;available:number;examined:number})=>Promise<void>;
// Public identity metadata only enters the existing sanitized CareerOps child.
// No provider, URL normalization or deduplication implementation lives here.
export async function fetchSource(sourceId:string,source:Payload,{execute=executeCareerTask,previous=[],profile={},days=3,request=fetch,signal,onBatch}: {execute?:Execute;previous?:Payload[];profile?:Payload;days?:number;request?:typeof fetch;signal?:AbortSignal;onBatch?:VerificationBatch}={}):Promise<SourceResult>{
 let checkpointFailed=false;
 try{
  signal?.throwIfAborted();
  const collected=await collectSource(sourceId,source,{execute,profile,days,request});
  if(collected.coverage==='inaccessible')return {listings:[],coverage:'inaccessible',total:collected.total,examined:collected.examined,blocker:collected.blocker,diagnostics:collected.diagnostics,provenance:collected.provenance};
  const unique=collected.jobs.length?await deduplicate(collected.jobs,previous,execute):[];
  const checked=await verifySourceBatches(sourceId,unique,{execute,source,signal,onBatch:onBatch?async(result,progress)=>{try{await onBatch(result,{...progress,available:collected.total,examined:collected.examined});}catch(error){checkpointFailed=true;throw error;}}:undefined});
  return {...checked,total:collected.total,examined:collected.examined,
   coverage:collected.coverage==='exhaustive'?checked.coverage:'truncated',
   blocker:[collected.blocker,checked.blocker].filter(Boolean).join(' '),
   diagnostics:[...(collected.diagnostics||[]),...(checked.diagnostics||[])],
   provenance:{...collected.provenance,...checked.provenance,dedup:'dedup-tracker.mjs',identity:'scan.mjs isOfferSeen/markOfferSeen'}};
 }catch(error){if(checkpointFailed)throw error;signal?.throwIfAborted();return {listings:[],coverage:'inaccessible',blocker:'Source collection failed: '+(error instanceof Error?error.message:'provider unavailable'),total:0};}
}

export async function deduplicate(listings:Payload[],previous:Payload[]=[],execute:Execute=executeCareerTask){return execute('dedup-discovery',{jobs:listings,previous:previous.map(discoveryDedupRow)});}

// Provider pagination is upstream-owned; verification retains its 25-link call
// boundary while consuming every returned lead, including the final short batch.
export async function verifySourceBatches(sourceId:string,leads:{url:string;sourceListAgeDays?:number|null;employmentType?:string}[],options:{execute?:Execute;source?:Payload;signal?:AbortSignal;onBatch?:(result:SourceResult,progress:{processed:number;batchIndex:number})=>Promise<void>}={}):Promise<SourceResult>{
 const listings:Listing[]=[],diagnostics:NonNullable<SourceResult['diagnostics']>=[];
 let complete=true;const provenance:Payload={};
 for(let offset=0;offset<leads.length;offset+=25){
  options.signal?.throwIfAborted();
  const batch=leads.slice(offset,offset+25);let result:SourceResult;
  try{result=await verifyLeadSource(sourceId,batch,options);}
  catch{
   options.signal?.throwIfAborted();
   result={listings:[],coverage:'inaccessible',total:batch.length,blocker:'Verification batch failed or timed out.',diagnostics:batch.map(lead=>({url:lead.url,status:'uncertain',reason:'Verification batch failed or timed out; retry or inspect this posting.'}))};
  }
  listings.push(...result.listings);diagnostics.push(...(result.diagnostics||[]));
  Object.assign(provenance,result.provenance||{});if(result.coverage!=='exhaustive')complete=false;
  // Persistence failures propagate; never downgrade a rejected checkpoint into
  // an ordinary provider failure and continue collecting under stale authority.
  await options.onBatch?.(result,{processed:offset+batch.length,batchIndex:offset/25});

 }
 return {listings,diagnostics,provenance,total:leads.length,coverage:complete?'exhaustive':listings.length?'truncated':'inaccessible',blocker:complete?'':'Some postings could not be verified or parsed; inspect per-link diagnostics.'};
}

export async function verifyLeadSource(sourceId:string,leads:{url:string;sourceListAgeDays?:number|null;employmentType?:string}[],{execute=executeCareerTask,source}:{execute?:Execute;source?:Payload}={}):Promise<SourceResult>{
 const result=await execute('verify-discovery-leads',{leads:leads.map(({url})=>({url})),...(source?{source:{name:source.name,careers_url:source.careers_url}}:{})});const checkedAt=new Date().toISOString();
 const listings=result.jobs.map((row:Payload)=>({sourceId,url:row.url,company:row.company,title:row.title,location:row.location||null,checkedAt,liveness:'active',evidence:'Exact official employer ATS posting verified and full JD parsed using copied CareerOps code.'+(row.metadataSource==='matching-owned-board-and-official-posting'?' Employer attribution uses the matching configured board.':''),employerPostedAt:row.postedAt||null,sourceListAgeDays:leads.find(lead=>lead.url===(row.leadUrl||row.url))?.sourceListAgeDays??null,description:row.description,atsIdentity:[row.listingIdentity.ats_provider,row.listingIdentity.board_slug,row.listingIdentity.posting_id].join(':'),...(row.requisitionId?{requisitionId:row.requisitionId}:{}),...((row.employmentType||leads.find(lead=>lead.url===(row.leadUrl||row.url))?.employmentType)?{employmentType:row.employmentType||leads.find(lead=>lead.url===(row.leadUrl||row.url))?.employmentType}:{})}));
 const complete=listings.length===leads.length||(result.diagnostics?.length===leads.length&&result.diagnostics.every((d:Payload)=>d.status==='expired'||d.status==='active'&&d.extraction==='parsed'));
 return {listings,coverage:complete?'exhaustive':listings.length?'truncated':'inaccessible',total:leads.length,blocker:complete?'':'Some links remain uncertain or active descriptions could not be extracted; inspect per-link liveness and extraction diagnostics.',diagnostics:result.diagnostics,provenance:result.provenance};
}
