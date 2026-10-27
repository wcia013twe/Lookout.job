'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useWorkspace} from '../../../lib/workspace';
import {trackerProgress} from '../../../../lib/tracker-display.mjs';
import {Field,Notice,control,primary,secondary} from '../../../components/ui';
import ApiError from '../../../components/api-error';
import {types,type Post,type Cursor,type Request} from '../_lib/types';
type Page={items:Post[];nextCursor:Cursor|null};
export default function CompanyDiscussions({request,openPost}:{request:Request;openPost:(post:Post)=>void}){
 const w=useWorkspace();
 const [filters,setFilters]=useState({query:'',company:''}),[page,setPage]=useState<Page>({items:[],nextCursor:null}),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const generation=useRef(0),identity=JSON.stringify(filters),latest=useRef(identity);latest.current=identity;
 const companies=[...new Set<string>([...(w.state?.tracker?.ids||[]),...Object.keys(w.state?.workflow?.applications||{})].map(id=>{
  const row={...w.roles?.find((role:{id:string})=>role.id===id),...w.state?.workflow?.applications?.[id]};
  const stage=trackerProgress(row,w.state?.tracker?.items?.[id]||{}).status;
  return row.company&&!['Rejected','Withdrawn'].includes(stage)?row.company:'';
 }).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 async function load(more=false){
  const version=++generation.current,started=identity;setBusy(true);setError('');
  try{const result=await request<Page>('knowledge.search',{scope:'current_memberships',sort:'newest',limit:20,...(filters.query?{query:filters.query}:{}),...(filters.company?{company:filters.company}:{}),...(more?{cursor:page.nextCursor}:{})});
   if(version===generation.current&&latest.current===started)setPage(old=>({items:more?[...old.items,...result.items]:result.items,nextCursor:result.nextCursor}));
  }catch(e){if(version===generation.current&&latest.current===started){setPage({items:[],nextCursor:null});setError(e instanceof Error?e.message:'Discussions could not load.');}}
  finally{if(version===generation.current&&latest.current===started)setBusy(false);}
 }
 useEffect(()=>{setPage({items:[],nextCursor:null});void load();return()=>{generation.current++;};},[request,identity]);
 function search(event:FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);setFilters({company:String(data.get('company')||'').trim(),query:String(data.get('query')||'').trim()});}
 return <section aria-labelledby="company-discussions-title" className="max-w-4xl">
  <h2 id="company-discussions-title" className="text-xl font-semibold">Company discussions</h2>
  <p className="mt-2 max-w-prose text-sm leading-7 text-board-muted">Recruiting updates, interview experiences, and advice across your Circles. Only conversations you have access to appear here.</p>
  <form key={identity} onSubmit={search} className="my-6 flex flex-wrap items-end gap-3">
   <div className="min-w-0 flex-1 basis-64"><Field label="Search discussions"><input className={control} name="query" defaultValue={filters.query} maxLength={500} placeholder="Roles, interview experiences, recruiting updates…"/></Field></div>
   <div className="min-w-0 flex-1 basis-40"><Field label="Company"><input className={control} name="company" defaultValue={filters.company} maxLength={200} placeholder="Any company"/></Field></div>
   <button className={primary} disabled={busy}>Search</button>
   {(filters.query||filters.company)&&<button type="button" className={secondary} disabled={busy} onClick={()=>setFilters({query:'',company:''})}>Clear search</button>}
  </form>
  {!!companies.length&&<section aria-label="Companies from your applications" className="mb-7"><h3 className="text-sm font-semibold">Companies from your applications</h3><div className="mt-3 flex flex-wrap gap-2">{companies.map(company=><button type="button" key={company} aria-pressed={filters.company===company} className={filters.company===company?primary:secondary} onClick={()=>setFilters({query:'',company:filters.company===company?'':company})}>{company}</button>)}</div></section>}
  <div role="status">{busy&&<Notice>Finding discussions…</Notice>}</div>
  <ApiError message={error} onRetry={()=>void load()}/>
  {!busy&&!error&&!page.items.length&&<p className="border-t border-board-line py-6 text-sm leading-7 text-board-muted">{filters.company||filters.query?'No matching discussions in your Circles. Try a different company or clear your search.':'No shared discussions yet. Open one of your Circles to start a conversation.'}</p>}
  <ul className="divide-y divide-board-line">{page.items.map(post=><li key={post.id} className="py-5">
   <p className="text-xs leading-6 text-board-muted">{[post.circleName,post.author,post.content.experienceDate||'Experience date unknown'].filter(Boolean).join(' · ')}</p>
   <h3 className="mt-1 break-words text-lg font-semibold"><button type="button" className="min-h-11 text-left hover:underline underline-offset-4" onClick={()=>openPost(post)}>{post.content.title}</button></h3>
   <p className="mt-1 text-xs leading-6 text-board-muted">{[post.content.company,...(post.companyContexts||[]).map(context=>context.company),post.content.role,post.content.stage,types[post.content.type]].filter((value,index,all)=>value&&all.indexOf(value)===index).join(' · ')}</p>
   <p className="mt-2 line-clamp-3 max-w-prose whitespace-pre-wrap break-words text-sm leading-7">{post.content.insight||post.content.body}</p>
   <button type="button" className="mt-2 inline-flex min-h-11 items-center text-sm text-board-accent underline underline-offset-4" onClick={()=>openPost(post)}>Read and discuss</button>
  </li>)}</ul>
  {page.nextCursor&&<button className={secondary} disabled={busy} onClick={()=>void load(true)}>More discussions</button>}
 </section>;
}
