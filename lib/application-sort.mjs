import {currentTimelineItems,timelineDate} from './application-timeline.mjs';
import {trackerProgress} from './tracker-display.mjs';

// Match the tracker's application date; a future interview is not an application date.
export function applicationSortDate(application, trackerItem = {}) {
 const imported=application.imported?.record;
 const submission=currentTimelineItems(application).find(event=>event.kind==='application_submitted'&&timelineDate(event.occurred_at));
 const candidates=[trackerItem.appliedDate,application.trackerItem?.appliedDate,imported?.appliedDate,application.submitted_at,application.submittedAt,submission?.occurred_at,trackerItem.openedDate,application.trackerItem?.openedDate];
 return candidates.map(timelineDate).find(Boolean)||null;
}
export function sortActiveApplications(applications=[],trackerItems={}) {
 return applications.map((application,index)=>{
  const item=trackerItems[application.id]||{};
  const progress=trackerProgress(application,item);
  const advanced=progress.level>=2&&!['Rejected','Withdrawn','Closed'].includes(progress.status);
  const date=applicationSortDate(application,item);
  return {application,index,advanced,time:date?Date.parse(date):-Infinity};
 }).sort((a,b)=>Number(b.advanced)-Number(a.advanced)||(a.time===b.time?0:b.time-a.time)||a.index-b.index).map(row=>row.application);
}
