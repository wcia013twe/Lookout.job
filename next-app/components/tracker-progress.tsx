import { trackerProgress, trackerStages } from '../../lib/tracker-display.mjs';
import { CompanyLogo } from './role-card';
import type { Application } from './workflow-types';
export function CompanyMark({company}: {company:string}) { return <span className="tracker-company-mark"><CompanyLogo company={company}/></span>; }
export default function TrackerProgress({application, item={}, vertical=false}: {application:Application; item?:{status?:string;openedDate?:string;appliedDate?:string};vertical?:boolean}) {
 const progress=trackerProgress(application,item);
 return <ol className={`tracker-progress ${vertical?'tracker-progress-vertical':''}`} aria-label={`Application progress: ${progress.status}`}>
 {trackerStages.map((label,index)=><li key={label} className={index<=progress.level?'reached':''} aria-current={index===progress.level?'step':undefined}>
 <span className="tracker-stage-label">{label}</span><span className="tracker-dot" aria-hidden="true"/>
 {progress.dates[index] && <time dateTime={progress.dates[index]}>{new Date(progress.dates[index]).toLocaleDateString(undefined,{month:'numeric',day:'numeric',year:'2-digit',...(progress.dates[index].length===10?{timeZone:'UTC'}:{})})}</time>}
 </li>)}
 </ol>;
}
