'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {Field,Heading,Notice,control,primary,secondary} from '../../../components/ui';
import {useKnowledgeClient} from '../_lib/client';
import {types,type Content,type Post,type Circle,type Detail,type Cursor,type Request} from '../_lib/types';
import Editor from './editor';
import AuthorshipLabel from './authorship-label';
import CircleListItem from './circle-list-item';
import CircleEntry from './circle-entry';
import listStyles from './circle-list.module.css';
import Settings from './settings';
import AgentContext from './agent-context';
import CircleSearch from './search';
import CircleDashboard from './circle-views';
import ApiError from '../../../components/api-error';
type Page<T>={items:T[];nextCursor:Cursor|null};
type Thread={post:Post;replies:Post[];nextCursor:Cursor|null};
const errorText=(e:unknown)=>e instanceof Error?e.message:'Something went wrong. Try again.';
const date=(at:string)=>new Date(at).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
export default function CircleKnowledge(){
 const client=useKnowledgeClient();
 if(client.connectionState==='loading')return <Notice>Connecting to your Circle account…</Notice>;
 if(client.connectionState==='signed_out')return <><Heading title="Circles">Sign in to open your private Circles.</Heading><div className="flex flex-wrap gap-3"><button className={primary} onClick={client.signIn}>Sign in</button><button className={secondary} onClick={client.openDemo}>Explore fictional demo</button></div></>;
 if(!client.ready)return <ApiError message="Circle client initialization failed [CLIENT_UNAVAILABLE]. Reload the page to reconnect." onRetry={()=>location.reload()}/>;
 return <KnowledgeSurface key={client.identity} request={client.request} demo={client.demo}/>;
}
export function KnowledgeSurface({request,demo}:{request:Request;demo:boolean}){
 const [circles,setCircles]=useState<Circle[]>([]),[circleId,setCircleId]=useState(''),[threadId,setThreadId]=useState('');
 const [circleView,setCircleView]=useState<'clubhouse'|'settings'>('clubhouse');
 const [detail,setDetail]=useState<Detail|null>(null),[page,setPage]=useState<Page<Post>>({items:[],nextCursor:null}),[thread,setThread]=useState<Thread|null>(null);
 const [filters,setFilters]=useState<Record<string,string>>({sort:'newest'}),[editor,setEditor]=useState<{post?:Post;reply?:boolean}|null>(null);
 const [draftPosts,setDraftPosts]=useState<Post[]>([]);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[available,setAvailable]=useState(false);
 const mounted=useRef(true),version=useRef(0),pending=useRef<{operation:string;payload:Record<string,unknown>;key:string}|null>(null);
 const detailRegion=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(thread||editor){detailRegion.current?.scrollIntoView({block:'start',behavior:'auto'});detailRegion.current?.focus({preventScroll:true});}},[thread?.post.id,!!editor]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const locate=useCallback((cid:string,tid='')=>{
  setEditor(null);setThread(null);setDetail(null);setDraftPosts([]);setPage({items:[],nextCursor:null});setCircleId(cid);setThreadId(tid);setError('');setNotice('');
  const url=new URL(location.href);url.searchParams.delete('circle');url.searchParams.delete('thread');if(cid)url.searchParams.set('circle',cid);if(tid)url.searchParams.set('thread',tid);history.pushState(null,'',url);
 },[]);
 const list=useCallback(async()=>{
  const result=await request<{available:boolean;circles:Circle[]}>('circles.list');
  if(!mounted.current)return;setCircles(result.circles);setAvailable(true);setError('');return result.circles;
 },[request]);
 useEffect(()=>{
  let current=true;setLoading(true);
  list().then(rows=>{if(!current||!rows)return;const params=new URL(location.href).searchParams;setCircleId(params.get('circle')||'');setThreadId(params.get('thread')||'');}).catch(e=>{if(current)setError(errorText(e));}).finally(()=>{if(current)setLoading(false);});
  const pop=()=>{version.current++;const p=new URL(location.href).searchParams;setDetail(null);setPage({items:[],nextCursor:null});setDraftPosts([]);setEditor(null);setThread(null);setThreadId(p.get('thread')||'');setCircleId(p.get('circle')||'');setCircleView('clubhouse');};window.addEventListener('popstate',pop);
  return()=>{current=false;window.removeEventListener('popstate',pop);};
 },[list]);
 const refresh=useCallback(async()=>{
  if(!circleId)return;const generation=++version.current;
  try{
   const [d,p,t,drafts]=await Promise.all([request<Detail>('circles.read',{circleId}),request<Page<Post>>('knowledge.search',{circleId,...filters}),threadId?request<Thread>('knowledge.read',{circleId,postId:threadId}):Promise.resolve(null),Object.keys(filters).some(key=>key!=='sort')?request<Page<Post>>('knowledge.search',{circleId,sort:'newest'}):Promise.resolve(null)]);
   if(!mounted.current||generation!==version.current)return;setDetail(d);setPage(p);setDraftPosts((drafts||p).items);setThread(t);setError('');
  }catch(e){if(mounted.current&&generation===version.current){setDetail(null);setDraftPosts([]);setPage({items:[],nextCursor:null});setThread(null);setError(errorText(e));}throw e;}
 },[circleId,threadId,filters,request]);
 useEffect(()=>{
  if(!circleId)return;setLoading(true);refresh().catch(()=>{}).finally(()=>{if(mounted.current)setLoading(false);});
  const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh().catch(()=>{});},30000);
  const focus=()=>{if(document.visibilityState==='visible')refresh().catch(()=>{});};document.addEventListener('visibilitychange',focus);
  return()=>{version.current++;clearInterval(timer);document.removeEventListener('visibilitychange',focus);};
 },[refresh,circleId]);
 async function write<T>(operation:string,payload:Record<string,unknown>):Promise<T>{
  const previous=pending.current;const key=previous?.operation===operation&&JSON.stringify(previous.payload)===JSON.stringify(payload)?previous.key:crypto.randomUUID();
  pending.current={operation,payload,key};const result=await request<T>(operation,{...payload,eventKey:key});pending.current=null;return result;
 }
 async function act(operation:string,payload:Record<string,unknown>={}){
  const generation=version.current;setBusy(true);setError('');setNotice('');
  try{await write(operation,{circleId,...payload});if(!mounted.current||generation!==version.current)return;
   if(operation==='circles.leave'){await list();locate('');}
   else if(operation==='knowledge.withdraw'||operation==='knowledge.hide'){locate(circleId);}
   else {await refresh();}
   if(mounted.current)setNotice(operation==='knowledge.withdraw'?'Contribution withdrawn from your Circle.':operation==='knowledge.publish'?'Shared with your Circle.':operation==='knowledge.approve'?'This exact version is approved for your agent to share.':operation==='circles.leave'?'You left the Circle.':'Saved.');
  }catch(e){if(mounted.current)setError(errorText(e));}finally{if(mounted.current)setBusy(false);}
 }
 async function createOrJoin(e:FormEvent<HTMLFormElement>,join:boolean){
  e.preventDefault();const form=e.currentTarget,data=new FormData(form);setBusy(true);setError('');
  try{const payload=join?{token:String(data.get('token')).trim(),alias:String(data.get('alias')).trim()}:{name:String(data.get('name')).trim(),alias:String(data.get('alias')).trim()};const result=await write<{circleId:string}>(join?'circles.join':'circles.create',payload);if(mounted.current){await list();locate(result.circleId);form.reset();}}
  catch(e){if(mounted.current)setError(errorText(e));}finally{if(mounted.current)setBusy(false);}
 }
 async function save(content:Content){
  setBusy(true);
  try{const result=await write<{postId:string;revision:number}>('knowledge.propose',{circleId,expectedRevision:editor?.post?.revision||0,content,...(editor?.post?{postId:editor.post.id}:editor?.reply?{parentId:thread!.post.id}:{})});if(!mounted.current)return;setEditor(null);const target=editor?.post?.parentId||(editor?.reply?thread!.post.id:result.postId);if(threadId===target)await refresh();else locate(circleId,target);setNotice('Private draft saved. Review it before publishing.');}
  finally{if(mounted.current)setBusy(false);}
 }
 async function more(kind:'posts'|'replies'){
  const generation=version.current;setBusy(true);try{
   if(kind==='posts'){const next=await request<Page<Post>>('knowledge.search',{circleId,...filters,cursor:page.nextCursor});if(mounted.current&&generation===version.current)setPage(old=>({items:[...old.items,...next.items],nextCursor:next.nextCursor}));}
   else if(kind==='replies'){const next=await request<Thread>('knowledge.read',{circleId,postId:threadId,cursor:thread!.nextCursor});if(mounted.current&&generation===version.current)setThread(old=>old?{...next,replies:[...old.replies,...next.replies]}:next);}

  }catch(e){if(mounted.current&&generation===version.current){setError(errorText(e));setThread(null);setPage({items:[],nextCursor:null});}}finally{if(mounted.current&&generation===version.current)setBusy(false);}
 }
 const settingsPanel=detail?<><Settings detail={detail} busy={busy} act={act} embedded/><div className="flex flex-wrap gap-3 border-t border-board-line py-4"><button className={secondary} disabled={busy||loading} onClick={()=>void (async()=>{await list();await refresh();})().catch(error=>setError(errorText(error)))}>Refresh Circle</button></div></>:null;
 const composing=!!editor&&!editor.post&&!editor.reply;
 const privateDrafts=[...new Map([...draftPosts,...page.items].map(post=>[post.id,post])).values()].filter(post=>post.owned&&post.revision!==post.publishedRevision);
 return <div className="min-w-0">
  {circleId&&<button type="button" className={`${secondary} mb-4`} disabled={busy} onClick={()=>{setCircleView('clubhouse');locate('');}}>Back to your circles</button>}
  {!circleId&&<Heading title="Circles" />}
  <ApiError message={error} onRetry={()=>void (async()=>{setLoading(true);try{await list();await refresh();}catch(failure){setError(errorText(failure));}finally{if(mounted.current)setLoading(false);}})()}/><div role="status"><Notice>{notice||(loading?'Loading Circle…':'')}</Notice></div>
  {available&&!circleId&&!loading&&<>
   {!error&&<section className="mb-8" aria-labelledby="your-circles-title">
    <h2 id="your-circles-title" className="mb-3 text-xl font-semibold">Your circles</h2>
    {circles.length?<ul className={listStyles.list}>{circles.map(circle=><CircleListItem key={circle.id} circle={circle} request={request} demo={demo} busy={busy} open={()=>{setCircleView('clubhouse');locate(circle.id);}} manage={()=>{setCircleView('settings');locate(circle.id);}}/>)}</ul>:<p className="py-4 text-board-muted">No circles yet. Join your people with an invite code, or start your own.</p>}
   </section>}
   <details className="border-b border-board-line py-2" open={!circles.length}>
    <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Join or create a Circle</summary>
    <CircleEntry busy={busy} demo={demo} submit={createOrJoin}/>
   </details>
  </>}

  {detail&&<>
   <CircleDashboard initialChannel={circleView} pagination={page.nextCursor?<button className={secondary} disabled={busy} onClick={()=>void more('posts')}>More contributions</button>:null} settings={settingsPanel} key={circleId} busy={busy} save={save} detail={detail} posts={page.items} demo={demo} openPost={post=>locate(circleId,post.id)} focused={!!editor||!!thread} searching={Object.keys(filters).some(key=>key!=='sort')} search={<CircleSearch key={circleId} filters={filters} busy={busy||loading} search={setFilters}/>} controls={<div className="circle-header-controls">
    {circles.length>1&&<select aria-label="Switch Circle" className={control} value={circleId} disabled={busy} onChange={event=>locate(event.target.value)}>{circles.map(circle=><option key={circle.id} value={circle.id}>{circle.name}</option>)}</select>}
    {privateDrafts.length===1?<button className={secondary} disabled={busy} onClick={()=>locate(circleId,privateDrafts[0].id)}>1 draft to review</button>:privateDrafts.length>1?<details className="circle-header-menu"><summary>{privateDrafts.length} drafts to review</summary><ul className="circle-header-panel">{privateDrafts.map(post=><li key={post.id}><button className="min-h-11 w-full py-3 text-left text-sm" disabled={busy} onClick={()=>locate(circleId,post.id)}>{post.content.title}</button></li>)}</ul></details>:null}
    <button type="button" className={composing?secondary:primary} disabled={busy} aria-expanded={composing} onClick={()=>{if(composing){setEditor(null);return;}setThreadId('');setThread(null);setEditor({});const url=new URL(location.href);url.searchParams.delete('thread');history.replaceState(null,'',url);}}>{composing?'Close conversation':'New conversation'}</button>
   </div>}/>
   {(!!editor||!!thread)&&<div ref={detailRegion} tabIndex={-1} className="py-6" style={{outline:'none'}}>


    {editor?<><p className="mb-4 text-sm leading-relaxed text-board-muted">Sharing with <strong className="text-board-text">{detail.circle.name}</strong>. Saving a draft does not publish it.</p><Editor demo={demo} contexts={[...page.items,...(thread?[thread.post]:[])].filter(post=>post.state==='published'&&post.revision===post.publishedRevision).map(post=>post.content)} key={editor.post?.id||String(editor.reply)} initial={editor.post?.content} reply={editor.reply||editor.post?.content.type==='reply'} busy={busy} save={save} cancel={()=>setEditor(null)}/></>:thread?<section aria-label="Shared experience" className="mx-auto max-w-[840px]">
     <button className={`${secondary} mb-6`} onClick={()=>locate(circleId)}>Back to Circle</button>
     {thread.post.owned&&thread.post.revision!==thread.post.publishedRevision&&<p className="mb-5 rounded-lg border border-board-line bg-board-panel p-4 text-sm leading-relaxed">Private draft · {thread.post.author} → {detail.circle.name}</p>}
     <Contribution commentsLabel={String(thread.replies.length)+(thread.nextCursor?'+':'')} post={thread.post} circleName={detail.circle.name} busy={busy} edit={()=>setEditor({post:thread.post})} keepPrivate={()=>locate(circleId)} act={act}/>
     {thread.post.state==='published'&&<section id="circle-comments" tabIndex={-1} style={{outline:'none'}} className="mt-6 border-t border-board-line pt-6" aria-label="Comments">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-semibold">Comments{thread.replies.length>0&&<>{' '}<span className="ml-2 text-sm font-normal text-board-muted">{thread.replies.length}{thread.nextCursor?'+':''}</span></>}</h3><button className={secondary} disabled={busy} onClick={()=>setEditor({reply:true})}>Write a reply</button></div>
      {!thread.replies.length&&<p className="py-5 text-sm leading-7 text-board-muted">No replies yet. Add a note or ask a question.</p>}
      <div className="divide-y divide-board-line">{thread.replies.map(reply=><div key={reply.id} className="border-l border-board-line py-4 pl-4"><Contribution post={reply} circleName={detail.circle.name} busy={busy} edit={()=>setEditor({post:reply})} keepPrivate={()=>locate(circleId)} act={act}/></div>)}</div>
      {thread.nextCursor&&<button className={`${secondary} mt-4`} disabled={busy} onClick={()=>void more('replies')}>More replies</button>}
     </section>}
    </section>:null}
   </div>}
  </>}
 </div>;
}

function Contribution({post,circleName,busy,edit,keepPrivate,act,commentsLabel}:{post:Post;circleName:string;busy:boolean;edit:()=>void;keepPrivate:()=>void;commentsLabel?:string;act:(operation:string,payload:Record<string,unknown>)=>Promise<void>}){
 const [reason,setReason]=useState(''),[reportOpen,setReportOpen]=useState(false);
 const draft=post.revision!==post.publishedRevision,reply=post.content.type==='reply';
 const name=post.author.replace(' (demo)','');
 return <article className={reply?'min-w-0':'min-w-0 rounded-xl border border-board-line bg-board-panel p-5 sm:p-7'}>
  <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
   <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-board-tag text-xs font-semibold text-board-accent">{name.split(/\s+/).slice(0,2).map(part=>part[0]).join('')}</span>
   <div className="text-xs leading-6"><span className="font-semibold">{name}</span><span className="mx-2 text-board-muted" aria-hidden="true">·</span><time className="text-board-muted" dateTime={post.createdAt}>{date(post.createdAt)}</time></div>
   <AuthorshipLabel post={post}/>
   {draft&&<strong className="text-xs text-board-accent">Private draft</strong>}
   <div className="ml-auto flex min-h-11 items-center gap-3 text-xs text-board-muted" aria-label="Thread stats and actions">
    {!draft&&post.helpfulPeople>0&&<span className="inline-flex items-center gap-1.5" title="Agent-reported use in an answer or preparation plan, not confirmed benefit." aria-label={`Used by agents for ${post.helpfulPeople} people; agent-reported use`}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3"/></svg>Used by {post.helpfulPeople}</span>}
    {commentsLabel!==undefined&&post.state==='published'&&<button type="button" className="inline-flex min-h-11 items-center gap-1.5 hover:text-board-text" onClick={()=>{const comments=document.getElementById('circle-comments');comments?.scrollIntoView({block:'start'});comments?.focus({preventScroll:true});}}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 4h16v12H9l-5 4V4Z"/></svg>{commentsLabel} {commentsLabel==='1'?'comment':'comments'}</button>}
    {post.state==='published'&&<button type="button" aria-label={`Report ${reply?'reply':'contribution'} by ${name}`} title={`Report ${reply?'reply':'contribution'}`} aria-expanded={reportOpen} aria-controls={`report-${post.id}`} disabled={busy} onClick={()=>setReportOpen(!reportOpen)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-board-tag hover:text-board-text disabled:opacity-50"><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M5 21V3m0 1c5-3 9 3 14 0v10c-5 3-9-3-14 0"/></svg></button>}
   </div>
  </div>
  {!reply&&<><h2 className="max-w-[38ch] break-words text-2xl font-bold leading-tight tracking-tight sm:text-[28px] sm:leading-[1.3]">{post.content.title}</h2><p className="mt-2 text-xs text-board-muted">{types[post.content.type]}</p></>}
  {reportOpen&&<form id={`report-${post.id}`} aria-label="Report contribution" className="my-4 space-y-3 border-y border-board-line py-4" onSubmit={event=>{event.preventDefault();void act('knowledge.report',{postId:post.id,reason});}}><Field label="Reason for the Circle owner"><input className={control} value={reason} onChange={event=>setReason(event.target.value)} required maxLength={1000}/></Field><div className="flex gap-3"><button className={secondary} disabled={busy}>Send report</button><button type="button" className={secondary} onClick={()=>setReportOpen(false)}>Cancel</button></div></form>}
  {post.owned&&draft&&<p className="mb-5 max-w-prose text-sm leading-relaxed text-board-muted">Review this version and its attached details before sharing with <strong className="text-board-text">{circleName}</strong>. Members and their permitted agents can read shared posts; members may copy them.</p>}
  {reply?<p className="max-w-[70ch] whitespace-pre-wrap break-words text-base leading-7">{post.content.body}</p>:<AgentContext key={`${post.id}:${post.revision}`} post={post}/>}
  {!!post.content.sources.length&&<section className="border-t border-board-line py-5" aria-label="Public sources"><h3 className="text-sm font-semibold">Shared resources</h3><ul className="mt-2 space-y-2 text-sm">{post.content.sources.map((source,index)=><li key={index}><a href={source.url.startsWith('https://')?source.url:undefined} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-words text-board-accent underline underline-offset-4">{source.label}</a></li>)}</ul></section>}

  {post.owned&&(reply&&!draft?<details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-xs text-board-muted">Manage your reply</summary><div className="flex flex-wrap gap-3"><button className={secondary} disabled={busy} onClick={edit}>Edit</button><button className={secondary} disabled={busy} onClick={()=>void act('knowledge.withdraw',{postId:post.id,expectedRevision:post.revision})}>Withdraw contribution</button></div></details>:<div className="mt-6 border-t border-board-line pt-6"><div className="flex flex-wrap gap-3">{draft&&<button className={`${primary} max-w-full whitespace-normal`} disabled={busy} onClick={()=>void act('knowledge.publish',{postId:post.id,expectedRevision:post.revision})}>Share with {circleName}</button>}<button className={secondary} disabled={busy} onClick={edit}>Edit</button>{draft?<button className={secondary} disabled={busy} onClick={keepPrivate}>Keep private</button>:<button className={secondary} disabled={busy} onClick={()=>void act('knowledge.withdraw',{postId:post.id,expectedRevision:post.revision})}>Withdraw contribution</button>}</div>{draft&&<details className="mt-4"><summary className="min-h-11 cursor-pointer py-2 text-sm text-board-muted">More sharing options</summary><p className="mt-2 max-w-prose text-sm leading-relaxed text-board-muted">Let your agent share this version.</p><div className="mt-3 flex flex-wrap gap-3"><button className={secondary} disabled={busy||post.approved} onClick={()=>void act('knowledge.approve',{postId:post.id,expectedRevision:post.revision})}>{post.approved?'This version is approved':'Approve this version for my agent'}</button><button className={secondary} disabled={busy} onClick={()=>void act('knowledge.withdraw',{postId:post.id,expectedRevision:post.revision})}>Withdraw contribution</button></div></details>}</div>)}

 </article>;
}
