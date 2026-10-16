import type {ReactNode} from 'react';
import { timelineItems } from '../../lib/application-timeline.mjs';
import { trackerProgress, trackerStages, sharedTrackerStage } from '../../lib/tracker-display.mjs';
import { CompanyLogo } from './role-card';
import type { Application } from './workflow-types';
export function CompanyMark({company}: {company:string}) { return <span className="tracker-company-mark"><CompanyLogo company={company}/></span>; }
export function ApplicationIdentity({company,title,location,jobId,children}:{company:string;title:string;location?:string;jobId?:string;children?:ReactNode}) {
 return <><CompanyMark company={company}/><span><strong>{title}</strong><span>{company}{jobId&&<> | ID: {jobId}</>}</span>{location&&<small className="tracker-role-location">{location}</small>}{children}</span></>;
}
export default function TrackerProgress({application, item={}, vertical=false}: {application:Application; item?:{status?:string;openedDate?:string;appliedDate?:string};vertical?:boolean}) {
 const progress=trackerProgress(application,item);
 const nextRound = vertical ? timelineItems(application).filter(event => event.phase === 'scheduled' && ['technical_round','recruiter_call','interview','onsite'].includes(event.kind)).sort((a,b)=>(a.occurred_at || '9999').localeCompare(b.occurred_at || '9999'))[0] : null;
 return <><StageProgress progress={progress} vertical={vertical}/>{nextRound && <section className="tracker-next-round" aria-label="Next interview context"><h4>{nextRound.label}</h4>{nextRound.occurred_at && <time dateTime={nextRound.occurred_at}>{new Date(nextRound.occurred_at).toLocaleString(undefined,{month:'short',day:'numeric',...(nextRound.occurred_at.length===10?{timeZone:'UTC'}:{hour:'numeric',minute:'2-digit',timeZoneName:'short'})})}</time>}<p>{nextRound.source.note || nextRound.source.excerpt || 'Round focus not recorded yet. Add the recruiter’s requirements in Rounds & email.'}</p></section>}</>;
}
export function SharedApplicationStages({stage}:{stage:string}) {
 const progress=sharedTrackerStage(stage);
 return progress.level<0?null:<StageProgress progress={progress} currentOnly/>;
}
function StageProgress({progress,vertical=false,currentOnly=false}:{progress:{level:number;status:string;dates:(string|undefined)[]};vertical?:boolean;currentOnly?:boolean}) {
 return <ol className={`tracker-progress ${vertical?'tracker-progress-vertical':''}`} aria-label={`${currentOnly?'Shared application stage':'Application progress'}: ${progress.status}`}>
 {trackerStages.map((label,index)=><li key={label} className={(currentOnly?index===progress.level:index<=progress.level)?'reached':''} aria-current={index===progress.level?'step':undefined}>
 <span className="tracker-stage-label">{label}</span><span className="tracker-dot" aria-hidden="true"/>
 {progress.dates[index] && <time dateTime={progress.dates[index]}>{new Date(progress.dates[index]).toLocaleDateString(undefined,{month:'numeric',day:'numeric',year:'2-digit',...(progress.dates[index].length===10?{timeZone:'UTC'}:{})})}</time>}
 </li>)}
 </ol>;
}
