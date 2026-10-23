'use client';
import Link from 'next/link';
import ApiError from './api-error';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useKnowledgeClient} from '../app/circles/_lib/client';
import {types,type Post,type Cursor} from '../app/circles/_lib/types';
import {Field,Notice,control,primary,secondary} from './ui';
type Takeaway={text:string;postId:string;circleId:string;label:string};
type Page={items:Post[];nextCursor:Cursor|null};
export default function CompanyIntelligence({company,companyId,exampleTakeaways}:{company:string;companyId?:string|null;exampleTakeaways?:Takeaway[]}){
 const client=useKnowledgeClient();
 const [filters,setFilters]=useState<Record<string,string>>({}),[page,setPage]=useState<Page>({items:[],nextCursor:null}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const generation=useRef(0),active=useRef(true);
 const identity=`${client.identity}:${companyId||company}:${JSON.stringify(filters)}`;
 const latest=useRef(identity);latest.current=identity;
 const payload={limit:3,scope:'current_memberships',...(companyId?{companyId}:{company}),...filters};
 async function load(more=false){const id=++generation.current,started=identity;setBusy(true);setError('');try{const result=await client.request<Page>('knowledge.search',{...payload,...(more?{cursor:page.nextCursor}:{})});if(active.current&&id===generation.current&&latest.current===started)setPage(old=>({items:more?[...old.items,...result.items]:result.items,nextCursor:result.nextCursor}));}catch(e){if(active.current&&id===generation.current&&latest.current===started){setPage({items:[],nextCursor:null});setError(e instanceof Error?e.message:'Circle intelligence could not load.');}}finally{if(active.current&&id===generation.current&&latest.current===started)setBusy(false);}}
 useEffect(()=>{active.current=true;setPage({items:[],nextCursor:null});if(client.ready)void load();const refresh=()=>{if(client.ready&&document.visibilityState==='visible')void load();};const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);return()=>{active.current=false;generation.current++;clearInterval(timer);window.removeEventListener('focus',refresh);};},[identity,client.ready]);
 function search(event:FormEvent<HTMLFormElement>){event.preventDefault();setFilters(Object.fromEntries([...new FormData(event.currentTarget)].map(([k,v])=>[k,String(v).trim()]).filter(([,v])=>v)));}
 if(client.connectionState==='loading')return <Notice>Connecting to your Circle account…</Notice>;
 if(client.connectionState==='unavailable')return <ApiError message="Circle client initialization failed [CLIENT_UNAVAILABLE]. Reload the page to reconnect." onRetry={()=>location.reload()}/>;
 if(!client.ready)return <section className="border-t border-board-line pt-6"><h3 className="text-lg font-semibold">From your Circles</h3><p className="mt-2 text-sm text-board-muted">Sign in to see experiences your Circles have shared about {company}.</p></section>;
 return <section aria-label="Circle intelligence" className="border-t border-board-line pt-6 lg:border-t-0 lg:pt-0">
 <h3 className="text-lg font-semibold">From your Circles</h3><p className="mt-2 max-w-prose text-sm leading-relaxed text-board-muted">Recent experiences shared about {company}. Open a conversation for the full context.</p>
 {client.demo&&!!exampleTakeaways?.length&&<div className="mt-4"><h4 className="text-base font-semibold">What this means for you</h4><p className="mt-1 text-xs text-board-muted">Example takeaway from fictional conversations.</p><ul className="mt-3 space-y-4">{exampleTakeaways.map(item=><li key={item.postId}><p className="max-w-prose text-sm leading-7">{item.text}</p><Link className="inline-flex min-h-11 items-center text-xs text-board-accent underline underline-offset-4" href={`/circles/?circle=${encodeURIComponent(item.circleId)}&thread=${encodeURIComponent(item.postId)}`}>{item.label}</Link></li>)}</ul></div>}
 <details open={!exampleTakeaways?.length} className="mt-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Source conversations</summary>
 <details className="mt-2"><summary className="min-h-11 cursor-pointer py-3 text-sm text-board-muted">Find a specific experience</summary>
  <form onSubmit={search} className="mb-4 grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Search shared experiences"><input name="query" className={control} maxLength={500}/></Field></div><Field label="Role"><input name="role" className={control} maxLength={200}/></Field><Field label="Stage"><input name="stage" className={control} maxLength={200}/></Field><div className="flex flex-wrap gap-3 sm:col-span-2"><button className={primary} disabled={busy}>Search experiences</button>{Object.keys(filters).length>0&&<button type="button" className={secondary} disabled={busy} onClick={()=>setFilters({})}>Clear search</button>}</div></form>
 </details>
 {busy&&<Notice>Checking your Circles…</Notice>}<ApiError message={error} onRetry={()=>void load()}/>
 {!busy&&!error&&!page.items.length&&<p className="py-3 text-sm text-board-muted">{Object.keys(filters).length?'No experiences match that search. Try another role or clear your search.':'No shared experiences about this company yet.'}</p>}
 <ul className="divide-y divide-board-line">{page.items.map(post=><li key={post.id} className="py-5">
  <p className="text-xs text-board-muted">{post.author.replace(' (demo)','')} · {post.circleName?.replace(' (demo)','')} · {post.content.experienceDate||'Experience date unknown'}</p>
  <h4 className="mt-2 break-words text-base font-semibold">{post.content.title}</h4>
  <p className="mt-1 text-xs text-board-muted">{[types[post.content.type]||post.content.type,post.content.role,post.content.stage].filter(Boolean).join(' · ')}</p>
  <p className="mt-3 max-w-prose whitespace-pre-wrap break-words text-sm leading-7 text-board-muted">{post.content.insight||post.content.body}</p>
  {post.content.uncertainty&&<details className="mt-2"><summary className="min-h-11 cursor-pointer py-3 text-xs text-board-muted">Context & limits</summary><p className="max-w-prose pb-3 text-xs leading-relaxed text-board-muted">{post.content.uncertainty}</p></details>}
  <Link className="mt-2 inline-flex min-h-11 items-center text-sm text-board-accent underline underline-offset-4" href={`/circles/?circle=${encodeURIComponent(post.circleId)}&thread=${encodeURIComponent(post.id)}`}>Read conversation</Link>
 </li>)}</ul>
 {page.nextCursor&&<button className={secondary} disabled={busy} onClick={()=>void load(true)}>More experiences</button>}
 </details>
 </section>;
}
