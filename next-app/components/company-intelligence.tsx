'use client';
import Link from 'next/link';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useKnowledgeClient} from '../app/circles/_lib/client';
import {types,type Post,type Cursor} from '../app/circles/_lib/types';
import {Field,Notice,control,primary,secondary} from './ui';
type Page={items:Post[];nextCursor:Cursor|null};
export default function CompanyIntelligence({company,companyId}:{company:string;companyId?:string|null}){
 const client=useKnowledgeClient();
 const [filters,setFilters]=useState<Record<string,string>>({}),[page,setPage]=useState<Page>({items:[],nextCursor:null}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const generation=useRef(0),active=useRef(true);
 const identity=`${client.identity}:${companyId||company}:${JSON.stringify(filters)}`;
 const latest=useRef(identity);latest.current=identity;
 const payload={scope:'current_memberships',...(companyId?{companyId}:{company}),...filters};
 async function load(more=false){const id=++generation.current,started=identity;setBusy(true);setError('');try{const result=await client.request<Page>('knowledge.search',{...payload,...(more?{cursor:page.nextCursor}:{})});if(active.current&&id===generation.current&&latest.current===started)setPage(old=>({items:more?[...old.items,...result.items]:result.items,nextCursor:result.nextCursor}));}catch(e){if(active.current&&id===generation.current&&latest.current===started){setPage({items:[],nextCursor:null});setError(e instanceof Error?e.message:'Circle intelligence could not load.');}}finally{if(active.current&&id===generation.current&&latest.current===started)setBusy(false);}}
 useEffect(()=>{active.current=true;setPage({items:[],nextCursor:null});if(client.ready)void load();const refresh=()=>{if(document.visibilityState==='visible')void load();};const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);return()=>{active.current=false;generation.current++;clearInterval(timer);window.removeEventListener('focus',refresh);};},[identity,client.ready]);
 function search(event:FormEvent<HTMLFormElement>){event.preventDefault();setFilters(Object.fromEntries([...new FormData(event.currentTarget)].map(([k,v])=>[k,String(v).trim()]).filter(([,v])=>v)));}
 if(!client.ready)return <p className="py-5 text-sm text-board-muted">Sign in to read company experiences shared in your current Circles.</p>;
 return <section aria-label="Circle intelligence"><h2 className="text-lg font-semibold">Circle intelligence at {company}</h2><p className="mt-2 max-w-prose text-sm leading-relaxed text-board-muted">Published experiences from your current Circles. Dates and context reflect what each person shared.</p>
 <form onSubmit={search} className="my-6 flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><Field label="Search shared experiences"><input name="query" className={control} maxLength={500}/></Field></div><Field label="Role"><input name="role" className={control} maxLength={200}/></Field><Field label="Stage"><input name="stage" className={control} maxLength={200}/></Field><button className={primary} disabled={busy}>Search intelligence</button></form>
 <div role="status"><Notice>{busy?'Loading shared experiences…':error}</Notice></div>{error&&<button className={secondary} onClick={()=>void load()}>Retry intelligence</button>}
 {!busy&&!error&&!page.items.length&&<p className="py-6 text-sm text-board-muted">No matching published experiences in your current Circles.</p>}
 <ul className="divide-y divide-board-line">{page.items.map(post=><li key={post.id} className="py-6"><p className="text-xs text-board-muted">{post.circleName} · {post.author} · Shared {new Date(post.createdAt).toLocaleDateString()}</p><h3 className="mt-2 break-words text-lg font-semibold">{post.content.title}</h3><p className="mt-2 text-xs text-board-muted">{types[post.content.type]||post.content.type} · {post.content.experienceDate?`Experience ${post.content.experienceDate}`:'Experience date unknown'}</p>{post.companyContexts?.filter(c=>companyId?c.companyId===companyId:c.company?.toLowerCase()===company.toLowerCase()).map((c,i)=><p key={i} className="mt-2 text-sm text-board-muted">{[c.company,c.role,c.stage].filter(Boolean).join(' · ')}</p>)}<p className="mt-3 max-w-prose whitespace-pre-wrap break-words text-sm leading-relaxed">{post.content.insight||post.content.body}</p>{post.content.uncertainty&&<p className="mt-3 max-w-prose text-xs text-board-muted">{post.content.uncertainty}</p>}<Link className="mt-3 inline-flex min-h-11 items-center text-sm text-board-accent underline underline-offset-4" href={`/circles/?circle=${encodeURIComponent(post.circleId)}&thread=${encodeURIComponent(post.id)}`}>Open source thread</Link></li>)}</ul>
 {page.nextCursor&&<button className={secondary} disabled={busy} onClick={()=>void load(true)}>More shared experiences</button>}
 </section>;
}
