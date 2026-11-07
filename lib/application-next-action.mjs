import {currentTimelineItems,timelineDate,hasTerminalOutcome} from './application-timeline.mjs';

const roundKinds=new Set(['recruiter_call','phone_screen','technical_round','interview','onsite']);

// A stored scheduled round or confirmed, unfinished prep deadline is an action
// date. Inbox available_at is a notification delay, never an employer deadline.
/** @param {any} application
 * @param {any} preparation
 * @returns {{date:string,label:string,source:string}|null} */
export function applicationNextAction(application={},preparation=null) {
 if(application.archived||hasTerminalOutcome(application)||['closed','rejected','withdrawn'].includes(String(application.status).toLowerCase()))return null;
 const imported=application.imported?.record;
 if(imported){const date=timelineDate(imported.actionDate);return imported.nextAction?.trim()&&date?{date,label:imported.nextAction,source:'imported'}:null;}
 const events=currentTimelineItems(application);
 const scheduled=events.filter(event=>roundKinds.has(event.kind)&&event.phase==='scheduled'&&event.occurred_at)
  .map(event=>({date:event.occurred_at,label:event.label,source:'round'}));
 const plan=preparation?.plan||preparation;
 const deadline=plan?.deadline;
 const date=timelineDate(deadline?.date);
 // Once a round has been recorded for this stage, it owns its date/lifecycle.
 // An old prep deadline must not resurrect a completed or rescheduled round.
 const hasRound=scheduled.length>0||events.some(event=>roundKinds.has(event.kind)&&(event.label.trim().toLowerCase()===String(deadline?.stage||'').trim().toLowerCase()||(date&&event.occurred_at&&Date.parse(event.occurred_at)>=Date.parse(date))));
 if(plan&&[application.id,application.backendId].filter(Boolean).includes(plan.applicationId)&&!hasRound&&deadline?.status==='confirmed'&&date&&plan.tasks?.some(task=>!task.completed)){
  scheduled.push({date,label:deadline.stage||'Preparation deadline',source:'preparation'});
 }
 return scheduled.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))[0]||null;
}

// Caller supplies the existing default order; equal/unknown dates preserve it.
export function sortByNextAction(applications=[],plans={}) {
 return applications.map((application,index)=>({application,index,next:applicationNextAction(application,plans[application.backendId]||plans[application.id])}))
  .sort((a,b)=>{
   if(!a.next||!b.next)return Number(!a.next)-Number(!b.next)||a.index-b.index;
   return Date.parse(a.next.date)-Date.parse(b.next.date)||a.index-b.index;
  }).map(row=>row.application);
}
