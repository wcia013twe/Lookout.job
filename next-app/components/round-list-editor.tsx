"use client";
import {useState,type ReactNode} from 'react';
import {ROUND_STAGES,ROUND_TYPES} from '../../lib/application-rounds.mjs';
import {control,secondary,Field} from './ui';
export type SavedRound={id:string;label:string;stage:string;type:string;phase:string;date:string|null;notes:string;cancelled:boolean};
function RoundDisclosure({initialOpen,children}:{initialOpen:boolean;children:ReactNode}){const [open,setOpen]=useState(initialOpen);return <details className="rounded-lg border border-board-line p-3" open={open} onToggle={e=>setOpen(e.currentTarget.open)}>{children}</details>;}
export default function RoundListEditor({rounds,onChange}:{rounds:SavedRound[];onChange:(rounds:SavedRound[])=>void}){
 const update=(id:string,changes:Partial<SavedRound>)=>onChange(rounds.map(row=>row.id===id?{...row,...changes}:row));
 return <div className="sm:col-span-2"><div className="flex items-center justify-between gap-3"><h4 className="font-semibold">Rounds</h4><button type="button" className={secondary} disabled={rounds.length>=100} onClick={()=>onChange([...rounds,{id:crypto.randomUUID(),label:'New round',stage:'INTERVIEW',type:'other',phase:'received',date:null,notes:'',cancelled:false}])}>Add round</button></div>
 <div className="mt-2 space-y-2">{rounds.map((round,index)=><RoundDisclosure key={round.id} initialOpen={round.label==='New round'}><summary className="min-h-11 cursor-pointer py-2 text-sm"><strong>{index+1}. {round.label}</strong><span className="ml-2 text-board-muted">{round.stage==='SCREEN'?'Screen':'Interview'} · {round.cancelled?'Cancelled':round.phase==='received'?'Pending':round.phase==='scheduled'?'Scheduled':'Completed'}</span></summary>
 <div className="grid gap-3 sm:grid-cols-2">
 <Field label="Round name"><input className={control} required maxLength={300} value={round.label} onChange={e=>update(round.id,{label:e.target.value})}/></Field>
 <Field label="Round stage"><select className={control} value={round.stage} onChange={e=>update(round.id,{stage:e.target.value})}>{ROUND_STAGES.map(stage=><option key={stage} value={stage}>{stage==='SCREEN'?'Screen':'Interview'}</option>)}</select></Field>
 <Field label="Round type"><select className={control} value={round.type} onChange={e=>update(round.id,{type:e.target.value})}>{ROUND_TYPES.map(type=><option key={type} value={type}>{type.replaceAll('_',' ')}</option>)}</select></Field>
 <Field label="Round progress"><select className={control} value={round.cancelled?'cancelled':round.phase} onChange={e=>update(round.id,e.target.value==='cancelled'?{cancelled:true}:{phase:e.target.value,cancelled:false})}><option value="received">Pending</option><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></Field>
 <Field label="Round date (optional)"><input type="date" className={control} value={round.date?.slice(0,10)||''} onChange={e=>update(round.id,{date:e.target.value||null})}/></Field>
 <Field label="Round notes"><textarea className={control} maxLength={2000} value={round.notes} onChange={e=>update(round.id,{notes:e.target.value})}/></Field>
 <div className="flex gap-2 sm:col-span-2"><button type="button" className={secondary} disabled={!index} onClick={()=>{const next=[...rounds];[next[index-1],next[index]]=[next[index],next[index-1]];onChange(next);}}>Move up</button><button type="button" className={secondary} disabled={index===rounds.length-1} onClick={()=>{const next=[...rounds];[next[index+1],next[index]]=[next[index],next[index+1]];onChange(next);}}>Move down</button></div>
 </div></RoundDisclosure>)}</div></div>;
}
