import type {Post} from '../_lib/types';
import {circleAgentContext} from '../../../../lib/circle-context.mjs';
import {circleActivity} from '../../../../lib/circle-activity.mjs';
import ForumMentionText from './forum-mention-text';
import JobAttachment from './job-attachment';
import SharedAttachments,{hasAttachedJob} from './shared-attachments';
import '../../../components/tracker.css';

export default function SharedContext({post}:{post:Post}) {
 const context=circleAgentContext(post);
 if(!context||post.content.type==='reply')return null;
 const message=circleActivity(post.content).message;
 const insight=post.content.activity&&!post.content.insight?message:context.insight;
 return <section aria-label="Shared context">
  {!hasAttachedJob(post.content)&&(context.company||context.role||context.stage||context.jobUrl||context.jobId)&&<JobAttachment content={post.content}/>}
  {post.content.contexts&&<SharedAttachments contexts={post.content.contexts} primary={post.content}/>}
  {context.activity&&<section aria-label="Shared activity" className="space-y-3 py-4">
   <h3 className="text-sm font-semibold">Shared activity · member reported</h3>
   {!!context.activity.highlights.length&&<ul className="list-disc space-y-1 pl-5">{context.activity.highlights.map((highlight:string,index:number)=><li key={index} className="whitespace-pre-wrap break-words">{highlight}</li>)}</ul>}
   {context.activity.goal&&<p className="whitespace-pre-wrap break-words"><strong>This week’s goal:</strong> {context.activity.goal}</p>}
   {context.activity.help&&<p className="whitespace-pre-wrap break-words"><strong>Could use a hand with:</strong> {context.activity.help}</p>}
  </section>}
  {post.content.offers&&<section aria-label="Attached offer comparison" className="overflow-x-auto py-6"><h3 className="mb-4 text-base font-semibold">Offers being compared</h3><p className="mb-4 text-xs leading-6 text-board-muted">Shared details as entered. Currency, time periods and equity terms may differ.</p><table className="w-full min-w-[360px] border-collapse text-left text-sm"><caption className="sr-only">Offer details shared with your Circle</caption><thead><tr><th scope="col" className="border-b border-board-line p-3">Detail</th>{post.content.offers.map((offer,i)=><th key={i} scope="col" className="border-b border-board-line p-3">{offer.company}</th>)}</tr></thead><tbody>{([['Role','role'],['Location','location'],['Base pay','base'],['Equity','equity'],['Signing bonus','signOn'],['Other details','notes']] as const).filter(([,key])=>post.content.offers!.some(offer=>offer[key])).map(([label,key])=><tr key={key}><th scope="row" className="border-b border-board-line p-3 font-medium text-board-muted">{label}</th>{post.content.offers!.map((offer,i)=><td key={i} className="max-w-[30ch] break-words border-b border-board-line p-3">{offer[key]||'Not shared'}</td>)}</tr>)}</tbody></table></section>}
  {insight&&<div className="py-3">
   <h3 className="text-sm font-semibold">{post.content.type==='interview_report'?'What came up':'Insight'}</h3>
   <p className="mt-2 max-w-[70ch] whitespace-pre-wrap break-words text-base leading-7"><ForumMentionText text={insight}/></p>
   {context.uncertainty&&<p className="mt-3 max-w-[75ch] text-xs leading-6 text-board-muted">{context.uncertainty}</p>}
  </div>}
  {post.content.insight&&message&&post.content.insight.trim()!==message.trim()&&<p className="mt-3 max-w-[70ch] whitespace-pre-wrap break-words text-base leading-7"><ForumMentionText text={message}/></p>}
 </section>;
}
