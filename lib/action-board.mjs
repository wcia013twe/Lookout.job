// Source keys and links come from the owned backend projection, never title matching.
export const decisionTitle = item => ({review_application:'Review an application',prepared_application:'Review a filled application',submit_application:'Continue an approved application',imported_action:'Application next action',resolve_blocker:'Answer a question or resolve a blocker',check_submission:'Check whether an application submitted',missing_answer:item.title || 'Answer a question',verify_answer:item.title || 'Verify an answer',confirm_interview:'Confirm interview details',review_outreach:'Review message'}[item.kind] || 'Human input needed');
export function swipeResponse({dx,dy,width,canAccept,canReject}) {
 if(Math.abs(dy)>Math.abs(dx)*0.65||Math.abs(dx)<Math.max(72,width*0.25))return null;
 return dx>0?(canAccept?'accept':null):(canReject?'reject':null);
}
export function safeBoardReturn(value) {
 if(typeof value!=='string'||!value.startsWith('/'))return null;
 try {const url=new URL(value,'https://lookout.invalid');return url.origin==='https://lookout.invalid'&&['/needs-you/','/'].includes(url.pathname)?url.pathname+url.search:null;}catch{return null;}
}
export function decisionFeedback(item,response) {
 if(response==='review')return 'Review recorded for this exact version.';
 if(response==='resume')return 'Agent work resumed. The declined approval was not restored.';
 if(item.kind==='review_application')return response==='accept'?'This version is approved. It has not been submitted.':'Application saved. Agent work stopped until you resume it.';
 if(item.kind==='review_outreach')return response==='accept'?'Ready for you to send. Nothing was sent.':'Message declined. No further work on this draft.';
 if(item.kind==='verify_answer')return response==='accept'?'Answer verified with your chosen reuse permission.':'Answer remains unverified.';
 return response==='accept'?'Interview details confirmed. Weekly prep is updated.':'Details marked incorrect. Open the round to correct them.';
}

// Match only the requested owned identity, including imported tracker records.
export function matchesBoardApplication(application,requested) {
 return !!requested&&(application.backendId===requested||application.id===requested&&requested.startsWith('import:'));
}
