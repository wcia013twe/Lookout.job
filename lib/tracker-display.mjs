import {applicationRounds,applicationRoundLevel} from './application-rounds.mjs';
import {IMPORT_PROGRESS_STAGES} from './imported-actions.mjs';
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
 const events = timelineItems(application).filter(event=>!event.round?.cancelled);
 const terminalEvent = [...events].reverse().find(e=>['rejected','withdrawn'].includes(e.kind)&&e.phase!=='scheduled');
 const outcome = ['Rejected','Withdrawn','Closed'].includes(application.status) ? application.status : ['Rejected','Withdrawn','Closed'].includes(item.status) ? item.status : terminalEvent ? terminalEvent.kind === 'rejected' ? 'Rejected' : 'Withdrawn' : '';
 const eventLevel = event => event.round?.stage==='SCREEN'?2:event.round?.stage==='INTERVIEW'?3:event.id==='current-status'&&levels[application.status]!==undefined?levels[application.status]:event.kind === 'application_submitted' ? 1 : ['recruiter_call','phone_screen'].includes(event.kind) ? 2 : ['technical_round','interview','onsite'].includes(event.kind) ? 3 : event.kind === 'offer' ? 4 : 0;
 const level = Math.max(levels[application.status] ?? 0, levels[item.status] ?? 0, ...events.map(eventLevel),applicationRoundLevel(application));
 const rounds=applicationRounds(application);
 const stageRounds=index=>rounds.filter(round=>!round.cancelled&&round.stage===(index===2?'SCREEN':'INTERVIEW'));
 const completed=index=>index<level||(index===0&&Boolean(item.openedDate))||(index===1&&level>=1)||([2,3].includes(index)&&stageRounds(index).length?stageRounds(index).every(round=>round.phase==='completed'):application.imported?.record?.completedStages?.includes(IMPORT_PROGRESS_STAGES[index])||false);
 const dates = trackerStages.map((_, index) => index === 0 ? item.openedDate : index === 1 ? item.appliedDate || events.find(e=>eventLevel(e)===1)?.occurred_at : events.find(e=>eventLevel(e)===index)?.occurred_at);
 return {completed:trackerStages.map((_,index)=>completed(index)),level, status:outcome || trackerStages[level], dates, rounds:applicationRounds(application).filter(round=>round.stage==='INTERVIEW'&&!round.cancelled).length};
}
