import type {ReactNode} from 'react';
import {applicationRounds} from '../../lib/application-rounds.mjs';
import { trackerProgress, trackerStages, sharedTrackerStage } from '../../lib/tracker-display.mjs';
import { CompanyLogo } from './role-card';
import type { Application } from './workflow-types';
export function CompanyMark({company}: {company:string}) { return <span className="tracker-company-mark"><CompanyLogo company={company}/></span>; }
export function ApplicationIdentity({company,title,location,jobId,children}:{company:string;title:string;location?:string;jobId?:string;children?:ReactNode}) {
 return <><CompanyMark company={company}/><span><strong>{title}</strong><span>{company}{jobId&&<> | ID: {jobId}</>}</span>{location&&<small className="tracker-role-location">{location}</small>}{children}</span></>;
}
export default function TrackerProgress({application, item={}, vertical=false}: {application:Application; item?:{status?:string;openedDate?:string;appliedDate?:string};vertical?:boolean}) {
 const progress=trackerProgress(application,item);
 const nextRound=vertical?applicationRounds(application).filter(round=>!round.cancelled&&round.phase==='scheduled').sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'))[0]:null;
 return <><StageProgress progress={progress} vertical={vertical}/>{nextRound && <section className="tracker-next-round" aria-label="Next interview context"><h4>{nextRound.label}</h4>{nextRound.date && <time dateTime={nextRound.date}>{new Date(nextRound.date).toLocaleString(undefined,{month:'short',day:'numeric',...(nextRound.date.length===10?{timeZone:'UTC'}:{hour:'numeric',minute:'2-digit',timeZoneName:'short'})})}</time>}{(nextRound.notes)&&<p>{(nextRound.notes).trim().split('\n')[0]}</p>}</section>}</>;
}
export function SharedApplicationStages({stage}:{stage:string}) {
 const progress=sharedTrackerStage(stage);
 return progress.level<0?null:<StageProgress progress={progress} currentOnly/>;
}
function StageProgress({progress,vertical=false,currentOnly=false}:{progress:{level:number;status:string;dates:(string|undefined)[];completed?:boolean[]};vertical?:boolean;currentOnly?:boolean}) {
 return <ol className={`tracker-progress ${vertical?'tracker-progress-vertical':''}`} aria-label={`${currentOnly?'Shared application stage':'Application progress'}: ${progress.status}`}>
 {trackerStages.map((label,index)=><li key={label} className={`${(currentOnly?index===progress.level:index<=progress.level)?'reached':''}${progress.completed?.[index]?' is-complete':''}`} aria-current={index===progress.level?'step':undefined}>
 <span className="tracker-stage-label">{label}</span><span className="tracker-dot" aria-hidden="true">{progress.completed?.[index]&&<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 10 3 3 7-7"/></svg>}</span>{progress.completed?.[index]&&<span className="sr-only">Completed</span>}
 {progress.dates[index] && <time dateTime={progress.dates[index]}>{new Date(progress.dates[index]).toLocaleDateString(undefined,{month:'numeric',day:'numeric',year:'2-digit',...(progress.dates[index].length===10?{timeZone:'UTC'}:{})})}</time>}
 </li>)}
 </ol>;
}
