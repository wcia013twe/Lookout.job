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
  {(context.company||context.role||context.stage||context.jobUrl||context.jobId)&&<section className="tracker-surface my-5 rounded-xl border border-board-line bg-board-tag p-4 sm:p-5" aria-label={`${name}’s shared application`}>
   <div className="flex items-start gap-3">
    {context.company&&<CompanyMark company={context.company}/>}
    <div className="min-w-0 flex-1">
     {context.role&&<h3 className="break-words text-base font-semibold leading-6">{context.role}</h3>}
     {context.company&&<p className="break-words text-sm leading-6 text-board-muted">{context.company}</p>}
     {context.jobId&&<p className="text-xs leading-6 text-board-muted">Job ID {context.jobId}</p>}
     <p className="mt-1 text-xs leading-6 text-board-muted">{context.stage||'Stage not shared'}{experienceDate?` · ${experienceDate}`:''}</p>
    </div>
    {context.jobUrl&&<a href={context.jobUrl.startsWith('https://')?context.jobUrl:undefined} target="_blank" rel="noopener noreferrer" aria-label="View job posting" title="View job posting" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-board-accent hover:bg-board-panel"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 18 18 6M6 6h12v12"/></svg></a>}
   </div>
   {context.stage&&<div className="mt-5"><SharedApplicationStages stage={context.stage}/></div>}
  </section>}
  {post.content.offers&&<section aria-label="Attached offer comparison" className="overflow-x-auto py-6"><h3 className="mb-4 text-base font-semibold">Offers being compared</h3><p className="mb-4 text-xs leading-6 text-board-muted">Shared details as entered. Currency, time periods and equity terms may differ.</p><table className="w-full min-w-[360px] border-collapse text-left text-sm"><caption className="sr-only">Offer details shared with your Circle</caption><thead><tr><th scope="col" className="border-b border-board-line p-3">Detail</th>{post.content.offers.map((offer,i)=><th key={i} scope="col" className="border-b border-board-line p-3">{offer.company}</th>)}</tr></thead><tbody>{([['Role','role'],['Location','location'],['Base pay','base'],['Equity','equity'],['Signing bonus','signOn'],['Other details','notes']] as const).filter(([,key])=>post.content.offers!.some(offer=>offer[key])).map(([label,key])=><tr key={key}><th scope="row" className="border-b border-board-line p-3 font-medium text-board-muted">{label}</th>{post.content.offers!.map((offer,i)=><td key={i} className="max-w-[30ch] break-words border-b border-board-line p-3">{offer[key]||'Not shared'}</td>)}</tr>)}</tbody></table></section>}
  <div className="py-3">
   <h3 className="text-sm font-semibold">{post.content.type==='interview_report'?'What came up':'Insight'}</h3>
   <p className="mt-2 max-w-[70ch] whitespace-pre-wrap break-words text-base leading-7">{context.insight}</p>
   {context.uncertainty&&<p className="mt-3 max-w-[75ch] text-xs leading-6 text-board-muted">{context.uncertainty}</p>}
  </div>
  {post.content.insight&&post.content.body&&post.content.insight.trim()!==post.content.body.trim()&&<p className="mt-3 max-w-[70ch] whitespace-pre-wrap break-words text-base leading-7">{post.content.body}</p>}
 </section>;
}
