import { timelineItems } from './application-timeline.mjs';
export const trackerStages = ['Opened', 'Applied', 'Screen', 'Interview', 'Offer'];
export function sharedTrackerStage(stage) {
 const label=typeof stage==='string'?stage.trim():'';
 const aliases=[/^(opened|saved)$/i,/^(applied|submitted|application submitted)$/i,/^(screen|phone screen|phone interview|recruiter screen|recruiter call|oa)$/i,/^(interview|technical interview|technical round|final round|onsite|on-site|onsite interview|system design)(?:\s+\d+)?$/i,/^(offer|offered|offer received|offer accepted)$/i];
 const level=aliases.findIndex(pattern=>pattern.test(label));
 return {level,status:label,dates:[]};
}
const levels = {New:0,Opened:0,Queued:0,Draft:0,'Awaiting approval':0,Approved:0,Blocked:0,Applied:1,Submitted:1,OA:2,'Phone Screen':2,Interview:3,Onsite:3,Offer:4};
export function trackerProgress(application, item = {}) {
 const events = timelineItems(application);
 const terminalEvent = [...events].reverse().find(e=>['rejected','withdrawn'].includes(e.kind)&&e.phase!=='scheduled');
 const outcome = ['Rejected','Withdrawn'].includes(application.status) ? application.status : ['Rejected','Withdrawn'].includes(item.status) ? item.status : terminalEvent ? terminalEvent.kind === 'rejected' ? 'Rejected' : 'Withdrawn' : '';
 const eventLevel = event => event.kind === 'application_submitted' ? 1 : ['recruiter_call','phone_screen'].includes(event.kind) ? 2 : ['technical_round','interview','onsite'].includes(event.kind) ? 3 : event.kind === 'offer' ? 4 : 0;
 const level = Math.max(levels[application.status] ?? 0, levels[item.status] ?? 0, ...events.map(eventLevel));
 const dates = trackerStages.map((_, index) => index === 0 ? item.openedDate : index === 1 ? item.appliedDate || events.find(e=>eventLevel(e)===1)?.occurred_at : events.find(e=>eventLevel(e)===index)?.occurred_at);
 return {level, status:outcome || trackerStages[level], dates, rounds:timelineItems({}, application.milestones || []).filter(e=>['technical_round','interview','onsite'].includes(e.kind) && e.id !== 'current-status').length};
}
