"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useWorkspace } from '../lib/workspace';
import { applicationStats } from '../../lib/application-stats.mjs';
import ProfileIcon, {type ProfileIconName} from './profile-icon';
import ApplicationList from './application-list';
import SkippedOpportunities from './skipped-opportunities';
import { trackerProgress } from '../../lib/tracker-display.mjs';
import type { Application } from './workflow-types';
import './tracker.css';
import {useSimplifyImports} from '../lib/simplify-import';
import {importedApplication} from '../../lib/simplify-import.mjs';
import ImportSearchHandoff from './import-search-handoff';
const ApplicationFlowChart=dynamic(()=>import('./application-flow-chart'),{ssr:false,loading:()=> <p role="status" className="mt-6 text-sm text-board-muted">Loading application flow…</p>});
export default function Applications() {
 const w=useWorkspace(),imports=useSimplifyImports();
 const [search,setSearch]=useState(''),[type,setType]=useState(''),[stage,setStage]=useState(''),[view,setView]=useState('Active');
 const ids=[...new Set<string>([...w.state.tracker.ids,...Object.keys(w.state.workflow.applications)])];
 const native:Application[]=ids.map(id=>({...w.roles.find((r:Application)=>r.id===id),...w.state.workflow.applications[id],id,status:w.state.workflow.applications[id]?.status || w.state.tracker.items[id]?.status || 'New',questions:w.state.workflow.applications[id]?.questions || []})).filter(a=>a.company && a.title);
 const all:Application[]=[...native,...imports.records.map(importedApplication).filter((a:Application)=>!native.some(n=>(a.url&&n.url===a.url)||(n.company.toLowerCase()===a.company.toLowerCase()&&n.title.toLowerCase()===a.title.toLowerCase()&&(n.location||'').toLowerCase()===(a.location||'').toLowerCase())))];
 useEffect(()=>{const requested=new URL(location.href).searchParams.get('application');const application=all.find(item=>item.backendId===requested);if(application){const status=trackerProgress(application,w.state.tracker.items[application.id]).status;setView(['Rejected','Withdrawn'].includes(status)?'Closed':status==='Opened'?'Saved jobs':'Active');}},[w.user?.id,w.demo,all.map(item=>`${item.backendId}:${trackerProgress(item,w.state.tracker.items[item.id]).status}`).join(',')]);
 const stats=applicationStats(all,w.state.tracker.items);
 const metrics:{label:string;value:number;icon:ProfileIconName;color:string}[]=[
  {label:'Tracked jobs',value:stats.tracked,icon:'briefcase',color:'text-board-accent'},
  {label:'Applications',value:stats.applied,icon:'send',color:'text-board-accent'},
  {label:'Interviews',value:stats.interviewing,icon:'conversation',color:'text-board-warning'},
  {label:'Offers',value:stats.offers,icon:'award',color:'text-board-success'},
 ];
 const items=all.filter(a=>{const status=trackerProgress(a,w.state.tracker.items[a.id]).status;const group=a.archived||['Rejected','Withdrawn'].includes(status)?'Closed':status==='Opened'?'Saved jobs':'Active';return view===group&&(!type||a.employmentType===type)&&(!stage||status===stage)&&`${a.company} ${a.title}`.toLowerCase().includes(search.toLowerCase());});
 return <div className="tracker-surface">
 <header className="tracker-page-header workspace-heading"><div><h1 className="font-bold">Your Job Tracker</h1><div className="tracker-header-tabs"><span>{all.length} TOTAL JOBS</span>{['Active','Saved jobs','Closed','Stats'].map(name=><button key={name} aria-pressed={view===name} onClick={()=>{setView(name);setStage('');}}>{name}</button>)}</div></div><Link href="/" className="tracker-button tracker-primary tracker-browse-cta workspace-primary inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">Browse roles</Link></header>
 {imports.error&&<p role="status" className="tracker-prose">Imported history: {imports.error}</p>}
 {view==='Stats' ? <section aria-label="Application stats" className="py-6">
 <h2 className="text-xl font-semibold">Application stats</h2>
 <p className="mt-2 text-sm text-board-muted">Across your tracker and imported history. Interviews and offers show current active outcomes.</p>
 <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">{metrics.map(metric=><div key={metric.label} className="rounded-xl border border-board-line bg-board-panel p-4 sm:p-5"><dt className="flex flex-col items-start gap-3 text-sm text-board-muted"><span className={`grid size-10 place-items-center rounded-lg bg-board-tag ${metric.color}`}><ProfileIcon name={metric.icon} width={22} height={22}/></span>{metric.label}</dt><dd className="mt-2 text-3xl font-semibold tabular-nums">{metric.value}</dd></div>)}</dl>
 <ApplicationFlowChart applications={all} trackerItems={w.state.tracker.items}/>
 </section> : <>
 <ImportSearchHandoff key={imports.scope} imports={imports}/>
 <div className="tracker-filters"><input aria-label="Search tracked roles" placeholder="Search for roles or companies" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Job type" value={type} onChange={e=>setType(e.target.value)}><option value="">Job type · All</option><option value="FT">Full-time</option><option value="Internship">Internship</option></select><select aria-label="Hiring stage" value={stage} onChange={e=>setStage(e.target.value)}><option value="">Status · All</option>{['Opened','Applied','Screen','Interview','Offer','Rejected','Withdrawn'].map(s=><option key={s}>{s}</option>)}</select></div>
 <div className="tracker-list-meta"><p><strong>{items.length}</strong> roles <span className="tracker-counter">{items.filter(a=>a.employmentType==='FT').length} full-time</span><span className="tracker-counter">{items.filter(a=>a.employmentType==='Internship').length} internships</span></p>{(search||type||stage)&&<button className="tracker-button workspace-secondary inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={()=>{setSearch('');setType('');setStage('');}}>Clear filters</button>}<span>List view</span></div>
 <ApplicationList items={items}/>
 {view==='Saved jobs'&&<p className="tracker-prose">Opened roles you haven’t applied to yet, including drafts in preparation.</p>}
 {!items.length&&<div className="tracker-empty"><h2>{all.length?'No matching roles':'Your next opportunity starts here'}</h2><p>{all.length?'Try another search or clear your filters.':'Open a role from Discover to track it. Opening a role is separate from applying.'}</p><Link href="/" className="tracker-button tracker-primary workspace-primary inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">Browse roles</Link></div>}
 <SkippedOpportunities/>
 </>}
 </div>;
}
