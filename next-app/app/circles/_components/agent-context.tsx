import type {Post} from '../_lib/types';
import {circleAgentContext} from '../../../../lib/circle-context.mjs';
import JobAttachment from './job-attachment';
import SharedAttachments,{hasAttachedJob} from './shared-attachments';
import '../../../components/tracker.css';

export default function SharedContext({post}:{post:Post}) {
 const context=circleAgentContext(post);
 if(!context||post.content.type==='reply')return null;
 return <section aria-label="Shared context">
  {!hasAttachedJob(post.content)&&(context.company||context.role||context.stage||context.jobUrl||context.jobId)&&<JobAttachment content={post.content}/>}
  {post.content.contexts&&<SharedAttachments contexts={post.content.contexts} primary={post.content}/>}
  {post.content.offers&&<section aria-label="Attached offer comparison" className="overflow-x-auto py-6"><h3 className="mb-4 text-base font-semibold">Offers being compared</h3><p className="mb-4 text-xs leading-6 text-board-muted">Shared details as entered. Currency, time periods and equity terms may differ.</p><table className="w-full min-w-[360px] border-collapse text-left text-sm"><caption className="sr-only">Offer details shared with your Circle</caption><thead><tr><th scope="col" className="border-b border-board-line p-3">Detail</th>{post.content.offers.map((offer,i)=><th key={i} scope="col" className="border-b border-board-line p-3">{offer.company}</th>)}</tr></thead><tbody>{([['Role','role'],['Location','location'],['Base pay','base'],['Equity','equity'],['Signing bonus','signOn'],['Other details','notes']] as const).filter(([,key])=>post.content.offers!.some(offer=>offer[key])).map(([label,key])=><tr key={key}><th scope="row" className="border-b border-board-line p-3 font-medium text-board-muted">{label}</th>{post.content.offers!.map((offer,i)=><td key={i} className="max-w-[30ch] break-words border-b border-board-line p-3">{offer[key]||'Not shared'}</td>)}</tr>)}</tbody></table></section>}
  <div className="py-3">
   <h3 className="text-sm font-semibold">{post.content.type==='interview_report'?'What came up':'Insight'}</h3>
   <p className="mt-2 max-w-[70ch] whitespace-pre-wrap break-words text-base leading-7">{context.insight}</p>
   {context.uncertainty&&<p className="mt-3 max-w-[75ch] text-xs leading-6 text-board-muted">{context.uncertainty}</p>}
  </div>
  {post.content.insight&&post.content.body&&post.content.insight.trim()!==post.content.body.trim()&&<p className="mt-3 max-w-[70ch] whitespace-pre-wrap break-words text-base leading-7">{post.content.body}</p>}
 </section>;
}
