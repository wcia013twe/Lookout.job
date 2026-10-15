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
 async function copy(){
  try{await navigator.clipboard.writeText(packet);setCopyState('Context copied.');}
  catch{setShowPacket(true);setCopyState('Clipboard unavailable. Select and copy the context below.');}
 }
 const draft=post.revision!==post.publishedRevision;
 return <details className="mt-5 max-w-prose border-y border-board-line py-2" aria-label={draft?'Context to share':'Shared context'} open={draft||!post.content.body||undefined}>
  <summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold text-board-accent">{draft?'Context to share':'Shared context'}</summary>
  <dl className="space-y-4 py-3 text-sm leading-7">
   {context.jobUrl&&<div><dt className="text-xs text-board-muted">Job link</dt><dd><a href={context.jobUrl.startsWith('https://')?context.jobUrl:undefined} target="_blank" rel="noopener noreferrer" className="break-all text-board-accent underline underline-offset-4">{context.jobUrl}</a></dd></div>}
   {context.stage&&<div><dt className="text-xs text-board-muted">Stage</dt><dd>{context.stage}</dd></div>}
   <div><dt className="text-xs text-board-muted">Insight</dt><dd className="whitespace-pre-wrap break-words">{context.insight}</dd></div>
   {(context.company||context.role||context.experienceDate)&&<div><dt className="text-xs text-board-muted">Context</dt><dd>{[context.company,context.role,context.experienceDate].filter(Boolean).join(' · ')}</dd></div>}
   {context.uncertainty&&<div><dt className="text-xs text-board-muted">Note</dt><dd>{context.uncertainty}</dd></div>}
  </dl>
  <div className="pb-3"><button className={secondary} onClick={()=>void copy()}>Copy context</button><p role="status" className="mt-2 text-xs text-board-muted">{copyState}</p></div>
  {showPacket&&<textarea aria-label="Context to copy" readOnly value={packet} onFocus={event=>event.currentTarget.select()} className="my-3 min-h-48 w-full rounded-lg border border-board-line bg-board-bg p-3 text-xs"/>}
 </details>;
}
