import {resolveProvider} from '../../runner/vendor/career-ops/providers/_registry.mjs';
import {hiringCafeSource,readHiringCafeLeads} from './hiringcafe.ts';
import {jobrightFeed,readJobrightLeads} from './jobright.ts';
import {simplifyFeed,readSimplifyLeads} from './simplify.ts';
import type {Payload} from './types.ts';
import type {Execute,SourceResult} from './ats.ts';

export interface CollectedSource {
 jobs:Payload[];total:number;examined:number;coverage:SourceResult['coverage'];
 blocker:string;diagnostics?:SourceResult['diagnostics'];provenance?:Payload;
}
interface ProviderContext {sourceId:string;profile:Payload;days:number;request:typeof fetch;execute:Execute;prefilter?:boolean|Payload}
// Use Career Ops' {id, detect, fetch} provider pattern and resolver. Collection
// implementations return leads only; none verifies, screens, or writes records.
export const sourceProviders=new Map([
 ['hiringcafe',{
  id:'hiringcafe',detect:(source:Payload)=>hiringCafeSource(source.careers_url),
  async fetch(source:Payload,{profile,days,request}:ProviderContext):Promise<CollectedSource>{
   const page=await readHiringCafeLeads(source,{profile,days,request});
   return {jobs:page.leads,total:page.total,examined:page.examined,coverage:'truncated',
    blocker:'HiringCafe public MCP returns a limited result set without a pagination cursor; rounded freshness is not an exact posting-date filter. '+(page.diagnostics.length?'Some employer links remain unresolved. ':''),
    diagnostics:page.diagnostics,provenance:{provider:'hiringcafe',aggregate:'HiringCafe public MCP',endpoint:page.endpoint,queries:page.queries,omittedQueries:page.omittedQueries}};
  },
 }],
 ['simplify',{
  id:'simplify',detect:(source:Payload)=>Boolean(simplifyFeed(source.careers_url)),
  async fetch(source:Payload,{request}:ProviderContext):Promise<CollectedSource>{
   const page=await readSimplifyLeads(source.careers_url,{limit:null,request});
   return {jobs:page.leads,total:page.total,examined:page.leads.length,coverage:page.nextOffset===null?'exhaustive':'truncated',blocker:page.nextOffset===null?'':'Simplify feed collection is incomplete.',provenance:{provider:'simplify',aggregate:'official Simplify structured JSON'}};
  },
 }],
 ['jobright',{
  id:'jobright',detect:(source:Payload)=>Boolean(jobrightFeed(source.careers_url)),
  async fetch(source:Payload,{request,execute,profile,prefilter}:ProviderContext):Promise<CollectedSource>{
   const page=await readJobrightLeads(source.careers_url,{request,select:prefilter?rows=>execute('prefilter-discovery',{profile,jobs:rows,config:prefilter===true?undefined:prefilter}):undefined});
   return {jobs:page.leads,total:page.total,examined:page.examined,coverage:'truncated',
    blocker:'Jobright public lists cover only a subset of jobs from the last seven days. '+(page.diagnostics.length?'Some public employer application links could not be resolved.':''),
    diagnostics:page.diagnostics,provenance:{provider:'jobright',aggregate:'official Jobright GitHub README',prefilterExcluded:page.prefilterExcluded}};
  },
 }],
 ['careerops',{
  id:'careerops',detect:()=>true,
  async fetch(source:Payload,{sourceId,execute}:ProviderContext):Promise<CollectedSource>{
   const result=await execute('discovery',{collectOnly:true,target:{id:sourceId,name:source.name||sourceId,address:source.careers_url},config:{...(source.config||{}),...(source.provider?{provider:source.provider}:{}),...(source.api?{api:source.api}:{})}});
   return {jobs:result.jobs||[],total:result.available||0,examined:result.jobs?.length||0,coverage:result.status!=='ok'?'inaccessible':result.truncated?'truncated':'exhaustive',blocker:result.status!=='ok'?'Source needs agent research or a supported copied CareerOps connector.':result.truncated?'Career Ops provider reported incomplete pagination. ':'',provenance:result.provenance};
  },
 }],
]);
export async function collectSource(sourceId:string,source:Payload,options:Omit<ProviderContext,'sourceId'>):Promise<CollectedSource>{
 // Saved employer provider hints belong to the inner copied registry. Route
 // outer aggregate collection by address so existing configurations still work.
 const resolved=resolveProvider({careers_url:source.careers_url},sourceProviders);
 if(!resolved?.provider)throw Error('No source collection provider');
 return resolved.provider.fetch(source,{...options,sourceId});
}
