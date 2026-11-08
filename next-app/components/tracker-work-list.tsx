"use client";
import {useState} from 'react';
import Link from 'next/link';
import DiscoveredRoleWidget from './discovered-role-widget';
export type TrackerWork={key:string;sourceId:string;version:number;company:string;role:string;action:string;note?:string;observedOutcome?:string;state:string;href:string;anchor?:string;humanActionHref?:string};
const labels:Record<string,string>={approved:'Approved · waiting for Muse',started:'Muse is working',completed:'Muse reported completion',rejected:'Agent work stopped',blocked:'Need your input',uncertain:'Check the outcome before retrying',superseded:'Source changed · review the current task'};
export default function TrackerWorkList({items,busy,onRespond,onDemoProgress}:{items:TrackerWork[];busy:boolean;onRespond:(item:TrackerWork,response:string,input?:Record<string,unknown>)=>Promise<void>;onDemoProgress?:(item:TrackerWork,stage:string)=>Promise<void>}){
 return items.length?<section className="mt-5 border-t border-board-line pt-4" aria-label="Tracker action pipeline"><h3 className="font-semibold">With Muse · {items.length}</h3><p className="mt-1 text-xs text-board-muted">Your decision → change feed → Muse → saved outcome. Approval keeps the task pending.</p><ul className="mt-3 space-y-3">{items.map(item=><WorkRow key={item.key} {...{item,busy,onRespond,onDemoProgress}}/>)}</ul></section>:null;
}
function WorkRow({item,busy,onRespond,onDemoProgress}:{item:TrackerWork;busy:boolean;onRespond:(item:TrackerWork,response:string,input?:Record<string,unknown>)=>Promise<void>;onDemoProgress?:(item:TrackerWork,stage:string)=>Promise<void>}){
 const [note,setNote]=useState(''),[checked,setChecked]=useState(false);
 const canReopen=['rejected','blocked','uncertain'].includes(item.state),verification=['blocked','uncertain'].includes(item.state)||item.observedOutcome==='uncertain';
 return <li id={item.anchor} className="scroll-mt-4 rounded-xl border border-board-line p-3" data-tracker-state={item.state}>
  <DiscoveredRoleWidget compact role={{id:item.sourceId,company:item.company,title:item.role}}/>
  <p className="mt-3 text-sm font-semibold">{labels[item.state]||item.state}</p><p className="mt-1 text-sm">{item.action}</p>{item.note&&<p className="mt-2 whitespace-pre-wrap text-sm text-board-muted">{item.note}</p>}
  {canReopen&&verification&&<div className="mt-3"><label className="grid gap-2 text-sm">What did you check or resolve?<textarea className="min-h-20 rounded-lg border border-board-line bg-board-bg p-3" value={note} maxLength={1000} disabled={busy} onChange={e=>setNote(e.target.value)}/></label><label className="mt-2 flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={checked} disabled={busy} onChange={e=>setChecked(e.target.checked)}/>I checked the blocker or external outcome before reopening.</label></div>}
  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs"><Link className="inline-flex min-h-11 items-center underline underline-offset-4" href={`${item.href}&returnTo=%2Fneeds-you%2F`}>View owning record</Link>
   {canReopen&&<button className="min-h-11 rounded-lg border border-board-line px-3 font-semibold disabled:opacity-40" disabled={busy||(verification&&(!checked||!note.trim()))} onClick={()=>void onRespond(item,'resume_tracker',verification?{note,confirmed:checked}:undefined)}>Reopen for review</button>}
   {['approved','started','blocked','uncertain'].includes(item.state)&&<button className="min-h-11 rounded-lg border border-board-line px-3 font-semibold text-board-warning" disabled={busy} onClick={()=>void onRespond(item,'stop_tracker')}>Stop agent work</button>}
   {onDemoProgress&&['approved','started'].includes(item.state)&&<button className="min-h-11 rounded-lg border border-board-line px-3" disabled={busy} onClick={()=>void onDemoProgress(item,item.state==='approved'?'started':'completed')}>{item.state==='approved'?'Demo: Muse picks up':'Demo: save outcome'}</button>}
  </div>
 </li>;
}
