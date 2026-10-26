import {executeCareerTask} from '../runner/career-tools.mjs';
// Only translate storage fields. Identity/URL/title decisions stay in the
// original scanner and tracker, inside the existing credential-free child.
export function discoveryDedupRow(row){return {id:row.id,url:row.canonical_url||row.url,company:row.company,title:row.title,location:row.location??null,identity:row.identity||row.atsIdentity,requisitionId:row.requisition_id??row.requisitionId,...(row.listingIdentity?{listingIdentity:row.listingIdentity}:{})};}
/** @typedef {{retainedListingIds:string[],duplicateListingIds:string[],comparedPreviousListingIds:string[],inputCount:number,historyScope:'explicit-listing-ids',provenance:{commit:string,identity:string,dedup:string}}} DiscoveryDedupResult */
export async function deduplicateDiscoveryRows(jobs,previous=[],{execute=executeCareerTask}={}){
 const kept=await execute('dedup-discovery',{jobs:jobs.map(discoveryDedupRow),previous:previous.map(discoveryDedupRow)});
 const ids=jobs.map(row=>row.id);
 if(!Array.isArray(kept)||kept.some(row=>!row||!ids.includes(row.id))||new Set(kept.map(row=>row.id)).size!==kept.length)throw Error('Malformed copied deduplication result.');
 const retained=new Set(kept.map(row=>row.id));
 return {retainedListingIds:ids.filter(id=>retained.has(id)),duplicateListingIds:ids.filter(id=>!retained.has(id)),comparedPreviousListingIds:previous.map(row=>row.id),inputCount:jobs.length,historyScope:'explicit-listing-ids',provenance:{commit:'c78e14cdfd52f18a92e4a67694efab7ddef59385',identity:'scan.mjs isOfferSeen/markOfferSeen',dedup:'dedup-tracker.mjs'}};
}
