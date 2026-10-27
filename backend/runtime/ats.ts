import {hiringCafeSource,readHiringCafeLeads} from './hiringcafe.ts';
import {readSimplifyLeads,simplifyFeed} from './simplify.ts';
import {executeCareerTask} from '../../runner/career-tools.mjs';
import type {Payload} from './types.ts';
export interface Listing {sourceId:string;url:string;company:string;title:string;location:string|null;checkedAt:string;liveness:'active';evidence:string;employerPostedAt:string|null;sourceListAgeDays:number|null;description:string;atsIdentity?:string;requisitionId?:string;listingIdentity?:Payload;employmentType?:string}
export interface SourceResult {listings:Listing[];coverage:'exhaustive'|'truncated'|'inaccessible';blocker:string;total:number;examined?:number;provenance?:Payload;diagnostics?:{url:string;status:string;reason:string}[]}
export type Execute=(task:string,input:Payload)=>Promise<any>;
// Public identity metadata only enters the existing sanitized CareerOps child.
// No provider, URL normalization or deduplication implementation lives here.
export async function fetchSource(sourceId:string,source:Payload,{execute=executeCareerTask,previous=[],profile={},days=3,request=fetch}: {execute?:Execute;previous?:Payload[];profile?:Payload;days?:number;request?:typeof fetch}={}):Promise<SourceResult>{
 try{
  if(hiringCafeSource(source.careers_url)){
   const page=await readHiringCafeLeads(source,{profile,days,request});
   const unique=await deduplicate(page.leads,previous,execute);
   const checked=unique.length?await verifyLeadSource(sourceId,unique,{execute}):{listings:[],diagnostics:[],blocker:'',provenance:{}};
   return {...checked,examined:page.examined,total:page.total,coverage:'truncated',blocker:'HiringCafe bounded per-company sample; rounded provider freshness is not an exact posting-date filter. '+(page.omittedQueries?'Some query combinations exceeded the four-query budget. ':'')+(page.diagnostics.length?'Some employer links remain unresolved; inspect diagnostics. ':'')+checked.blocker,diagnostics:[...page.diagnostics,...(checked.diagnostics||[])],provenance:{...checked.provenance,aggregate:'HiringCafe public MCP',endpoint:page.endpoint,queries:page.queries,omittedQueries:page.omittedQueries,dedup:'dedup-tracker.mjs'}};
  }
  if(simplifyFeed(source.careers_url)){
   const page=await readSimplifyLeads(source.careers_url,{limit:25});
   const unique=await deduplicate(page.leads,previous,execute);
   const checked=await verifyLeadSource(sourceId,unique,{execute});
   return {...checked,examined:page.leads.length,provenance:{...checked.provenance,aggregate:'official Simplify structured JSON',dedup:'dedup-tracker.mjs',identity:'scan.mjs isOfferSeen/markOfferSeen'},total:page.total,coverage:page.nextOffset!==null?'truncated':checked.coverage,blocker:page.nextOffset!==null?`Bounded aggregate sample; ${page.total} active source leads, next source offset ${page.nextOffset}. Agent can page remaining leads through read_search_source_leads. ${checked.blocker}`:checked.blocker};
  }
  const result=await execute('discovery',{limit:25,target:{id:sourceId,name:source.name||sourceId,address:source.careers_url},config:{...(source.provider?{provider:source.provider}:{}),...(source.api?{api:source.api}:{})},previous});
  if(result.status!=='ok')return {listings:[],coverage:'inaccessible',blocker:'Source needs agent research or a supported copied CareerOps connector.',total:0,provenance:result.provenance};
  const checked=await verifyLeadSource(sourceId,result.jobs.map((row:Payload)=>({url:row.url})),{execute});
  return {...checked,examined:result.jobs.length,total:result.available,coverage:result.truncated?'truncated':checked.coverage,blocker:result.truncated?'Copied provider output reached the bounded result limit. '+checked.blocker:checked.blocker,provenance:{...result.provenance,...checked.provenance}};
 }catch(error){return {listings:[],coverage:'inaccessible',blocker:hiringCafeSource(source.careers_url)?(error instanceof Error?error.message:'HiringCafe unavailable'):'Copied CareerOps provider failed or exceeded isolated execution limits; use agent research or retry.',total:0};}
}
export async function deduplicate(listings:Payload[],previous:Payload[]=[],execute:Execute=executeCareerTask){return execute('dedup-discovery',{jobs:listings,previous});}

export async function verifyLeadSource(sourceId:string,leads:{url:string;sourceListAgeDays?:number|null;employmentType?:string}[],{execute=executeCareerTask}:{execute?:Execute}={}):Promise<SourceResult>{
 const result=await execute('verify-discovery-leads',{leads:leads.map(({url})=>({url}))});const checkedAt=new Date().toISOString();
 const listings=result.jobs.map((row:Payload)=>({sourceId,url:row.url,company:row.company,title:row.title,location:row.location||null,checkedAt,liveness:'active',evidence:'Exact official employer ATS posting verified and full JD parsed using copied CareerOps code.',employerPostedAt:row.postedAt||null,sourceListAgeDays:leads.find(lead=>lead.url===(row.leadUrl||row.url))?.sourceListAgeDays??null,description:row.description,atsIdentity:[row.listingIdentity.ats_provider,row.listingIdentity.board_slug,row.listingIdentity.posting_id].join(':'),...(row.requisitionId?{requisitionId:row.requisitionId}:{}),...((row.employmentType||leads.find(lead=>lead.url===(row.leadUrl||row.url))?.employmentType)?{employmentType:row.employmentType||leads.find(lead=>lead.url===(row.leadUrl||row.url))?.employmentType}:{})}));
 const complete=listings.length===leads.length||(result.diagnostics?.length===leads.length&&result.diagnostics.every((d:Payload)=>d.status==='expired'||d.status==='active'&&d.extraction==='parsed'));
 return {listings,coverage:complete?'exhaustive':listings.length?'truncated':'inaccessible',total:leads.length,blocker:complete?'':'Some links remain uncertain or active descriptions could not be extracted; inspect per-link liveness and extraction diagnostics.',diagnostics:result.diagnostics,provenance:result.provenance};
}
