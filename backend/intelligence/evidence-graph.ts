// Explicit evidence expansion only. The caller owns authentication, current-source
// validation and Circle identity checks; a stored pointer never grants access.
import {isIP} from 'node:net';
import {publicContextUrl} from '../../supabase/functions/agent-gateway/context-attachments.mjs';
import type {PostReference,ResourceLink} from './types.ts';

export const GRAPH_TOOL='expand_demo_intelligence_evidence';
const MAX_EDGES=50,MAX_LOOKUPS=100;
const sourceTypes=['circle_post','application_update'] as const;
export type GraphSourceKey={sourceType:typeof sourceTypes[number];sourceId:string};
export type GraphOptions={maxDepth?:1|2;maxNodes?:number};
export type GraphReport={
 source_type:typeof sourceTypes[number];source_id:string;source_revision:number;
 title?:string|null;insight:string;company?:string|null;role?:string|null;stage?:string|null;
 experience_date?:string|null;provenance?:string|null;uncertainty?:string|null;
 post_references?:PostReference[];resource_links?:ResourceLink[];
};
export type GraphPostResolver=(reference:PostReference)=>Promise<GraphReport|null>;
export const GRAPH_TOOL_DESCRIPTOR={
 name:GRAPH_TOOL,
 description:'Expand explicitly attached post/resource evidence from currently permitted local reports. Follows at most two hops, preserving source revisions and uncertainty. Does not infer recommendations, fetch URLs, grant sharing access or generate an answer.',
 inputSchema:{type:'object',properties:{
  seeds:{type:'array',minItems:1,maxItems:10,items:{type:'object',properties:{sourceType:{type:'string',enum:sourceTypes},sourceId:{type:'string',minLength:1,maxLength:200}},required:['sourceType','sourceId'],additionalProperties:false}},
  maxDepth:{type:'integer',minimum:1,maximum:2},maxNodes:{type:'integer',minimum:1,maximum:30},
 },required:['seeds'],additionalProperties:false},
} as const;
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[a-zA-Z0-9:_-]{1,200}$/.test(id);
function options(value:GraphOptions){
 const maxDepth=value.maxDepth===undefined?1:value.maxDepth,maxNodes=value.maxNodes===undefined?30:value.maxNodes;
 if(!Number.isInteger(maxDepth)||maxDepth<1||maxDepth>2)throw Error('INVALID_GRAPH_DEPTH');
 if(!Number.isInteger(maxNodes)||maxNodes<1||maxNodes>30)throw Error('INVALID_GRAPH_LIMIT');
 return {maxDepth,maxNodes};
}
export function validateGraphArgs(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_ARGUMENT');
 const args=value as Record<string,unknown>;
 if(Object.keys(args).some(k=>!['seeds','maxDepth','maxNodes'].includes(k)))throw Error('UNKNOWN_ARGUMENT');
 if(!Array.isArray(args.seeds)||args.seeds.length<1||args.seeds.length>10)throw Error('INVALID_GRAPH_SEEDS');
 const seeds:GraphSourceKey[]=args.seeds.map(seed=>{
  if(!seed||typeof seed!=='object'||Array.isArray(seed)||Object.keys(seed).some(k=>!['sourceType','sourceId'].includes(k))||!sourceTypes.includes(seed.sourceType)||!validId(seed.sourceId))throw Error('INVALID_GRAPH_SEEDS');
  return {sourceType:seed.sourceType,sourceId:seed.sourceId};
 });
 if(new Set(seeds.map(s=>JSON.stringify([s.sourceType,s.sourceId]))).size!==seeds.length)throw Error('DUPLICATE_GRAPH_SEED');
 return {seeds,...options(args as GraphOptions)};
}
function reportKey(report:GraphReport){return `report:${report.source_type}:${report.source_id}`;}
function validReport(report:GraphReport){
 if(!sourceTypes.includes(report.source_type)||!validId(report.source_id)||!Number.isSafeInteger(report.source_revision)||report.source_revision<1||typeof report.insight!=='string')throw Error('INVALID_GRAPH_REPORT');
 if(report.post_references!==undefined&&(!Array.isArray(report.post_references)||report.post_references.length>32))throw Error('INVALID_GRAPH_REPORT');
 if(report.resource_links!==undefined&&(!Array.isArray(report.resource_links)||report.resource_links.length>32))throw Error('INVALID_GRAPH_REPORT');
}
function reportNode(r:GraphReport){
 // Deliberate allowlist: never serialize raw references, embeddings, internal IDs,
 // owner metadata or arbitrary resolver properties into the evidence packet.
 return {id:reportKey(r),kind:'report' as const,sourceType:r.source_type,sourceId:r.source_id,sourceRevision:r.source_revision,
  title:r.title??null,insight:r.insight,company:r.company??null,role:r.role??null,stage:r.stage??null,
  experienceDate:r.experience_date??null,provenance:r.provenance??null,uncertainty:r.uncertainty??null};
}
function referenceValid(ref:PostReference){
 return ref&&validId(ref.circleId)&&validId(ref.postId)&&(ref.revision===null||Number.isSafeInteger(ref.revision)&&ref.revision>0)&&typeof ref.label==='string';
}
function resourceUrl(raw:unknown):string|null{
 if(typeof raw!=='string'||!publicContextUrl(raw))return null;
 try{
  const url=new URL(raw),host=url.hostname.replace(/^\[|\]$/g,'');
  if(isIP(host)||!host.includes('.')||host.endsWith('.localhost')||host.endsWith('.local'))return null;
  for(const key of url.searchParams.keys())if(/^(?:token|access_token|auth|authorization|apikey|api_key|key|signature|sig|code|email|credential|policy|expires|awsaccesskeyid)$|^x-amz-/i.test(key))return null;
  return url.href;
 }catch{return null;}
}
type ReportNode=ReturnType<typeof reportNode>;
type ResourceNode={id:string;kind:'resource';url:string;label:string};
type Edge={from:string;to:string;kind:'references_post'|'attached_resource';label:string;evidence:{sourceType:GraphReport['source_type'];sourceId:string;sourceRevision:number}};

export async function expandEvidenceGraph(seeds:GraphReport[],resolvePostReference:GraphPostResolver,requested:GraphOptions={}){
 if(!Array.isArray(seeds)||seeds.length>10)throw Error('INVALID_GRAPH_SEEDS');
 const {maxDepth,maxNodes}=options(requested);
 const nodes=new Map<string,ReportNode|ResourceNode>(),edges:Edge[]=[],edgeKeys=new Set<string>();
 const queue:{report:GraphReport;depth:number}[]=[];
 const truncated={depth:false,nodes:false,edges:false,lookups:false};
 const resolved=new Map<string,GraphReport|null>();let lookups=0;
 const addReport=(r:GraphReport,depth:number)=>{
  validReport(r);const key=reportKey(r),existing=nodes.get(key);
  if(existing){if(existing.kind!=='report'||existing.sourceRevision!==r.source_revision)throw Error('SOURCE_CHANGED_DURING_GRAPH');return key;}
  if(nodes.size>=maxNodes){truncated.nodes=true;return null;}
  nodes.set(key,reportNode(r));queue.push({report:r,depth});return key;
 };
 const addEdge=(r:GraphReport,to:string,kind:Edge['kind'],label:string)=>{
  const from=reportKey(r),key=JSON.stringify([from,to,kind]);
  if(edgeKeys.has(key))return;
  edges.push({from,to,kind,label,evidence:{sourceType:r.source_type,sourceId:r.source_id,sourceRevision:r.source_revision}});edgeKeys.add(key);
 };
 for(const seed of seeds)addReport(seed,0);
 for(let index=0;index<queue.length;index++){
  const {report:r,depth}=queue[index],resources=r.resource_links??[],references=r.post_references??[];
  if(depth>=maxDepth){if(resources.length||references.length)truncated.depth=true;continue;}
  for(const link of resources){
   const url=resourceUrl(link?.url);if(!url||typeof link.label!=='string')continue;
   const id=`resource:${url}`,key=JSON.stringify([reportKey(r),id,'attached_resource']);
   if(edgeKeys.has(key))continue;
   if(edges.length>=MAX_EDGES){truncated.edges=true;break;}
   if(!nodes.has(id)){if(nodes.size>=maxNodes){truncated.nodes=true;continue;}nodes.set(id,{id,kind:'resource',url,label:link.label});}
   addEdge(r,id,'attached_resource',link.label);
  }
  for(const ref of references){
   if(!referenceValid(ref))continue;
   if(edges.length>=MAX_EDGES){truncated.edges=true;break;}
   const cacheKey=JSON.stringify([ref.circleId,ref.postId,ref.revision]);
   let target:GraphReport|null;
   if(resolved.has(cacheKey))target=resolved.get(cacheKey)!;
   else{
    if(lookups>=MAX_LOOKUPS){truncated.lookups=true;break;}
    lookups++;target=await resolvePostReference({...ref});resolved.set(cacheKey,target);
   }
   // Null encompasses unavailable, private, withdrawn and mismatched Circle targets.
   // Do not expose IDs, labels or counts describing rejected references.
   if(!target)continue;
   validReport(target);
   if(target.source_type!=='circle_post'||target.source_id!==ref.postId||ref.revision!==null&&target.source_revision!==ref.revision)continue;
   const id=addReport(target,depth+1);if(!id)continue;
   addEdge(r,id,'references_post',ref.label);
  }
 }
 return {nodes:[...nodes.values()],edges,truncated};
}
