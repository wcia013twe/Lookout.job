"use client";
import RoundListEditor,{type SavedRound} from './round-list-editor';
import {useRef,useState} from 'react';
import {IMPORT_PROGRESS_STAGES,validateImportedActions} from '../../lib/imported-actions.mjs';
import {control,secondary,primary,Field,Notice} from './ui';
export type ImportUpdate=(id:string,changes:Record<string,unknown>,expectedVersion:number,eventKey:string)=>Promise<number>;
const labels=['Opened','Applied','Screen','Interview','Offer'];
export default function ImportedApplicationTracking({row,version,update}:{row:any;version:number;update:ImportUpdate}) {
 const record=row.record;
 const [nextAction,setNextAction]=useState(record.nextAction||''),[actionDate,setActionDate]=useState(record.actionDate||''),[needsAction,setNeedsAction]=useState(record.needsAction===true),[completed,setCompleted]=useState<string[]>(record.completedStages||[]);
 const [rounds,setRounds]=useState<SavedRound[]>(record.rounds||[]);
 const [expectedVersion,setExpectedVersion]=useState(version),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const retry=useRef<{signature:string;eventKey:string}|null>(null);
 async function save(event:React.FormEvent){
  event.preventDefault();setBusy(true);setMessage('');
  try{
   const changes={rounds,nextAction:nextAction.trim()||null,actionDate:actionDate||null,needsAction,completedStages:IMPORT_PROGRESS_STAGES.filter(stage=>completed.includes(stage))};
   validateImportedActions({...record,...changes});
   const signature=JSON.stringify({changes,expectedVersion});
   if(retry.current?.signature!==signature)retry.current={signature,eventKey:`import-progress-${crypto.randomUUID()}`};
   const nextVersion=await update(row.id,changes,expectedVersion,retry.current!.eventKey);
   setExpectedVersion(nextVersion);retry.current=null;setMessage('Tracking saved.');
  }catch(error){setMessage(error instanceof Error?error.message:'Tracking could not save.');}
  finally{setBusy(false);}
 }
 const rank=IMPORT_PROGRESS_STAGES.indexOf(record.status);
 return <details data-import-tracking className="mt-4 border-t border-board-line pt-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Tracking details</summary>
 <form onSubmit={save} className="mt-3 grid gap-4">
 <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
 <RoundListEditor rounds={rounds} onChange={setRounds}/>
 <Field label="Next action"><input className={control} maxLength={300} value={nextAction} onChange={e=>setNextAction(e.target.value)}/></Field>
 <Field label="Action date (optional)"><input className={control} type="date" value={actionDate} onChange={e=>setActionDate(e.target.value)}/></Field>
 <label className="flex min-h-11 items-center gap-2 sm:col-span-2"><input type="checkbox" checked={needsAction} onChange={e=>setNeedsAction(e.target.checked)}/>Needs my action</label>
 <fieldset className="sm:col-span-2"><legend className="mb-1 text-sm font-semibold">Completed stages</legend><div className="flex flex-wrap gap-x-5">{IMPORT_PROGRESS_STAGES.map((stage,index)=><label key={stage} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={index<rank||(index===1&&rank>=1)||(rounds.some(r=>r.stage===stage&&!r.cancelled)?rounds.filter(r=>r.stage===stage&&!r.cancelled).every(r=>r.phase==='completed'):completed.includes(stage))} disabled={(rank>=0&&index>rank)||index<rank||(index===1&&rank>=1)||rounds.some(r=>r.stage===stage&&!r.cancelled)} onChange={e=>setCompleted(value=>e.target.checked?[...value,stage]:value.filter(s=>s!==stage))}/>{labels[index]}</label>)}</div></fieldset>
 </fieldset>
 <div className="flex flex-wrap items-center gap-3"><button className={primary} disabled={busy}>{busy?'Saving…':'Save tracking'}</button><button type="button" className={secondary} disabled={busy} onClick={()=>{setNextAction('');setActionDate('');setNeedsAction(false);}}>Clear next action</button></div><Notice>{message}</Notice>
 </form></details>;
}
