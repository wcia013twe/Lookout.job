const ids={type:'array',maxItems:100,uniqueItems:true,items:{type:'string',format:'uuid'}};
export const DEDUP_TOOLS=[{name:'deduplicate_search_discoveries',operation:'search.discoveries.deduplicate',scope:'workspace:read',readOnly:true,
 description:'After screening, deduplicate up to 100 owned run discovery IDs using the directly copied Career Ops scanner identity functions and dedup-tracker CLI. Supply previousListingIds for explicitly selected owned listings already evaluated/reported, including prior runs; an empty history only deduplicates this input. Returns retained/duplicate IDs in input order. Does not delete records, modify application statuses, assess report freshness, score or publish. Distinct posting URLs/requisitions are preserved under upstream rules. Node MCP required.',
 inputSchema:{type:'object',additionalProperties:false,required:['runId','listingIds'],properties:{runId:{type:'string',format:'uuid'},listingIds:{...ids,minItems:1},previousListingIds:ids}}}];
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function validateDedup(operation,p){
 if(operation!=='search.discoveries.deduplicate')return false;
 const valid=(v,min)=>Array.isArray(v)&&v.length>=min&&v.length<=100&&new Set(v).size===v.length&&v.every(id=>typeof id==='string'&&uuid.test(id));
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['runId','listingIds','previousListingIds'].includes(k))||typeof p.runId!=='string'||!uuid.test(p.runId)||!valid(p.listingIds,1)||p.previousListingIds!==undefined&&!valid(p.previousListingIds,0))throw Error('Owned run, 1–100 unique discovery IDs and up to 100 explicit previous listing IDs required.');
 return true;
}
