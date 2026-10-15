'use client';

import {useState} from 'react';
import type {Post} from '../_lib/types';
import {circleAgentContext} from '../../../../lib/circle-context.mjs';
import {primary,secondary} from '../../../components/ui';

export default function AgentContext({post}:{post:Post}) {
 const context=circleAgentContext(post);
 const [expanded,setExpanded]=useState(false),[copyState,setCopyState]=useState(''),[showPacket,setShowPacket]=useState(false);
 if(!context||post.content.type==='reply')return null;
 const actionable=context.steps.length>0;
 const title=context.suggestedUse==='prepare'?'Your prep brief':'Before you consider this role';
 const packet=JSON.stringify({message:{author:post.author,title:post.content.title,body:post.content.body},agentContext:context},null,2);
 async function copy(){
  try{await navigator.clipboard.writeText(packet);setCopyState('Context copied. Paste it into your agent conversation.');}
  catch{setShowPacket(true);setCopyState('Clipboard unavailable. Select and copy the context below.');}
 }
 return <section className="mt-6 max-w-prose border-y border-board-line py-4" aria-label="Agent context">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <details className="min-w-0 flex-1">
    <summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold text-board-accent">Agent context · generated</summary>
    <p className="mb-3 text-xs leading-relaxed text-board-muted">Extracted from this shared message using topic rules, not a live AI call. Agents receive this same structured context; it is not verification.</p>
    <dl className="space-y-2 text-xs leading-relaxed">
     <div><dt className="font-semibold">Topics mentioned</dt><dd className="text-board-muted">{context.topics.map(topic=>topic.label).join(' · ')||'No supported topics detected'}</dd></div>
     <div><dt className="font-semibold">Reported context</dt><dd className="text-board-muted">{[context.reported.company,context.reported.role,context.reported.stage,context.reported.experienceDate].filter(Boolean).join(' · ')||'No additional details'} · {context.reported.provenance.replaceAll('_',' ')}</dd></div>
     <div><dt className="font-semibold">Source</dt><dd className="break-all text-board-muted">{post.author} · revision {context.source.revision} · {context.source.postId}</dd></div>
     <div><dt className="font-semibold">Limits</dt><dd className="text-board-muted">{context.limits.join(' ')}</dd></div>
    </dl>
    <div className="mt-4"><button className={secondary} onClick={()=>void copy()}>Copy context for my agent</button><p role="status" className="mt-2 text-xs leading-relaxed text-board-muted">{copyState}</p></div>
    {showPacket&&<textarea aria-label="Agent context to copy" readOnly value={packet} onFocus={event=>event.currentTarget.select()} className="mt-3 min-h-48 w-full rounded-lg border border-board-line bg-board-bg p-3 text-xs"/>}
   </details>
   {actionable&&<button className={primary} aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Close brief':context.suggestedUse==='prepare'?'Build a prep brief':'Check this opportunity'}</button>}
  </div>
  {expanded&&<div className="border-t border-board-line py-5">
   <h3 className="font-bold">{title}</h3>
   <p className="mt-2 text-xs leading-relaxed text-board-muted">Private working notes from {post.author.replace(' (demo)','')}’s message. Not saved to your applications or sent to anyone.</p>
   <ul className="my-4 space-y-4">{context.steps.map((step,index)=><li key={step}><label className="flex min-h-11 items-start gap-3 text-sm leading-7"><input type="checkbox" className="mt-2 shrink-0" aria-label={`Complete step ${index+1}`}/><span>{step}</span></label></li>)}</ul>
   <p className="text-xs leading-relaxed text-board-muted">{context.suggestedUse==='prepare'?'Use these as practice prompts, not predicted interview questions.':'This is a verification checklist, not a fit verdict or a live job recommendation.'}</p>
  </div>}
 </section>;
}
