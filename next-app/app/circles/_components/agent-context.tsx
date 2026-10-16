import type {Post} from '../_lib/types';
import {circleAgentContext} from '../../../../lib/circle-context.mjs';
import {CompanyMark,SharedApplicationStages} from '../../../components/tracker-progress';
import '../../../components/tracker.css';

export default function SharedContext({post}:{post:Post}) {
 const context=circleAgentContext(post);
 if(!context||post.content.type==='reply')return null;
 const experienceDate=context.experienceDate?new Date(`${context.experienceDate}T12:00:00Z`).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):null;
 const name=post.author.replace(' (demo)','');
 return <section aria-label="Shared context">
  {(context.company||context.role||context.stage||context.jobUrl)&&<section className="tracker-surface my-5 rounded-xl border border-board-line bg-board-tag p-4 sm:p-5" aria-label={`${name}’s shared application`}>
   <div className="flex items-start gap-3">
    {context.company&&<CompanyMark company={context.company}/>}
    <div className="min-w-0 flex-1">
     {context.role&&<h3 className="break-words text-base font-semibold leading-6">{context.role}</h3>}
     {context.company&&<p className="break-words text-sm leading-6 text-board-muted">{context.company}</p>}
     <p className="mt-1 text-xs leading-6 text-board-muted">{context.stage||'Stage not shared'}{experienceDate?` · ${experienceDate}`:''}</p>
    </div>
    {context.jobUrl&&<a href={context.jobUrl.startsWith('https://')?context.jobUrl:undefined} target="_blank" rel="noopener noreferrer" aria-label="View job posting" title="View job posting" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-board-accent hover:bg-board-panel"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 18 18 6M6 6h12v12"/></svg></a>}
   </div>
   {context.stage&&<div className="mt-5"><SharedApplicationStages stage={context.stage}/></div>}
  </section>}
  <div className="py-3">
   <h3 className="text-sm font-semibold">{post.content.type==='interview_report'?'What came up':'Insight'}</h3>
   <p className="mt-2 max-w-[70ch] whitespace-pre-wrap break-words text-base leading-7">{context.insight}</p>
   {context.uncertainty&&<p className="mt-3 max-w-[75ch] text-xs leading-6 text-board-muted">{context.uncertainty}</p>}
  </div>
  {post.content.insight&&post.content.body&&post.content.insight.trim()!==post.content.body.trim()&&<p className="mt-3 max-w-[70ch] whitespace-pre-wrap break-words text-base leading-7">{post.content.body}</p>}
 </section>;
}
