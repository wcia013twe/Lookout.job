'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {Field,Heading,Notice,control,primary,secondary} from '../../../components/ui';
import {useKnowledgeClient} from '../_lib/client';
import {types,type Content,type Post,type Circle,type Detail,type Receipt,type Cursor,type Request} from '../_lib/types';
import Editor from './editor';
import Settings from './settings';
import AgentContext from './agent-context';
import CircleSearch from './search';
import CircleDashboard from './circle-views';
import {createCircleKnowledgeDemo} from '../../../../lib/circle-knowledge-demo.mjs';
type Page<T>={items:T[];nextCursor:Cursor|null};
type Thread={post:Post;replies:Post[];nextCursor:Cursor|null};
const errorText=(e:unknown)=>e instanceof Error?e.message:'Something went wrong. Try again.';
const date=(at:string)=>new Date(at).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
export default function CircleKnowledge(){
 const client=useKnowledgeClient();
 const [preview]=useState(()=>createCircleKnowledgeDemo());
 const previewRequest:Request=useCallback(async <Result,>(operation:string,payload:Record<string,unknown>={})=>preview.action(operation,payload) as Result,[preview]);
 if(!client.ready)return <><div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-board-line pb-4"><p className="max-w-prose text-xs leading-relaxed text-board-muted">Fictional Circle preview</p><button className={secondary} onClick={client.signIn}>Sign in to your Circle</button></div><KnowledgeSurface request={previewRequest} demo/></>;
 return <KnowledgeSurface key={client.identity} request={client.request} demo={client.demo}/>;
}
export function KnowledgeSurface({request,demo}:{request:Request;demo:boolean}){
 const [circles,setCircles]=useState<Circle[]>([]),[circleId,setCircleId]=useState(''),[threadId,setThreadId]=useState('');
 const [detail,setDetail]=useState<Detail|null>(null),[page,setPage]=useState<Page<Post>>({items:[],nextCursor:null}),[thread,setThread]=useState<Thread|null>(null);
 const [filters,setFilters]=useState<Record<string,string>>({sort:'newest'}),[editor,setEditor]=useState<{post?:Post;reply?:boolean}|null>(null);
 const [draftPosts,setDraftPosts]=useState<Post[]>([]);
 const [receipts,setReceipts]=useState<Page<Receipt>|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[available,setAvailable]=useState(false);
 const mounted=useRef(true),version=useRef(0),pending=useRef<{operation:string;payload:Record<string,unknown>;key:string}|null>(null);
 const detailRegion=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(thread||editor||receipts){detailRegion.current?.scrollIntoView({block:'start',behavior:'auto'});detailRegion.current?.focus({preventScroll:true});}},[thread?.post.id,!!editor,!!receipts]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const locate=useCallback((cid:string,tid='')=>{
  setEditor(null);setReceipts(null);setThread(null);setDetail(null);setDraftPosts([]);setPage({items:[],nextCursor:null});setCircleId(cid);setThreadId(tid);setError('');setNotice('');
  const url=new URL(location.href);url.searchParams.delete('circle');url.searchParams.delete('thread');if(cid)url.searchParams.set('circle',cid);if(tid)url.searchParams.set('thread',tid);history.pushState(null,'',url);
 },[]);
 const list=useCallback(async()=>{
  const result=await request<{available:boolean;circles:Circle[]}>('circles.list');
  if(!mounted.current)return;setCircles(result.circles);setAvailable(true);return result.circles;
 },[request]);
 useEffect(()=>{
  let current=true;setLoading(true);
  list().then(rows=>{if(!current||!rows)return;const params=new URL(location.href).searchParams;setCircleId(params.get('circle')||rows[0]?.id||'');setThreadId(params.get('thread')||'');}).catch(e=>{if(current)setError(errorText(e));}).finally(()=>{if(current)setLoading(false);});
  const pop=()=>{const p=new URL(location.href).searchParams;setEditor(null);setReceipts(null);setThread(null);setThreadId(p.get('thread')||'');if(p.get('circle'))setCircleId(p.get('circle')!);};window.addEventListener('popstate',pop);
  return()=>{current=false;window.removeEventListener('popstate',pop);};
 },[list]);
 const refresh=useCallback(async()=>{
  if(!circleId)return;const generation=++version.current;
  try{
   const [d,p,t,drafts]=await Promise.all([request<Detail>('circles.read',{circleId}),request<Page<Post>>('knowledge.search',{circleId,...filters}),threadId?request<Thread>('knowledge.read',{circleId,postId:threadId}):Promise.resolve(null),Object.keys(filters).some(key=>key!=='sort')?request<Page<Post>>('knowledge.search',{circleId,sort:'newest'}):Promise.resolve(null)]);
   if(!mounted.current||generation!==version.current)return;setDetail(d);setPage(p);setDraftPosts((drafts||p).items);setThread(t);setError('');
  }catch(e){if(mounted.current&&generation===version.current){setDetail(null);setDraftPosts([]);setPage({items:[],nextCursor:null});setThread(null);setReceipts(null);setError(errorText(e));}throw e;}
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
   if(operation==='circles.leave'){const rows=await list();locate(rows?.[0]?.id||'');}
   else if(operation==='knowledge.withdraw'||operation==='knowledge.hide'){locate(circleId);}
   else {await refresh();if(receipts){const r=await request<Page<Receipt>>('knowledge.citations',{circleId});if(mounted.current)setReceipts(r);}}
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
 async function more(kind:'posts'|'replies'|'receipts'){
  const generation=version.current;setBusy(true);try{
   if(kind==='posts'){const next=await request<Page<Post>>('knowledge.search',{circleId,...filters,cursor:page.nextCursor});if(mounted.current&&generation===version.current)setPage(old=>({items:[...old.items,...next.items],nextCursor:next.nextCursor}));}
   else if(kind==='replies'){const next=await request<Thread>('knowledge.read',{circleId,postId:threadId,cursor:thread!.nextCursor});if(mounted.current&&generation===version.current)setThread(old=>old?{...next,replies:[...old.replies,...next.replies]}:next);}
   else {const next=await request<Page<Receipt>>('knowledge.citations',{circleId,cursor:receipts!.nextCursor});if(mounted.current&&generation===version.current)setReceipts(old=>({items:[...(old?.items||[]),...next.items],nextCursor:next.nextCursor}));}
  }catch(e){if(mounted.current&&generation===version.current){setError(errorText(e));setThread(null);setReceipts(null);setPage({items:[],nextCursor:null});}}finally{if(mounted.current&&generation===version.current)setBusy(false);}
 }
 const privateDrafts=[...new Map([...draftPosts,...page.items].map(post=>[post.id,post])).values()].filter(post=>post.owned&&post.revision!==post.publishedRevision);
 return <div className="min-w-0">
  {!detail&&<Heading title="Circles">Your people, making progress together.</Heading>}
  <div role="alert"><Notice>{error}</Notice></div><div role="status"><Notice>{notice||(loading?'Loading Circle…':'')}</Notice></div>
  {!available&&!loading&&<button className={secondary} onClick={()=>void list().catch(error=>setError(errorText(error)))}>Retry connection</button>}
  {available&&!detail&&!loading&&<details className="border-b border-board-line py-2" open={!circles.length}><summary className="min-h-11 py-2 font-semibold">Create or join a Circle</summary><div className="grid gap-8 py-5 sm:grid-cols-2"><form onSubmit={e=>void createOrJoin(e,false)} className="space-y-4"><h2 className="font-bold">Start with your people</h2><Field label="Circle name"><input name="name" className={control} required maxLength={100}/></Field><Field label="Your name in this Circle"><input name="alias" className={control} required maxLength={80}/></Field><button className={primary} disabled={busy}>Create private Circle</button></form><form onSubmit={e=>void createOrJoin(e,true)} className="space-y-4"><h2 className="font-bold">Have an invitation?</h2><Field label="Invite code"><input name="token" className={control} required maxLength={100} placeholder={demo?'demo-invite':undefined}/></Field><Field label="Your name in this Circle"><input name="alias" className={control} required maxLength={80}/></Field><button className={secondary} disabled={busy}>Join Circle</button></form></div></details>}
  {detail&&<>
   <CircleDashboard key={circleId} busy={busy} save={save} detail={detail} posts={page.items} demo={demo} openPost={post=>locate(circleId,post.id)} focused={!!editor||!!thread||!!receipts} searching={Object.keys(filters).some(key=>key!=='sort')} search={<CircleSearch key={circleId} filters={filters} busy={busy||loading} search={setFilters}/>} controls={<div className="circle-header-controls">
    {circles.length>1&&<select aria-label="Switch Circle" className={control} value={circleId} disabled={busy} onChange={event=>locate(event.target.value)}>{circles.map(circle=><option key={circle.id} value={circle.id}>{circle.name}</option>)}</select>}
    {privateDrafts.length===1?<button className={secondary} disabled={busy} onClick={()=>locate(circleId,privateDrafts[0].id)}>1 draft to review</button>:privateDrafts.length>1?<details className="circle-header-menu"><summary>{privateDrafts.length} drafts to review</summary><ul className="circle-header-panel">{privateDrafts.map(post=><li key={post.id}><button className="min-h-11 w-full py-3 text-left text-sm" disabled={busy} onClick={()=>locate(circleId,post.id)}>{post.content.title}</button></li>)}</ul></details>:null}
    <details className="circle-header-menu"><summary>Settings</summary><div className="circle-header-panel"><h2 className="text-lg font-bold">Circle settings</h2><Settings detail={detail} busy={busy} act={act} embedded/><div className="flex flex-wrap gap-3 border-t border-board-line py-4"><button className={secondary} disabled={busy||loading} onClick={()=>void (async()=>{await list();await refresh();})().catch(error=>setError(errorText(error)))}>Refresh Circle</button><button className={secondary} disabled={busy} onClick={()=>{setBusy(true);request<Page<Receipt>>('knowledge.citations',{circleId}).then(r=>{if(mounted.current)setReceipts(r);}).catch(e=>setError(errorText(e))).finally(()=>{if(mounted.current)setBusy(false);});}}>My agent’s sources</button></div><details className="border-b border-board-line py-2" open={!circles.length}><summary className="min-h-11 py-2 font-semibold">Create or join a Circle</summary><div className="grid gap-8 py-5 sm:grid-cols-2"><form onSubmit={e=>void createOrJoin(e,false)} className="space-y-4"><h2 className="font-bold">Start with your people</h2><Field label="Circle name"><input name="name" className={control} required maxLength={100}/></Field><Field label="Your name in this Circle"><input name="alias" className={control} required maxLength={80}/></Field><button className={primary} disabled={busy}>Create private Circle</button></form><form onSubmit={e=>void createOrJoin(e,true)} className="space-y-4"><h2 className="font-bold">Have an invitation?</h2><Field label="Invite code"><input name="token" className={control} required maxLength={100} placeholder={demo?'demo-invite':undefined}/></Field><Field label="Your name in this Circle"><input name="alias" className={control} required maxLength={80}/></Field><button className={secondary} disabled={busy}>Join Circle</button></form></div></details></div></details>
    <button className={primary} disabled={busy} onClick={()=>{setThreadId('');setThread(null);setEditor({});setReceipts(null);}}>New conversation</button>
   </div>}/>
   {!editor&&!thread&&page.nextCursor&&<button className={secondary} disabled={busy} onClick={()=>void more('posts')}>More contributions</button>}
   {(!!editor||!!thread||!!receipts)&&<div ref={detailRegion} tabIndex={-1} className="py-6" style={{outline:'none'}}>
    {receipts&&<section className="mb-6 border-y border-board-line py-5" aria-label="Private citation history"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">Your agent’s use receipts</h3><button className={secondary} onClick={()=>setReceipts(null)}>Close history</button></div><p className="mt-2 text-sm text-board-muted">Only you and your permitted agents can see these references. Private answers are never included.</p>{!receipts.items.length&&<Notice>No citations recorded for you in this Circle yet.</Notice>}<ul className="divide-y divide-board-line">{receipts.items.map(r=><li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 text-sm"><p>{r.category==='answer'?'Answer':'Preparation plan'} · revision {r.revision} · {date(r.created_at)}</p><p className="break-all text-board-muted">{r.reference}</p><p>{!r.source_available?'Source withdrawn or hidden':r.retracted_at?'Receipt retracted':'Agent-reported use'}</p></div>{!r.retracted_at&&<button className={secondary} disabled={busy} onClick={()=>void act('knowledge.retract',{postId:r.post_id,revision:r.revision})}>Retract receipt</button>}</li>)}</ul>{receipts.nextCursor&&<button className={secondary} disabled={busy} onClick={()=>void more('receipts')}>More receipts</button>}</section>}

    {editor?<><p className="mb-4 text-sm leading-relaxed text-board-muted">Sharing with <strong className="text-board-text">{detail.circle.name}</strong>. Saving a draft does not publish it.</p><Editor key={editor.post?.id||String(editor.reply)} initial={editor.post?.content} reply={editor.reply||editor.post?.content.type==='reply'} busy={busy} save={save} cancel={()=>setEditor(null)}/></>:thread?<section aria-label="Shared experience" className="mx-auto max-w-[840px]">
     <button className={`${secondary} mb-6`} onClick={()=>locate(circleId)}>Back to Circle</button>
     {thread.post.owned&&thread.post.revision!==thread.post.publishedRevision&&<p className="mb-5 rounded-lg border border-board-line bg-board-panel p-4 text-sm leading-relaxed">Private draft · {thread.post.author} → {detail.circle.name}</p>}
     <Contribution post={thread.post} circleName={detail.circle.name} busy={busy} edit={()=>setEditor({post:thread.post})} keepPrivate={()=>locate(circleId)} act={act}/>
     {thread.post.state==='published'&&<section className="mt-10" aria-label="Conversation">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-semibold">Conversation{thread.replies.length>0&&<>{' '}<span className="ml-2 text-sm font-normal text-board-muted">{thread.replies.length}{thread.nextCursor?'+':''}</span></>}</h3><button className={secondary} disabled={busy} onClick={()=>setEditor({reply:true})}>Write a reply</button></div>
      {!thread.replies.length&&<p className="py-5 text-sm leading-7 text-board-muted">No replies yet. Add a note or ask a question.</p>}
      <div className="divide-y divide-board-line">{thread.replies.map(reply=><div key={reply.id} className="py-5"><Contribution post={reply} circleName={detail.circle.name} busy={busy} edit={()=>setEditor({post:reply})} keepPrivate={()=>locate(circleId)} act={act}/></div>)}</div>
      {thread.nextCursor&&<button className={`${secondary} mt-4`} disabled={busy} onClick={()=>void more('replies')}>More replies</button>}
     </section>}
    </section>:null}
   </div>}
  </>}
 </div>;
}

function Contribution({post,circleName,busy,edit,keepPrivate,act}:{post:Post;circleName:string;busy:boolean;edit:()=>void;keepPrivate:()=>void;act:(operation:string,payload:Record<string,unknown>)=>Promise<void>}){
 const [reason,setReason]=useState('');
 const draft=post.revision!==post.publishedRevision,reply=post.content.type==='reply';
 const name=post.author.replace(' (demo)','');
 return <article className={reply?'min-w-0':'min-w-0 rounded-2xl border border-board-line bg-board-panel p-5 sm:p-9'}>
  {!reply&&<h2 className="max-w-[28ch] break-words text-2xl font-bold leading-tight tracking-tight sm:text-[32px] sm:leading-[1.25]">{post.content.title}</h2>}
  <div className={`flex flex-wrap items-center gap-3 ${reply?'mb-3':'mb-7 mt-5'}`}>
   <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-board-tag text-xs font-semibold text-board-accent">{name.split(/\s+/).slice(0,2).map(part=>part[0]).join('')}</span>
   <div className="text-sm leading-6"><span className="font-semibold">{name}</span><span className="mx-2 text-board-muted" aria-hidden="true">·</span><time className="text-board-muted" dateTime={post.createdAt}>{date(post.createdAt)}</time></div>
   {!reply&&<span className="text-xs text-board-muted">{types[post.content.type]}</span>}
   {draft&&<strong className="text-xs text-board-accent">Private draft</strong>}
  </div>
  {reply?<p className="max-w-[70ch] whitespace-pre-wrap break-words text-base leading-7">{post.content.body}</p>:<AgentContext key={`${post.id}:${post.revision}`} post={post}/>}
  {!!post.content.sources.length&&<section className="border-t border-board-line py-5" aria-label="Public sources"><h3 className="text-sm font-semibold">Shared resources</h3><ul className="mt-2 space-y-2 text-sm">{post.content.sources.map((source,index)=><li key={index}><a href={source.url.startsWith('https://')?source.url:undefined} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-words text-board-accent underline underline-offset-4">{source.label}</a></li>)}</ul></section>}
  {!draft&&post.helpfulPeople>0&&<details className="border-t border-board-line py-2"><summary className="min-h-11 cursor-pointer py-3 text-xs text-board-muted">Used by agents for {post.helpfulPeople} {post.helpfulPeople===1?'person':'people'}</summary><p className="max-w-[65ch] pb-3 text-xs leading-6 text-board-muted">Agent-reported use in an answer or preparation plan. Each person counts once per published revision; this is not confirmed benefit.</p></details>}
  {post.owned&&(reply&&!draft?<details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-xs text-board-muted">Manage your reply</summary><div className="flex flex-wrap gap-3"><button className={secondary} disabled={busy} onClick={edit}>Edit</button><button className={secondary} disabled={busy} onClick={()=>void act('knowledge.withdraw',{postId:post.id,expectedRevision:post.revision})}>Withdraw contribution</button></div></details>:<div className="mt-6 border-t border-board-line pt-6"><div className="flex flex-wrap gap-3">{draft&&<button className={`${primary} max-w-full whitespace-normal`} disabled={busy} onClick={()=>void act('knowledge.publish',{postId:post.id,expectedRevision:post.revision})}>Share with {circleName}</button>}<button className={secondary} disabled={busy} onClick={edit}>Edit</button>{draft?<button className={secondary} disabled={busy} onClick={keepPrivate}>Keep private</button>:<button className={secondary} disabled={busy} onClick={()=>void act('knowledge.withdraw',{postId:post.id,expectedRevision:post.revision})}>Withdraw contribution</button>}</div>{draft&&<details className="mt-4"><summary className="min-h-11 cursor-pointer py-2 text-sm text-board-muted">More sharing options</summary><p className="mt-2 max-w-prose text-sm leading-relaxed text-board-muted">Let your agent share this version.</p><div className="mt-3 flex flex-wrap gap-3"><button className={secondary} disabled={busy||post.approved} onClick={()=>void act('knowledge.approve',{postId:post.id,expectedRevision:post.revision})}>{post.approved?'This version is approved':'Approve this version for my agent'}</button><button className={secondary} disabled={busy} onClick={()=>void act('knowledge.withdraw',{postId:post.id,expectedRevision:post.revision})}>Withdraw contribution</button></div></details>}</div>)}
  {post.state==='published'&&<details className={reply?'mt-1':'border-t border-board-line pt-2'}><summary className="min-h-11 cursor-pointer py-3 text-xs text-board-muted">Report this contribution</summary><form className="mt-2 flex flex-wrap items-end gap-3" onSubmit={event=>{event.preventDefault();void act('knowledge.report',{postId:post.id,reason});}}><div className="min-w-0 flex-1"><Field label="Reason for the Circle owner"><input className={control} value={reason} onChange={event=>setReason(event.target.value)} required maxLength={1000}/></Field></div><button className={secondary} disabled={busy}>Send report</button></form></details>}
 </article>;
}
