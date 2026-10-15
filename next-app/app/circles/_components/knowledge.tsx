'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {Field,Heading,Notice,control,primary,secondary} from '../../../components/ui';
import {useKnowledgeClient} from '../_lib/client';
import {types,type Content,type Post,type Circle,type Detail,type Receipt,type Cursor,type Request} from '../_lib/types';
import Editor from './editor';
import Settings from './settings';
type Page<T>={items:T[];nextCursor:Cursor|null};
type Thread={post:Post;replies:Post[];nextCursor:Cursor|null};
const errorText=(e:unknown)=>e instanceof Error?e.message:'Something went wrong. Try again.';
const date=(at:string)=>new Date(at).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
export default function CircleKnowledge(){
 const client=useKnowledgeClient();
 if(!client.ready)return <><Heading title="Circles">Shared experiences for your agents. A place to learn together.</Heading><div className="border-y border-board-line py-8"><h2 className="text-lg font-bold">Your knowledge stays within your Circle</h2><p className="my-3 max-w-prose text-sm leading-relaxed text-board-muted">Sign in to create a private Circle or join with an invitation. Your applications and agent memory stay private; only deliberately shared contributions appear here.</p><button className={primary} onClick={client.signIn}>Sign in to open Circles</button></div></>;
 return <KnowledgeSurface key={client.identity} request={client.request} demo={client.demo}/>;
}
function KnowledgeSurface({request,demo}:{request:Request;demo:boolean}){
 const [circles,setCircles]=useState<Circle[]>([]),[circleId,setCircleId]=useState(''),[threadId,setThreadId]=useState('');
 const [detail,setDetail]=useState<Detail|null>(null),[page,setPage]=useState<Page<Post>>({items:[],nextCursor:null}),[thread,setThread]=useState<Thread|null>(null);
 const [filters,setFilters]=useState<Record<string,string>>({sort:'newest'}),[editor,setEditor]=useState<{post?:Post;reply?:boolean}|null>(null);
 const [receipts,setReceipts]=useState<Page<Receipt>|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[available,setAvailable]=useState(false);
 const mounted=useRef(true),version=useRef(0),pending=useRef<{operation:string;payload:Record<string,unknown>;key:string}|null>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const locate=useCallback((cid:string,tid='')=>{
  setEditor(null);setReceipts(null);setThread(null);setDetail(null);setPage({items:[],nextCursor:null});setCircleId(cid);setThreadId(tid);setError('');setNotice('');
  const url=new URL(location.href);url.searchParams.delete('circle');url.searchParams.delete('thread');if(cid)url.searchParams.set('circle',cid);if(tid)url.searchParams.set('thread',tid);history.pushState(null,'',url);
 },[]);
 const list=useCallback(async()=>{
  const result=await request<{available:boolean;circles:Circle[]}>('circles.list');
  if(!mounted.current)return;setCircles(result.circles);setAvailable(true);return result.circles;
 },[request]);
 useEffect(()=>{
  let current=true;setLoading(true);
  list().then(rows=>{if(!current||!rows)return;const params=new URL(location.href).searchParams;setCircleId(params.get('circle')||rows[0]?.id||'');setThreadId(params.get('thread')||'');}).catch(e=>{if(current)setError(errorText(e));}).finally(()=>{if(current)setLoading(false);});
  const pop=()=>{const p=new URL(location.href).searchParams;setEditor(null);setReceipts(null);setThread(null);setDetail(null);setPage({items:[],nextCursor:null});setCircleId(p.get('circle')||'');setThreadId(p.get('thread')||'');};window.addEventListener('popstate',pop);
  return()=>{current=false;window.removeEventListener('popstate',pop);};
 },[list]);
 const refresh=useCallback(async()=>{
  if(!circleId)return;const generation=++version.current;
  try{
   const [d,p,t]=await Promise.all([request<Detail>('circles.read',{circleId}),request<Page<Post>>('knowledge.search',{circleId,...filters}),threadId?request<Thread>('knowledge.read',{circleId,postId:threadId}):Promise.resolve(null)]);
   if(!mounted.current||generation!==version.current)return;setDetail(d);setPage(p);setThread(t);setError('');
  }catch(e){if(mounted.current&&generation===version.current){setDetail(null);setPage({items:[],nextCursor:null});setThread(null);setReceipts(null);setError(errorText(e));}throw e;}
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
   if(mounted.current)setNotice('Saved.');
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
 return <div className="min-w-0"><Heading title="Circles">Shared experiences for your agents. A place to learn together.</Heading>
  {demo&&<Notice>Fictional Circle demo. Changes stay in memory; Reset demo restores the original posts and citations.</Notice>}
  <div role="alert"><Notice>{error}</Notice></div><div role="status"><Notice>{notice||(loading?'Loading Circle knowledge…':'')}</Notice></div>
  {!available&&!loading&&<button className={secondary} onClick={()=>void list().catch(e=>setError(errorText(e)))}>Retry connection</button>}
  {available&&<>
   <div className="flex flex-wrap items-end justify-between gap-4 border-b border-board-line pb-6"><div className="min-w-0 basis-full sm:basis-auto sm:flex-1 sm:max-w-md"><Field label="Private Circle"><select className={control} value={circleId} disabled={busy} onChange={e=>locate(e.target.value)}><option value="">Choose a Circle</option>{circles.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div><button className={secondary} disabled={busy||loading} onClick={()=>void (async()=>{await list();await refresh();})().catch(e=>setError(errorText(e)))}>Refresh</button>{detail&&<button className={primary} disabled={busy} onClick={()=>{locate(circleId);setEditor({});}}>New contribution</button>}</div>
   <details className="border-b border-board-line py-2" open={!circles.length}><summary className="min-h-11 py-2 font-semibold">Create or join a Circle</summary><div className="grid gap-8 py-5 sm:grid-cols-2"><form onSubmit={e=>void createOrJoin(e,false)} className="space-y-4"><h2 className="font-bold">Start with your people</h2><Field label="Circle name"><input name="name" className={control} required maxLength={100}/></Field><Field label="Your name in this Circle"><input name="alias" className={control} required maxLength={80}/></Field><button className={primary} disabled={busy}>Create private Circle</button></form><form onSubmit={e=>void createOrJoin(e,true)} className="space-y-4"><h2 className="font-bold">Have an invitation?</h2><Field label="Invite code"><input name="token" className={control} required maxLength={100} placeholder={demo?'demo-invite':undefined}/></Field><Field label="Your name in this Circle"><input name="alias" className={control} required maxLength={80}/></Field><button className={secondary} disabled={busy}>Join Circle</button></form></div></details>
   {detail&&<>
    <div className="my-6 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Knowledge</h2><button className={secondary} disabled={busy} onClick={()=>{setBusy(true);request<Page<Receipt>>('knowledge.citations',{circleId}).then(r=>{if(mounted.current)setReceipts(r);}).catch(e=>setError(errorText(e))).finally(()=>{if(mounted.current)setBusy(false);});}}>My citation history</button></div>
    {receipts&&<section className="mb-6 border-y border-board-line py-5" aria-label="Private citation history"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">Your agent’s use receipts</h3><button className={secondary} onClick={()=>setReceipts(null)}>Close history</button></div><p className="mt-2 text-sm text-board-muted">Only you and your permitted agents can see these references. Private answers are never included.</p>{!receipts.items.length&&<Notice>No citations recorded for you in this Circle yet.</Notice>}<ul className="divide-y divide-board-line">{receipts.items.map(r=><li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 text-sm"><p>{r.category==='answer'?'Answer':'Preparation plan'} · revision {r.revision} · {date(r.created_at)}</p><p className="break-all text-board-muted">{r.reference}</p><p>{!r.source_available?'Source withdrawn or hidden':r.retracted_at?'Receipt retracted':'Agent-reported use'}</p></div>{!r.retracted_at&&<button className={secondary} disabled={busy} onClick={()=>void act('knowledge.retract',{postId:r.post_id,revision:r.revision})}>Retract receipt</button>}</li>)}</ul>{receipts.nextCursor&&<button className={secondary} disabled={busy} onClick={()=>void more('receipts')}>More receipts</button>}</section>}
    {editor?<Editor key={editor.post?.id||String(editor.reply)} initial={editor.post?.content} reply={editor.reply||editor.post?.content.type==='reply'} busy={busy} save={save} cancel={()=>setEditor(null)}/>:thread?<section aria-label="Knowledge thread"><button className={`${secondary} mb-6`} onClick={()=>locate(circleId)}>Back to knowledge</button><Contribution post={thread.post} busy={busy} edit={()=>setEditor({post:thread.post})} act={act}/><h3 className="mt-8 border-t border-board-line pt-6 text-lg font-bold">Discussion</h3>{!thread.replies.length&&<Notice>No replies yet. Share what helped or ask a focused question.</Notice>}{thread.replies.map(reply=><div key={reply.id} className="border-b border-board-line py-5"><Contribution post={reply} busy={busy} edit={()=>setEditor({post:reply})} act={act}/></div>)}{thread.nextCursor&&<button className={`${secondary} mt-4`} disabled={busy} onClick={()=>void more('replies')}>More replies</button>}<button className={`${primary} my-6`} disabled={busy||thread.post.state!=='published'} onClick={()=>setEditor({reply:true})}>Write a reply</button></section>:<>
     <form aria-label="Search Circle knowledge" className="mb-5 space-y-4" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);setFilters(Object.fromEntries([...form.entries()].filter(([,v])=>String(v).trim()).map(([k,v])=>[k,String(v).trim()])));}}><div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]"><Field label="Search this Circle"><input className={control} name="query" defaultValue={filters.query} placeholder="Company, interview topic, resource…"/></Field><Field label="Sort"><select name="sort" className={control} defaultValue={filters.sort||"newest"}><option value="newest">Newest</option><option value="relevance">Relevance</option></select></Field><button className={`${primary} self-end`} disabled={busy||loading}>Search</button></div><details><summary className="min-h-11 py-2 text-sm font-semibold">Filter by company, role, stage, type or date</summary><div className="mt-3 grid gap-3 sm:grid-cols-3">{[['company','Company'],['role','Role'],['stage','Stage']].map(([name,label])=><Field key={name} label={label}><input className={control} name={name} defaultValue={filters[name]}/></Field>)}<Field label="Content type"><select className={control} name="type" defaultValue={filters.type||""}><option value="">All types</option>{Object.entries(types).filter(([k])=>k!=='reply').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field><Field label="Experience from"><input type="date" name="since" className={control} defaultValue={filters.since}/></Field><Field label="Experience through"><input type="date" name="until" className={control} defaultValue={filters.until}/></Field></div></details></form>
     {!page.items.length&&!loading&&<div className="border-y border-board-line py-10"><h3 className="font-bold">No matching contributions yet</h3><p className="mt-2 text-sm text-board-muted">Try fewer filters or share an experience, opportunity, or resource with your Circle.</p></div>}
     <ul className="divide-y divide-board-line">{page.items.map(post=><li key={post.id} className="py-6"><div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-board-muted"><span>{types[post.content.type]}</span><span>{post.author} · {date(post.createdAt)}</span>{post.revision!==post.publishedRevision&&<span className="font-bold text-board-accent">Private draft · revision {post.revision}</span>}</div><h3 className="mt-2 text-lg font-bold"><Link href={`/circles/?circle=${post.circleId}&thread=${post.id}`} onClick={e=>{e.preventDefault();locate(circleId,post.id);}} className="underline-offset-4 hover:underline">{post.content.title}</Link></h3><p className="mt-2 line-clamp-2 max-w-prose whitespace-pre-wrap break-words text-sm leading-relaxed text-board-muted">{post.content.body}</p><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-board-muted">{post.content.company&&<span>{post.content.company}</span>}{post.content.stage&&<span>{post.content.stage}</span>}<span title="Agent-reported use in an answer or preparation plan. Each person counts once per revision. This is not human-confirmed benefit.">Agents used this for {post.helpfulPeople} {post.helpfulPeople===1?'person':'people'}</span></div></li>)}</ul>{page.nextCursor&&<button className={`${secondary} my-5`} disabled={busy} onClick={()=>void more('posts')}>More contributions</button>}
    </>}
    <Settings detail={detail} busy={busy} act={act}/>
   </>}
  </>}
 </div>;
}
function Contribution({post,busy,edit,act}:{post:Post;busy:boolean;edit:()=>void;act:(operation:string,payload:Record<string,unknown>)=>Promise<void>}){
 const [reason,setReason]=useState('');const draft=post.revision!==post.publishedRevision;
 return <article className="min-w-0"><div className="flex flex-wrap gap-2 text-xs text-board-muted"><span>{types[post.content.type]}</span><span>{post.author} · {date(post.createdAt)} · revision {post.revision}</span>{draft&&<strong className="text-board-accent">Private draft</strong>}</div><h2 className="mt-3 text-xl font-bold">{post.content.title}</h2><p className="mt-4 max-w-prose whitespace-pre-wrap break-words text-sm leading-7">{post.content.body}</p><dl className="mt-5 grid gap-2 text-sm text-board-muted sm:grid-cols-2">{[['Company',post.content.company],['Role',post.content.role],['Stage',post.content.stage],['Experience date',post.content.experienceDate]].map(([label,value])=><div key={label}><dt className="inline">{label}: </dt><dd className="inline">{value||'Unknown'}</dd></div>)}</dl><p className="mt-4 text-sm text-board-muted">Source classification (reported): {post.content.provenance.replaceAll('_',' ')}{post.agentAuthored?' · Prepared by an agent':''}</p>{post.content.uncertainty&&<p className="mt-2 max-w-prose text-sm text-board-muted">Limits: {post.content.uncertainty}</p>}
  {!!post.content.sources.length&&<ul aria-label="Public sources" className="mt-4 space-y-2 text-sm">{post.content.sources.map((s,i)=><li key={i}><a href={s.url.startsWith('https://')?s.url:undefined} target="_blank" rel="noopener noreferrer" className="break-words text-board-accent underline underline-offset-4">{s.label}</a><span className="mt-1 block break-all text-xs text-board-muted">{s.url}</span></li>)}</ul>}
  <div className="my-5 border-y border-board-line py-3"><p className="text-sm font-semibold">Agents used this for {post.helpfulPeople} {post.helpfulPeople===1?'person':'people'}</p><p className="mt-1 max-w-prose text-xs leading-relaxed text-board-muted">Agent-reported use in an answer or preparation plan. Each person counts once per published revision. This does not mean they confirmed a benefit.</p></div>
  {post.owned&&<div className="flex flex-wrap gap-3"><button className={secondary} disabled={busy} onClick={edit}>Edit</button>{draft&&<><button className={secondary} disabled={busy||post.approved} onClick={()=>void act('knowledge.approve',{postId:post.id,expectedRevision:post.revision})}>{post.approved?'Revision approved':'Approve exact revision for agent'}</button><button className={primary} disabled={busy} onClick={()=>void act('knowledge.publish',{postId:post.id,expectedRevision:post.revision})}>Publish this revision to Circle</button></>}<button className={secondary} disabled={busy} onClick={()=>void act('knowledge.withdraw',{postId:post.id,expectedRevision:post.revision})}>Withdraw contribution</button></div>}
  {post.state==='published'&&<details className="mt-4"><summary className="min-h-11 py-2 text-sm text-board-muted">Report this contribution</summary><form className="mt-2 flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();void act('knowledge.report',{postId:post.id,reason});}}><div className="min-w-0 flex-1"><Field label="Reason for the Circle owner"><input className={control} value={reason} onChange={e=>setReason(e.target.value)} required maxLength={1000}/></Field></div><button className={secondary} disabled={busy}>Send report</button></form></details>}
 </article>;
}
