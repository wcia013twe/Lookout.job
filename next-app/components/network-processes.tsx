"use client";
import {useEffect,useState,type FormEvent} from 'react';
import {useWorkspace} from '../lib/workspace';
import {useOutreach} from '../lib/outreach';
import {useNetworkCompanies} from '../lib/network';
import {companyIndex,companyKey,contactsForProcess,processContactDraft} from '../../lib/network-model.mjs';
import {trackerProgress} from '../../lib/tracker-display.mjs';
import {sortApplications} from '../../lib/application-timeline.mjs';
import {safeUrl,contactType} from '../../lib/outreach-model.mjs';
import {CompanyLogo} from './role-card';
import {MessageEditor,type ContactRecord} from './referrals';
import DraftReview from './draft-review';
import ProfileSurface from './profile-surface';
import {Field,Notice,control,primary,secondary} from './ui';
import type {Application} from './workflow-types';

export default function NetworkProcesses({onOpenTarget}:{onOpenTarget:(id:string)=>void}){
 const w=useWorkspace(),outreach=useOutreach(),network=useNetworkCompanies(outreach);
 const [selected,setSelected]=useState(''),[person,setPerson]=useState(''),[adding,setAdding]=useState(false),[feedback,setFeedback]=useState(''),[review,setReview]=useState<string|null>(null),[query,setQuery]=useState('');
 const all:Application[]=[...new Set<string>([...w.state.tracker.ids,...Object.keys(w.state.workflow.applications)])].map(id=>({...w.roles.find((r:Application)=>r.id===id),...w.state.workflow.applications[id],id,status:w.state.workflow.applications[id]?.status||w.state.tracker.items[id]?.status||'New',questions:w.state.workflow.applications[id]?.questions||[]})).filter(a=>a.company&&a.title&&(!w.demo||network.rows.some((row:{record:{name:string}})=>companyKey(row.record.name)===companyKey(a.company))));
 const active:Application[]=sortApplications(all).filter((a:Application)=>{const stage=trackerProgress(a,w.state.tracker.items[a.id]);return stage.level>=1&&!['Rejected','Withdrawn'].includes(stage.status);});
 const visible=active.filter(a=>`${a.company} ${a.title}`.toLowerCase().includes(query.toLowerCase()));
 const application=visible.find(a=>a.id===selected)||visible[0];
 const linked:ContactRecord[]=application?contactsForProcess(outreach.contacts,application):[];
 const contact=linked.find(c=>c.id===person)||linked[0];
 const candidates:ContactRecord[]=application?[...outreach.contacts,...(w.state.network.people||[]).map((c:ContactRecord)=>({...c,contact:c.contact||c.name}))].filter((c:ContactRecord)=>(c.companyId&&application.companyId?c.companyId===application.companyId:companyKey(c.company)===companyKey(application.company))&&!linked.some(l=>l.id===c.id)):[];
 const targets=companyIndex(network.rows,outreach.contacts,all);
 const target=application?targets.find(t=>t.applications.some(a=>a.id===application.id)):null;
 useEffect(()=>{const id=new URL(location.href).searchParams.get('process');if(id)setSelected(id);},[]);
 function open(id:string){setSelected(id);setPerson('');setAdding(false);setFeedback('');history.replaceState(null,'',`?view=processes&process=${encodeURIComponent(id)}`);}
 function prepare(person:ContactRecord){
  if(!application)return;
  const draft=processContactDraft(person,application,crypto.randomUUID());
  outreach.setContacts([...outreach.contacts,draft]);setPerson(draft.id);setAdding(false);setFeedback('A separate draft is ready for this role. Review the message before sending.');
 }
 function add(e:FormEvent<HTMLFormElement>){e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget)) as Record<string,string>;if(!data.contact.trim())return;if(data.linkedin&&!safeUrl(data.linkedin,true)){setFeedback('Use an HTTPS LinkedIn profile URL.');return;}prepare(data as ContactRecord);}
 function update(fields:Partial<ContactRecord>){if(contact)outreach.setContacts(outreach.contacts.map((c:ContactRecord)=>c.id===contact.id?{...c,...fields}:c));}
 async function copyRequest(){if(!application)return;try{await navigator.clipboard.writeText(`Use read_guide("cold-outreach") to prepare targeted outreach for my existing Lookout process: ${application.company} — ${application.title}. Read my owned application and list_contacts first. Reuse relevant company research and verified candidate facts. Preserve other contacts and drafts. Save each role-specific draft with save_contact, its current expectedRevision (0 for a new ID), company, title, jobUrl ${application.url||application.applicationUrl||'(read from the owned application)'}, and tags ["application:${application.backendId||application.id}"]. Keep contact identity sourced and the message specific to this role. Do not send messages, claim a reply, or change application status.`);setFeedback('Process outreach request copied. Send it to your agent; copying does not start work.');}catch{setFeedback('Copy failed. Ask your agent to prepare outreach for this company and role using the cold-outreach guide.');}}
 return <ProfileSurface>
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><h2 className="text-lg font-semibold">Active applications</h2><div className="w-full sm:max-w-xs"><Field label="Find an active company or role"><input className={control} type="search" value={query} onChange={e=>setQuery(e.target.value)}/></Field></div></div>
  {!application?<div className="border-t border-board-line py-10"><h3 className="text-xl font-semibold">{active.length?'No matching processes':'Your next process starts with an application'}</h3><p className="mt-3 max-w-prose text-sm text-board-muted">{active.length?'Try another company or role.':'Applied roles, recruiter screens, interviews, and offers appear here. Use Targets to build connections before a process begins.'}</p></div>:<>
   <div className="mb-5 lg:hidden"><Field label="Active process"><select className={control} aria-label="Active process" value={application.id} onChange={e=>open(e.target.value)}>{visible.map(a=><option value={a.id} key={a.id}>{a.company} — {a.title}</option>)}</select></Field></div>
   <div className="grid items-start gap-7 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,2fr)]">
    <aside className="hidden min-w-0 border-r border-board-line pr-5 lg:block" aria-label="Active applications"><ul className="space-y-2">{visible.map(a=><li key={a.id}><button type="button" aria-pressed={a.id===application.id} onClick={()=>open(a.id)} className={`w-full rounded-lg p-3 text-left focus-visible:outline-2 focus-visible:outline-board-accent ${a.id===application.id?'bg-board-tag':'hover:bg-board-tag'}`}><span className="flex items-start gap-3"><CompanyLogo company={a.company}/><span className="min-w-0"><span className="block break-words text-sm font-semibold">{a.company}</span><span className="mt-1 block break-words text-sm text-board-muted">{a.title}</span><span className="mt-2 block text-xs text-board-accent">{trackerProgress(a,w.state.tracker.items[a.id]).status} · {contactsForProcess(outreach.contacts,a).length} outreach</span></span></span></button></li>)}</ul></aside>
    <section className="min-w-0" aria-label="Selected process outreach">
     <header className="flex flex-wrap items-start justify-between gap-4 border-b border-board-line pb-5"><div className="min-w-0"><p className="text-sm text-board-muted">{application.company} · {trackerProgress(application,w.state.tracker.items[application.id]).status}</p><h3 className="mt-1 break-words text-xl font-semibold">{application.title}</h3></div><button className={secondary} onClick={()=>setReview(application.id)}>Open application</button></header>
     <div className="my-5 flex flex-wrap gap-2"><button className={linked.length?secondary:primary} disabled={w.locked} onClick={()=>{setAdding(!adding);setFeedback('');}} aria-expanded={adding}>Add process contact</button><button className={secondary} onClick={copyRequest}>Copy outreach request</button>{target&&<button className={secondary} onClick={()=>onOpenTarget(target.id)}>Company research</button>}</div>
     <Notice>{feedback}</Notice>
     {adding&&<form onSubmit={add} className="my-6 space-y-4 border-y border-board-line py-5"><h4 className="font-semibold">Add someone for this role</h4><div className="grid gap-4 sm:grid-cols-2"><Field label="Contact name"><input className={control} name="contact" required maxLength={200}/></Field><Field label="Contact type"><select className={control} name="contactType" defaultValue="recruiter"><option value="recruiter">Recruiter</option><option value="engineer">Engineer</option><option value="manager">Hiring manager</option><option value="alumni">Alumni</option><option value="other">Other</option></select></Field><Field label="LinkedIn profile (optional)"><input className={control} type="url" name="linkedin"/></Field></div><div className="flex gap-3"><button className={primary} disabled={w.locked}>Create process draft</button><button type="button" className={secondary} onClick={()=>setAdding(false)}>Cancel</button></div></form>}
     {linked.length?<><nav className="my-5 flex flex-wrap gap-2" aria-label="Process contacts">{linked.map(c=><button key={c.id} type="button" className={`min-h-11 border-b-2 px-3 py-2 text-sm font-semibold ${c.id===contact?.id?'border-board-accent text-board-text':'border-transparent text-board-muted hover:text-board-text'}`} aria-pressed={c.id===contact?.id} onClick={()=>setPerson(c.id)}>{c.contact||c.name} · {c.status||'Not asked'}</button>)}</nav>{contact&&<div className="rounded-xl border border-board-line p-5"><MessageEditor key={contact.id} contact={contact} update={update} remove={()=>{outreach.setContacts(outreach.contacts.filter((c:ContactRecord)=>c.id!==contact.id));setPerson('');}}/></div>}</>:<div className="py-7"><h4 className="font-semibold">No outreach linked to this role yet</h4><p className="mt-2 max-w-prose text-sm leading-relaxed text-board-muted">Add your recruiter or start a role-specific draft from a company contact below. Company matches alone don’t establish involvement in this process.</p></div>}
     {!!candidates.length&&<details className="mt-7 border-t border-board-line pt-3" open={!linked.length}><summary className="cursor-pointer font-semibold">Other people at {application.company}</summary><p className="my-3 text-sm text-board-muted">Existing company contacts. Their involvement in this process is unconfirmed.</p><ul className="divide-y divide-board-line">{candidates.map(c=><li className="flex flex-wrap items-center justify-between gap-3 py-4" key={c.id}><div className="min-w-0"><p className="break-words text-sm font-semibold">{c.contact||c.name}</p><p className="mt-1 text-xs text-board-muted">{contactType(c)} · {c.status||'Not asked'}</p></div><button className={secondary} disabled={w.locked} onClick={()=>prepare(c)}>Prepare for this role</button></li>)}</ul></details>}
     <p className="mt-6 text-xs text-board-muted">{w.demo?'Fictional demo. Edits stay in memory.':outreach.status} Copying or drafting a message never sends it.</p>
    </section>
   </div>
  </>}
  {review&&<DraftReview key={review} id={review} onClose={()=>setReview(null)}/>}
 </ProfileSurface>;
}
