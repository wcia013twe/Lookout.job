'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {FeedPage,Post,Request} from '../_lib/types';
import {types} from '../_lib/types';
import {visibleCircleFeedEvents} from '../../../../lib/circle-feed.mjs';
import {secondary} from '../../../components/ui';
import ForumMentionText from './forum-mention-text';

export default function CircleFeed({circleId,request,openPost,demo}:{circleId:string;request:Request;openPost:(post:Post)=>void;demo:boolean}){
 const [open,setOpen]=useState(false),[page,setPage]=useState<FeedPage|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const generation=useRef(0);
 const load=useCallback(async(after?:FeedPage['nextCursor'])=>{
  const current=++generation.current;setBusy(true);setError('');
  // Clear cached bodies before revalidation, including failed refreshes.
  if(!after)setPage(null);
  try{
   const result=await request<FeedPage>('knowledge.feed',{circleId,...(after?{after}:{})});
   if(current===generation.current)setPage(previous=>({...result,items:after?[...(previous?.items||[]),...result.items]:result.items}));
  }catch(reason){if(current===generation.current){setPage(null);setError(reason instanceof Error?reason.message:'Updates could not load. Try again.');}}
  finally{if(current===generation.current)setBusy(false);}
 },[circleId,request]);
 useEffect(()=>{
  if(!open)return;
  void load();
  const refresh=()=>{if(document.visibilityState==='visible')void load();};
  const interval=setInterval(refresh,30000);window.addEventListener('focus',refresh);
  return()=>{generation.current++;clearInterval(interval);window.removeEventListener('focus',refresh);};
 },[load,open]);
 const events=visibleCircleFeedEvents(page?.items||[]);
 return <details className="my-6 border-y border-board-line" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary className="min-h-11 cursor-pointer py-4 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-board-accent">Shared updates</summary>
  {open&&<section aria-label="Circle shared updates" className="pb-5">
   <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><p className="max-w-prose text-sm leading-relaxed text-board-muted">{demo?'Fictional updates · ':''}What your people have chosen to share.</p><button type="button" className={secondary} disabled={busy} onClick={()=>void load()}>Refresh updates</button></div>
   <p role="status" className="text-sm text-board-muted">{busy?'Loading shared updates…':''}</p>
   {error&&<p role="alert" className="py-3 text-sm">{error} Use Refresh updates to retry.</p>}
   {!busy&&!error&&page&&!events.length&&<p className="py-5 text-sm leading-relaxed text-board-muted">No shared updates yet. New contributions will appear here after they’re published.</p>}
   <ol className="divide-y divide-board-line">{events.map(event=><li key={event.id} className="min-w-0 py-4">
    {event.sourceAvailable&&event.post?<><div className="mb-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-board-muted"><span>{event.post.author.replace(' (demo)','')}</span><span>{event.kind==='revision_published'?'Updated contribution':types[event.post.content.type]||'Contribution'}</span><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time></div><button type="button" className="min-h-11 max-w-full break-words py-2 text-left text-base font-semibold underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-board-accent" onClick={()=>openPost({...event.post!,id:event.threadId})}>{event.post.content.title}</button><p className="line-clamp-3 max-w-[70ch] whitespace-pre-wrap break-words text-sm leading-relaxed text-board-muted"><ForumMentionText text={event.post.content.insight||event.post.content.body}/></p></>:<p className="text-sm leading-relaxed text-board-muted">{event.kind==='withdrawn'?'A contribution was withdrawn.':event.kind==='hidden'?'A contribution was hidden.':'An earlier shared version is no longer available.'}</p>}
   </li>)}</ol>
   {page?.nextCursor&&<button type="button" className={`${secondary} mt-4`} disabled={busy} onClick={()=>void load(page.nextCursor)}>More shared updates</button>}
  </section>}
 </details>;
}
