"use client";
import ApplyWorkFlag from './apply-work-flag';
import {applicationWorkFlag,applicationWorkLabel} from "../../lib/application-request-state.mjs";
import {matchesBoardApplication} from '../../lib/action-board.mjs';
import { useEffect, useState } from 'react';
import {applicationAction,nextActionTime} from '../../lib/action-inbox.mjs';
import { useWorkspace } from '../lib/workspace';
import {sortActiveApplications} from '../../lib/application-sort.mjs';
import { sortApplications } from '../../lib/application-timeline.mjs';
import { trackerProgress } from '../../lib/tracker-display.mjs';
import TrackerProgress,{ApplicationIdentity} from './tracker-progress';
import {importEmploymentTypes} from '../../lib/simplify-import.mjs';
import DraftReview from './draft-review';
import type {ImportUpdate} from './imported-application-tracking';
import {applicationNextAction,sortByNextAction} from '../../lib/application-next-action.mjs';
import ApplicationActionNotice from './application-action-notice';
import type {PreparationPlan} from './workflow-types';
import type { Application } from './workflow-types';
export default function ApplicationList({items,active=false,sortByAction=false,plans={},importVersion=0,onUpdateImport}:{items:Application[];active?:boolean;sortByAction?:boolean;plans?:Record<string,PreparationPlan>;importVersion?:number;onUpdateImport?:ImportUpdate}) {
 const w=useWorkspace(),[review,setReview]=useState<string|null>(null);
 const [now,setNow]=useState(()=>Date.now()),inbox=w.state.workflow.actionInbox||[];
 useEffect(()=>{
  const due=nextActionTime(inbox);
  if(due===null)return;
  const timer=setTimeout(()=>setNow(Date.now()),Math.min(2147483647,Math.max(0,due-Date.now()+1)));
  return ()=>clearTimeout(timer);
 },[inbox,now]);
 useEffect(()=>{const requested=new URL(location.href).searchParams.get('application');const owned=items.find(item=>matchesBoardApplication(item,requested));if(owned)setReview(owned.id);},[w.user?.id,items.map(item=>item.backendId||item.id).join(',')]);
 const defaultOrder=active?sortActiveApplications(items,w.state.tracker.items):sortApplications(items);
 const ordered=active&&sortByAction?sortByNextAction(defaultOrder,plans):defaultOrder;
 return <><ul className="tracker-list">{ordered.map((a:Application)=>{const action=applicationAction(a,inbox,Date.now()),item=w.state.tracker.items[a.id]||a.trackerItem||{},progress=trackerProgress(a,item),workLabel=applicationWorkLabel(a,item),next=['Rejected','Withdrawn','Closed'].includes(progress.status)?null:applicationNextAction(a,plans[a.backendId||a.id]),type=importEmploymentTypes[a.employmentType||'']||'Type not recorded',date=item.appliedDate||item.openedDate,dateLabel=date?`${item.appliedDate?'Applied':'Opened'} ${new Date(date).toLocaleDateString(undefined,{month:'short',day:'numeric',...(date.length===10?{timeZone:'UTC'}:{})})}`:'Date not recorded';return <li className="tracker-row glass-inset" key={a.id}>
 <button className="tracker-role" onClick={()=>setReview(a.id)} aria-label={`Open ${a.title} at ${a.company}`}><ApplicationIdentity company={a.company} title={a.title} location={a.location||type}><small className="tracker-mobile-meta"><span>{type}</span><span>{dateLabel}</span></small></ApplicationIdentity></button>
 <div className="tracker-row-progress"><TrackerProgress application={a} item={item}/>{!!progress.rounds&&<small>{progress.rounds} interview {progress.rounds===1?'step':'steps'} recorded</small>}</div>
 <button className="tracker-button tracker-row-status workspace-secondary inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={()=>setReview(a.id)} aria-label={`View ${a.title}: ${progress.status}`}>{progress.status}<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></button>
 <ApplicationActionNotice title={a.title} company={a.company} action={action} next={next} onOpen={()=>setReview(a.id)}/>
 {applicationWorkFlag(a,item)?<span className="tracker-workflow"><ApplyWorkFlag application={a} item={item}/></span>:workLabel&&<span className="tracker-workflow">AI Apply: {workLabel}</span>}
 {!action&&['Queued','Draft','Awaiting approval','Approved','Blocked'].includes(a.status)&&<span className="tracker-workflow">Preparation: {a.status}</span>}
 </li>;})}</ul>{review&&<DraftReview key={`${w.demo?'demo':w.user?.id||'guest'}:${review}`} id={review} application={items.find(a=>a.id===review&&a.imported)} importedTracker={onUpdateImport?{version:importVersion,update:onUpdateImport}:undefined} onClose={()=>setReview(null)}/>}</>;
}
