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
 if(response==='save')return 'Changes saved. Review the new application revision before approving.';
 if(response==='review')return 'Review recorded for this exact version.';
 if(response==='resume')return 'Agent work resumed. The declined approval was not restored.';
 if(['prepared_application','resolve_blocker'].includes(item.kind))return response==='accept'?'Answers saved. The updated application is ready for review.':'Application saved. Agent work stopped until you resume it.';
 if(item.kind==='imported_action')return response==='accept'?'Next action marked done.':'Next action dismissed.';
 if(['check_submission','submit_application'].includes(item.kind))return response==='accept'?'Your submission report was saved. It is not an observed submission receipt.':item.kind==='submit_application'?'Application saved. Agent work stopped until you resume it.':'Verified not submitted. The application can be prepared again.';
 if(item.kind==='missing_answer')return response==='accept'?'Answer saved with your reuse permission.':'Question declined. No answer was invented.';
 if(item.kind==='review_application')return response==='accept'?'This version is approved. It has not been submitted.':'Application saved. Agent work stopped until you resume it.';
 if(item.kind==='review_outreach')return response==='accept'?'Ready for you to send. Nothing was sent.':'Message declined. No further work on this draft.';
 if(item.kind==='verify_answer')return response==='accept'?'Answer verified with your chosen reuse permission.':'Answer remains unverified.';
 return response==='accept'?'Interview details confirmed. Weekly prep is updated.':'Details marked incorrect. Open the round to correct them.';
}

// Match only the requested owned identity, including imported tracker records.
export function matchesBoardApplication(application,requested) {
 return !!requested&&(application.backendId===requested||application.id===requested&&requested.startsWith('import:'));
}

// Presentation derives from owned decision types and fields, never generated labels.
export function isFilledApplication(item) {
 return ['review_application','prepared_application'].includes(item.kind) &&
  (item.questions || []).every(q => q.required === false || q.fieldType === 'hidden' ||
   (typeof q.answer === 'string' && !!q.answer.trim() && q.answer.trim().toLowerCase() !== 'ask me'));
}
export function needsUnblocking(item) {
 return ['resolve_blocker','missing_answer','check_submission'].includes(item.kind) ||
  (['review_application','prepared_application'].includes(item.kind) && !isFilledApplication(item));
}
// Stable partition preserves backend chronology within both groups; never mutates snapshots.
export function orderBoardItems(items) {
 return [...items.filter(isFilledApplication), ...items.filter(item => !isFilledApplication(item))];
}
