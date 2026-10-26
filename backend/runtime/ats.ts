import {readSimplifyLeads,simplifyFeed} from './simplify.ts';
import {executeCareerTask} from '../../runner/career-tools.mjs';
import type {Payload} from './types.ts';
export interface Listing {sourceId:string;url:string;company:string;title:string;location:string|null;checkedAt:string;liveness:'active';evidence:string;employerPostedAt:string|null;sourceListAgeDays:number|null;description:string;atsIdentity?:string;requisitionId?:string;listingIdentity?:Payload;employmentType?:string}
export interface SourceResult {listings:Listing[];coverage:'exhaustive'|'truncated'|'inaccessible';blocker:string;total:number;provenance?:Payload;diagnostics?:{url:string;status:string;reason:string}[]}
export type Execute=(task:string,input:Payload)=>Promise<any>;
// Public identity metadata only enters the existing sanitized CareerOps child.
// No provider, URL normalization or deduplication implementation lives here.
export async function fetchSource(sourceId:string,source:Payload,{execute=executeCareerTask,previous=[]}: {execute?:Execute;previous?:Payload[]}={}):Promise<SourceResult>{
 try{
  if(simplifyFeed(source.careers_url)){
   const page=await readSimplifyLeads(source.careers_url,{limit:25});
   const unique=await deduplicate(page.leads,previous,execute);
   const checked=await verifyLeadSource(sourceId,unique.map((lead:Payload)=>({url:lead.url})),{execute});
   const active=unique.filter((_lead:Payload,index:number)=>checked.diagnostics?.[index]?.status==='active');
   checked.listings=checked.listings.map((row:Listing,index:number)=>({...row,sourceListAgeDays:active[index]?.sourceListAgeDays??null,employmentType:active[index]?.employmentType||row.employmentType}));
   return {...checked,provenance:{...checked.provenance,aggregate:'official Simplify structured JSON',dedup:'dedup-tracker.mjs',identity:'scan.mjs isOfferSeen/markOfferSeen'},total:page.total,coverage:page.nextOffset!==null?'truncated':checked.coverage,blocker:page.nextOffset!==null?`Bounded aggregate sample; ${page.total} active source leads, next source offset ${page.nextOffset}. Agent can page remaining leads through read_search_source_leads. ${checked.blocker}`:checked.blocker};
  }
  const result=await execute('discovery',{target:{id:sourceId,name:source.name||sourceId,address:source.careers_url},config:{...(source.provider?{provider:source.provider}:{}),...(source.api?{api:source.api}:{})},previous});
  if(result.status!=='ok')return {listings:[],coverage:'inaccessible',blocker:'Source needs agent research or a supported copied CareerOps connector.',total:0,provenance:result.provenance};
  const observed=new Date().toISOString();
  const listings=result.jobs.map((row:Payload)=>({sourceId,url:row.url,company:row.company,title:row.title,location:row.location||null,checkedAt:observed,liveness:'active',evidence:`Published posting returned by copied CareerOps ${result.provider} provider. Description is an upstream bounded excerpt.`,employerPostedAt:result.provider==='greenhouse'&&row.postedAt?row.postedAt:null,sourceListAgeDays:null,description:row.description||'',...(row.listingIdentity?{atsIdentity:[row.listingIdentity.ats_provider,row.listingIdentity.board_slug,row.listingIdentity.posting_id].join(':')}:{}),...(row.requisitionId?{requisitionId:row.requisitionId}:{})}));
  return {listings,coverage:result.truncated?'truncated':'exhaustive',blocker:result.truncated?'Copied provider output reached the bounded result limit.':'',total:result.available,provenance:result.provenance};
 }catch{return {listings:[],coverage:'inaccessible',blocker:'Copied CareerOps provider failed or exceeded isolated execution limits; use agent research or retry.',total:0};}
}
export async function deduplicate(listings:Payload[],previous:Payload[]=[],execute:Execute=executeCareerTask){return execute('dedup-discovery',{jobs:listings,previous});}

export async function verifyLeadSource(sourceId:string,leads:{url:string}[],{execute=executeCareerTask}:{execute?:Execute}={}):Promise<SourceResult>{
 const result=await execute('verify-discovery-leads',{leads});const checkedAt=new Date().toISOString();
 const listings=result.jobs.map((row:Payload)=>({sourceId,url:row.url,company:row.company,title:row.title,location:row.location||null,checkedAt,liveness:'active',evidence:'Exact official employer ATS posting verified and full JD parsed using copied CareerOps code.',employerPostedAt:row.postedAt||null,sourceListAgeDays:null,description:row.description,atsIdentity:[row.listingIdentity.ats_provider,row.listingIdentity.board_slug,row.listingIdentity.posting_id].join(':'),...(row.requisitionId?{requisitionId:row.requisitionId}:{}),...(row.employmentType?{employmentType:row.employmentType}:{})}));
 const complete=listings.length===leads.length;
 return {listings,coverage:complete?'exhaustive':listings.length?'truncated':'inaccessible',total:leads.length,blocker:complete?'':'Some leads were closed, unsupported or unverifiable; inspect diagnostics.',diagnostics:result.diagnostics,provenance:result.provenance};
}
