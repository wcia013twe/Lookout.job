'use client';

import {useState} from 'react';
import type {Post} from '../_lib/types';
import {circleAgentContext} from '../../../../lib/circle-context.mjs';
import {secondary} from '../../../components/ui';

export default function AgentContext({post}:{post:Post}) {
 const context=circleAgentContext(post);
 const [copyState,setCopyState]=useState(''),[showPacket,setShowPacket]=useState(false);
 if(!context||post.content.type==='reply')return null;
 const packet=JSON.stringify(context,null,2);
 const experienceDate=context.experienceDate?new Date(`${context.experienceDate}T12:00:00Z`).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):null;
 const facts=[['Company',context.company],['Role',context.role],['Job ID',context.jobId],['Stage',context.stage],[post.content.type==='interview_report'?'Interview date':'Experience date',experienceDate]].filter(([,value])=>value);
 async function copy(){
  try{await navigator.clipboard.writeText(packet);setCopyState('Context copied.');}
  catch{setShowPacket(true);setCopyState('Clipboard unavailable. Select and copy the context below.');}
 }
 return <section aria-label="Shared context">
  {!!facts.length&&<dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-board-line py-6 sm:grid-cols-4">{facts.map(([label,value])=><div key={label} className="min-w-0"><dt className="mb-1 text-xs text-board-muted">{label}</dt><dd className="break-words text-sm font-medium leading-6">{value}</dd></div>)}</dl>}
  {post.content.offers&&<section aria-label="Attached offer comparison" className="overflow-x-auto py-6"><h3 className="mb-4 text-base font-semibold">Offers being compared</h3><p className="mb-4 text-xs leading-6 text-board-muted">Shared details as entered. Currency, time periods and equity terms may differ.</p><table className="w-full min-w-[360px] border-collapse text-left text-sm"><caption className="sr-only">Offer details shared with your Circle</caption><thead><tr><th scope="col" className="border-b border-board-line p-3">Detail</th>{post.content.offers.map((offer,i)=><th key={i} scope="col" className="border-b border-board-line p-3">{offer.company}</th>)}</tr></thead><tbody>{([['Role','role'],['Location','location'],['Base pay','base'],['Equity','equity'],['Signing bonus','signOn'],['Other details','notes']] as const).filter(([,key])=>post.content.offers!.some(offer=>offer[key])).map(([label,key])=><tr key={key}><th scope="row" className="border-b border-board-line p-3 font-medium text-board-muted">{label}</th>{post.content.offers!.map((offer,i)=><td key={i} className="max-w-[30ch] break-words border-b border-board-line p-3">{offer[key]||'Not shared'}</td>)}</tr>)}</tbody></table></section>}
  <div className="py-7">
   <h3 className="text-base font-semibold">{post.content.type==='interview_report'?'What came up':'Key insight'}</h3>
   <p className="mt-3 max-w-[65ch] whitespace-pre-wrap break-words text-lg leading-8">{context.insight}</p>
   {context.uncertainty&&<p className="mt-4 max-w-[70ch] text-sm leading-6 text-board-muted">{context.uncertainty}</p>}
   {context.jobUrl&&<a href={context.jobUrl.startsWith('https://')?context.jobUrl:undefined} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-board-accent underline underline-offset-4">View job posting<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 18 18 6M6 6h12v12"/></svg></a>}
  </div>
  {post.content.insight&&post.content.body&&post.content.insight.trim()!==post.content.body.trim()&&<section className="border-t border-board-line py-6" aria-label="Personal note"><h3 className="text-sm font-semibold">{post.author.replace(' (demo)','')}’s note</h3><p className="mt-3 max-w-[65ch] whitespace-pre-wrap break-words text-base leading-7 text-board-muted">{post.content.body}</p></section>}
  <details className="border-t border-board-line py-2">
   <summary className="min-h-11 cursor-pointer py-3 text-xs text-board-muted">Source &amp; agent context</summary>
   <p className="mb-4 text-xs leading-6 text-board-muted">Shared by {post.author} · revision {post.revision} · {context.provenance.replaceAll('_',' ')} (reported).{context.visibility==='private_draft'?' Private draft — not shared.':''}</p>
   {context.jobUrl&&<p className="mb-4 break-all text-xs leading-6 text-board-muted">Job link: {context.jobUrl}</p>}
   <button className={secondary} onClick={()=>void copy()}>Copy context</button>
   <p role="status" className="mt-2 text-xs text-board-muted">{copyState}</p>
   {showPacket&&<textarea aria-label="Context to copy" readOnly value={packet} onFocus={event=>event.currentTarget.select()} className="my-3 min-h-48 w-full rounded-lg border border-board-line bg-board-bg p-3 text-xs"/>}
  </details>
 </section>;
}
