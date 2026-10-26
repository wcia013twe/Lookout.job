import {executeCareerTask} from '../runner/career-tools.mjs';
import {validateDedup} from '../supabase/functions/agent-gateway/search-dedup.mjs';
// Only translate storage fields. Identity/URL/title decisions stay in the
// original scanner and tracker, inside the existing credential-free child.
export function discoveryDedupRow(row){return {id:row.id,url:row.canonical_url||row.url,company:row.company,title:row.title,location:row.location??null,identity:row.identity||row.atsIdentity,requisitionId:row.requisition_id??row.requisitionId,...(row.listingIdentity?{listingIdentity:row.listingIdentity}:{})};}
/** @typedef {{retainedListingIds:string[],duplicateListingIds:string[],comparedPreviousListingIds:string[],inputCount:number,historyScope:'explicit-listing-ids',provenance:{commit:string,identity:string,dedup:string}}} DiscoveryDedupResult */
export async function deduplicateSearchDiscoveries(dispatch,request,{execute=executeCareerTask}={}){
 const call=async(op,payload)=>{const r=await dispatch(op,payload);if(r.error)throw r.error;return r.data;};
 try{
  validateDedup('search.discoveries.deduplicate',request);
  await call('search.run.read',{runId:request.runId});
  const read=async(ids,runId)=>{
   const wanted=new Set(ids),found=new Map();
   for(let offset=0;found.size<wanted.size;){
    const page=await call('search.discoveries.read',{...(runId?{runId}:{}),offset,limit:100});
    for(const row of page.listings||[])if(wanted.has(row.id))found.set(row.id,row);
    if(page.nextOffset===null)break;
    if(!Number.isSafeInteger(page.nextOffset)||page.nextOffset<=offset||page.nextOffset>5000)throw {code:'22023',message:'Deduplication history exceeded bounded pagination; narrow the selection.'};
    offset=page.nextOffset;
   }
   if(found.size!==wanted.size)throw {code:'P0002',message:'Owned discovery selection not found.'};
   return ids.map(id=>discoveryDedupRow(found.get(id)));
  };
  const jobs=await read(request.listingIds,request.runId),previous=await read(request.previousListingIds||[]);
  const kept=await execute('dedup-discovery',{jobs,previous});
  if(!Array.isArray(kept)||kept.some(row=>!row||!request.listingIds.includes(row.id))||new Set(kept.map(row=>row.id)).size!==kept.length)throw Error('Malformed copied deduplication result.');
  const retained=new Set(kept.map(row=>row.id));
  /** @type {DiscoveryDedupResult} */
  const data={retainedListingIds:request.listingIds.filter(id=>retained.has(id)),duplicateListingIds:request.listingIds.filter(id=>!retained.has(id)),comparedPreviousListingIds:request.previousListingIds||[],inputCount:jobs.length,historyScope:'explicit-listing-ids',provenance:{commit:'c78e14cdfd52f18a92e4a67694efab7ddef59385',identity:'scan.mjs isOfferSeen/markOfferSeen',dedup:'dedup-tracker.mjs'}};
  return {data,error:null};
 }catch(error){return {error:error?.code?error:{code:'22023',message:'Discovery deduplication failed; no records were changed.'}};}
}
