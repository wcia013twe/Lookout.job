import {executeCareerTask} from '../../runner/career-tools.mjs';
import type {Payload} from './types.ts';
export interface Listing {sourceId:string;url:string;company:string;title:string;location:string|null;checkedAt:string;liveness:'active';evidence:string;employerPostedAt:string|null;sourceListAgeDays:null;description:string;atsIdentity?:string;requisitionId?:string;listingIdentity?:Payload}
export interface SourceResult {listings:Listing[];coverage:'exhaustive'|'truncated'|'inaccessible';blocker:string;total:number;provenance?:Payload}
export type Execute=(task:string,input:Payload)=>Promise<any>;
// Public identity metadata only enters the existing sanitized CareerOps child.
// No provider, URL normalization or deduplication implementation lives here.
export async function fetchSource(sourceId:string,source:Payload,{execute=executeCareerTask,previous=[]}: {execute?:Execute;previous?:Payload[]}={}):Promise<SourceResult>{
 try{
  const result=await execute('discovery',{target:{id:sourceId,name:source.name||sourceId,address:source.careers_url},config:{...(source.provider?{provider:source.provider}:{}),...(source.api?{api:source.api}:{})},previous});
  if(result.status!=='ok')return {listings:[],coverage:'inaccessible',blocker:'Source needs agent research or a supported copied CareerOps connector.',total:0,provenance:result.provenance};
  const observed=new Date().toISOString();
  const listings=result.jobs.map((row:Payload)=>({sourceId,url:row.url,company:row.company,title:row.title,location:row.location||null,checkedAt:observed,liveness:'active',evidence:`Published posting returned by copied CareerOps ${result.provider} provider. Description is an upstream bounded excerpt.`,employerPostedAt:result.provider==='greenhouse'&&row.postedAt?row.postedAt:null,sourceListAgeDays:null,description:row.description||'',...(row.listingIdentity?{atsIdentity:[row.listingIdentity.ats_provider,row.listingIdentity.board_slug,row.listingIdentity.posting_id].join(':')}:{}),...(row.requisitionId?{requisitionId:row.requisitionId}:{})}));
  return {listings,coverage:result.truncated?'truncated':'exhaustive',blocker:result.truncated?'Copied provider output reached the bounded result limit.':'',total:result.available,provenance:result.provenance};
 }catch{return {listings:[],coverage:'inaccessible',blocker:'Copied CareerOps provider failed or exceeded isolated execution limits; use agent research or retry.',total:0};}
}
export async function deduplicate(listings:Payload[],previous:Payload[]=[],execute:Execute=executeCareerTask){return execute('dedup-discovery',{jobs:listings,previous});}
