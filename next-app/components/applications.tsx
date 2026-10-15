"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useWorkspace } from '../lib/workspace';
import ApplicationList from './application-list';
import SkippedOpportunities from './skipped-opportunities';
import { trackerProgress } from '../../legacy/tracker-display.mjs';
import type { Application } from './workflow-types';
import './tracker.css';
export default function Applications() {
 const w=useWorkspace();
 const [search,setSearch]=useState(''),[type,setType]=useState(''),[stage,setStage]=useState(''),[closed,setClosed]=useState(false);
 const ids=[...new Set<string>([...w.state.tracker.ids,...Object.keys(w.state.workflow.applications)])];
 const all:Application[]=ids.map(id=>({...w.roles.find((r:Application)=>r.id===id),...w.state.workflow.applications[id],id,status:w.state.workflow.applications[id]?.status || w.state.tracker.items[id]?.status || 'New',questions:w.state.workflow.applications[id]?.questions || []})).filter(a=>a.company && a.title);
 const items=all.filter(a=>{const status=trackerProgress(a,w.state.tracker.items[a.id]).status;return closed===['Rejected','Withdrawn'].includes(status)&&(!type||a.employmentType===type)&&(!stage||status===stage)&&`${a.company} ${a.title}`.toLowerCase().includes(search.toLowerCase());});
 return <div className="tracker-surface">
 <header className="tracker-page-header workspace-heading"><div><h1 className="font-bold">Your Job Tracker</h1><div className="tracker-header-tabs"><span>{all.length} TOTAL JOBS</span><button aria-pressed={!closed} onClick={()=>setClosed(false)}>Active</button><button aria-pressed={closed} onClick={()=>setClosed(true)}>Closed</button></div></div><Link href="/" className="tracker-button tracker-primary tracker-browse-cta workspace-primary inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">Browse roles</Link></header>
 <div className="tracker-filters"><input aria-label="Search tracked roles" placeholder="Search for roles or companies" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Job type" value={type} onChange={e=>setType(e.target.value)}><option value="">Job type · All</option><option value="FT">Full-time</option><option value="Internship">Internship</option></select><select aria-label="Hiring stage" value={stage} onChange={e=>setStage(e.target.value)}><option value="">Status · All</option>{['Opened','Applied','Screen','Interview','Offer','Rejected','Withdrawn'].map(s=><option key={s}>{s}</option>)}</select></div>
 <div className="tracker-list-meta"><p><strong>{items.length}</strong> roles <span className="tracker-counter">{items.filter(a=>a.employmentType==='FT').length} full-time</span><span className="tracker-counter">{items.filter(a=>a.employmentType==='Internship').length} internships</span></p>{(search||type||stage)&&<button className="tracker-button workspace-secondary inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={()=>{setSearch('');setType('');setStage('');}}>Clear filters</button>}<span>List view</span></div>
 <ApplicationList items={items}/>
 {!items.length&&<div className="tracker-empty"><h2>{all.length?'No matching roles':'Your next opportunity starts here'}</h2><p>{all.length?'Try another search or clear your filters.':'Open a role from Discover to track it. Opening a role is separate from applying.'}</p><Link href="/" className="tracker-button tracker-primary workspace-primary inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">Browse roles</Link></div>}
 <SkippedOpportunities/>
 </div>;
}
