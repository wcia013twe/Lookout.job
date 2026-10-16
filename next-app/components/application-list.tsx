"use client";
import { useEffect, useState } from 'react';
import { useWorkspace } from '../lib/workspace';
import { sortApplications } from '../../lib/application-timeline.mjs';
import { trackerProgress } from '../../lib/tracker-display.mjs';
import TrackerProgress,{ApplicationIdentity} from './tracker-progress';
import DraftReview from './draft-review';
import type { Application } from './workflow-types';
export default function ApplicationList({items}:{items:Application[]}) {
 const w=useWorkspace(),[review,setReview]=useState<string|null>(null);
 useEffect(()=>{const requested=new URL(location.href).searchParams.get('application');const owned=items.find(item=>item.backendId===requested);if(owned)setReview(owned.id);},[w.user?.id,items.map(item=>item.backendId).join(',')]);
 return <><ul className="tracker-list">{sortApplications(items).map((a:Application)=>{const item=w.state.tracker.items[a.id]||{},progress=trackerProgress(a,item),type=a.employmentType==='FT'?'Full-time':a.employmentType==='Internship'?'Internship':'Type not recorded',date=item.appliedDate||item.openedDate,dateLabel=date?`${item.appliedDate?'Applied':'Opened'} ${new Date(date).toLocaleDateString(undefined,{month:'short',day:'numeric',...(date.length===10?{timeZone:'UTC'}:{})})}`:'Date not recorded';return <li className="tracker-row glass-inset" key={a.id}>
 <button className="tracker-role" onClick={()=>setReview(a.id)} aria-label={`Open ${a.title} at ${a.company}`}><ApplicationIdentity company={a.company} title={a.title} location={a.location||type}><small className="tracker-mobile-meta"><span>{type}</span><span>{dateLabel}</span></small></ApplicationIdentity></button>
 <div className="tracker-row-progress"><TrackerProgress application={a} item={item}/>{!!progress.rounds&&<small>{progress.rounds} interview {progress.rounds===1?'step':'steps'} recorded</small>}</div>
 <button className="tracker-button tracker-row-status workspace-secondary inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={()=>setReview(a.id)} aria-label={`View ${a.title}: ${progress.status}`}>{progress.status}<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></button>
 {['Queued','Draft','Awaiting approval','Approved','Blocked'].includes(a.status)&&<span className="tracker-workflow">Preparation: {a.status}</span>}
 </li>;})}</ul>{review&&<DraftReview key={`${w.demo?'demo':w.user?.id||'guest'}:${review}`} id={review} onClose={()=>setReview(null)}/>}</>;
}
