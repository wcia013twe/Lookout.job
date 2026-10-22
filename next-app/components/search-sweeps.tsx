"use client";
import Link from 'next/link';
import {useState} from 'react';
import {useWorkspace} from '../lib/workspace';
import {useSearchHarness,type SearchRun} from '../lib/search-harness';
import {Field,control,primary,secondary,Notice} from './ui';
function Sweeps(){
 const w=useWorkspace(),h=useSearchHarness();
 const [showRequest,setShowRequest]=useState(false),[profile,setProfile]=useState(''),[mode,setMode]=useState('fresh'),[selected,setSelected]=useState<SearchRun|null>(null),[nextOffset,setNextOffset]=useState<number|null>(null),[feedback,setFeedback]=useState('');
 const profiles:{id:string;name:string}[]=h.context?.profiles||[];const profileId=profile||profiles[0]?.id||'';
 async function inspect(id:string){h.setBusy(true);try{const [run,page]=await Promise.all([h.action('search.run.read',{runId:id}),h.action('search.discoveries.read',{runId:id})]);setSelected(run);h.setListings(page.listings);setNextOffset(page.nextOffset);}catch(e){h.setError(e instanceof Error?e.message:'Could not load run.');}finally{h.setBusy(false);}}
 async function request(){h.setBusy(true);try{await h.action('search.request',{profileId,mode,eventKey:crypto.randomUUID()});setFeedback(w.demo?'Fictional request queued in this preview; no agent is contacted.':'Request queued. Your personal agent must connect, poll its inbox, and perform the search.');await h.reload();setShowRequest(false);}catch(e){setFeedback(e instanceof Error?e.message:'Could not queue sweep.');}finally{h.setBusy(false);}}
 return <section className="mt-8 border-t border-board-line pt-5" aria-labelledby="agent-searches-title">
  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
   <h2 id="agent-searches-title" className="text-lg font-bold">Agent searches</h2>
   {(w.demo||w.user)&&<div className="flex items-center gap-4">
    <button className="min-h-11 text-sm text-board-muted hover:text-board-text disabled:opacity-50" disabled={h.busy} onClick={()=>{void h.reload();if(selected)void inspect(selected.id);}}>{h.busy?'Loading…':'Refresh'}</button>
    <button className="min-h-11 text-sm font-semibold text-board-accent hover:underline" aria-expanded={showRequest} aria-controls="search-request" onClick={()=>setShowRequest(!showRequest)}>{showRequest?'Cancel':'New search'}</button>
   </div>}
  </div>
  {w.demo||w.user?<>
   {showRequest&&<div id="search-request" className="border-b border-board-line pb-4 pt-2">
    {profiles.length?<form onSubmit={e=>{e.preventDefault();void request();}} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_200px_auto]">
     <Field label="Search profile"><select className={control} value={profileId} onChange={e=>setProfile(e.target.value)}>{profiles.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></Field>
     <Field label="Search window"><select className={control} value={mode} onChange={e=>setMode(e.target.value)}><option value="fresh">Past 72 hours</option><option value="backlog">Past 30 days</option></select></Field>
     <button className={primary} disabled={h.busy||w.locked||!profileId}>Request search</button>
    </form>:<p className="text-sm text-board-muted">Add a search profile in <Link className="text-board-accent underline" href="/profile/">your career context</Link>.</p>}
    <p className="mt-3 text-sm text-board-muted">Requests wait for your connected agent to start searching.</p>
   </div>}
   {!h.runs.length&&!h.busy&&<p className="py-3 text-sm text-board-muted">No searches yet. Request one to get started.</p>}
   <ul className="divide-y divide-board-line">{h.runs.map(run=><li key={run.id}>
    <button className="flex min-h-11 w-full items-center justify-between gap-4 rounded-lg py-3 text-left hover:bg-board-tag disabled:opacity-50" disabled={h.busy} aria-expanded={selected?.id===run.id} aria-controls="search-details" onClick={()=>{if(selected?.id===run.id)setSelected(null);else void inspect(run.id);}}>
     <span className="min-w-0"><span className="block text-sm font-semibold">{profiles.find(p=>p.id===run.profile_id)?.name||run.profile_id}</span><span className="mt-1 block text-xs text-board-muted">{run.created_at?new Date(run.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'Date unavailable'} · {run.mode==='fresh'?'Past 72 hours':'Past 30 days'}</span></span>
     <span className="flex shrink-0 items-center gap-3 text-sm"><span className="text-board-muted">{({active:'Searching',partial:'Incomplete',completed:'Completed',blocked:'Blocked',cancelled:'Cancelled'} as Record<string,string>)[run.state]||run.state}</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" className={selected?.id===run.id?'rotate-180':''}><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
    </button>
   </li>)}</ul>
   {selected&&<div id="search-details" className="mt-2 space-y-5 border-t border-board-line pt-4">
    <p className="max-w-prose text-sm text-board-muted">{selected.summary||'Your agent can resume this search from its saved progress.'}</p>
    <h3 className="font-semibold">Source coverage</h3>
    {selected.contextChanged&&<Notice>Targeting or source context changed after this sweep started. Its original context is retained; ask your agent to rescreen affected roles.</Notice>}
    <ul className="divide-y divide-board-line">{selected.sources?.map(s=><li key={s.source_id} className="py-3"><p className="break-words text-sm font-semibold">{s.source?.name||s.source?.query||s.source_id}</p><p className="mt-1 text-sm text-board-muted">{s.state} · Coverage: {s.coverage}</p>{s.blocker&&<p className="mt-2 text-sm">{s.blocker}</p>}<details className="mt-1"><summary className="min-h-11 py-3 text-sm">Saved checkpoint and counts</summary><pre className="overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify({checkpoint:s.checkpoint,counts:s.counts},null,2)}</pre></details></li>)}</ul>
    <h3 className="font-semibold">Discoveries awaiting decisions</h3>
    {!h.listings.length&&<p className="text-sm text-board-muted">No discoveries saved in this run.</p>}
    <ul className="divide-y divide-board-line">{h.listings.map(l=><li key={l.id} className="py-4"><p className="font-semibold">{l.company} · {l.title}</p><p className="mt-1 text-sm">{l.location||'Location unknown: review needed'}</p><p className="mt-2 text-sm text-board-muted">{l.screening?.decision||'review-needed'} · {l.observation?.liveness||'uncertain'}</p><p className="mt-2 max-w-prose text-sm">{l.screening?.explanation||'Your agent has not saved an eligibility decision.'}</p>{!!l.possibleDuplicates?.length&&<p className="mt-2 text-sm text-board-muted">Possible duplicate requisitions need review.</p>}{!!l.applications?.length&&<p className="mt-2 text-sm">Existing application: {l.applications.map((a:any)=>a.status).join(', ')}</p>}
     <details className="mt-2"><summary className="min-h-11 py-3 text-sm font-semibold">Employer evidence and eligibility</summary><dl className="space-y-2 text-sm"><div><dt className="text-board-muted">Employer publication date</dt><dd>{l.observation?.employer_posted_at||'Unknown'}</dd></div><div><dt className="text-board-muted">Source list age</dt><dd>{l.observation?.source_list_age_days==null?'Unknown':`${l.observation.source_list_age_days} days; employer date unverified`}</dd></div></dl><p className="mt-3 whitespace-pre-wrap text-sm">{l.observation?.evidence}</p><ul className="mt-3 space-y-2">{l.screening?.checks?.map((c:any)=><li key={c.requirement} className="text-sm"><strong>{c.requirement}: {c.status}</strong><p className="mt-1 text-board-muted">{c.evidence}</p></li>)}</ul><details className="mt-3"><summary className="min-h-11 py-3 text-sm">Archived job description</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed">{l.observation?.description||'No JD archived yet.'}</pre></details><p className="mt-2 break-all text-sm">{l.canonical_url}</p></details>
    </li>)}</ul>
    {nextOffset!==null&&<button className={secondary} disabled={h.busy} onClick={async()=>{h.setBusy(true);try{const page=await h.action('search.discoveries.read',{runId:selected.id,offset:nextOffset});h.setListings([...h.listings,...page.listings]);setNextOffset(page.nextOffset);}catch(e){h.setError(String(e));}finally{h.setBusy(false);}}}>Load more discoveries</button>}
    {selected.state==='active'&&<p className="text-sm text-board-muted">Ask your agent: “Resume Lookout search run {selected.id} using its saved source checkpoints.”</p>}
   </div>}
  </>:<p className="text-sm text-board-muted">Sign in to see your agent’s search history.</p>}
  <Notice>{h.error||feedback}</Notice>
 </section>;
}
export default function SearchSweeps(){const w=useWorkspace();return <Sweeps key={w.demo?`demo-${w.demoEpoch}`:w.user?.id||'guest'} />;}
