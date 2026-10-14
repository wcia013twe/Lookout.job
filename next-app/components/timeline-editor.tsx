"use client";
import { useRef, useState } from 'react';
import { createBackend } from '../../backend/client.mjs';
import { useWorkspace } from '../lib/workspace';
import { control, primary, Field, Notice } from './ui';
import type { FormEvent } from 'react';
import type { Application, ApplicationMilestone } from './workflow-types';
const labels: Record<string, string>={submitted:'Application submitted',recruiter_call:'Recruiter call',technical_round:'Technical round 1',interview:'Interview',offer:'Offer received',rejected:'Application rejected',withdrawn:'Application withdrawn'};
type MilestonePayload = { kind: string; label: string; phase: ApplicationMilestone['phase']; occurredAt: string | null; source: ApplicationMilestone['source']; eventKey: string };
export default function TimelineEditor({application}: { application: Application }) {
 const w=useWorkspace(),owner=w.demo?'demo':w.user?.id||'guest';
 const [kind,setKind]=useState('recruiter_call'),[label,setLabel]=useState(labels.recruiter_call),[phase,setPhase]=useState<ApplicationMilestone['phase']>('completed'),[date,setDate]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const retry=useRef<{ signature: string; payload: MilestonePayload } | null>(null),ownerRef=useRef(owner);ownerRef.current=owner;
 async function save(event: FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage('');
  try{
  const occurredAt=date?new Date(date).toISOString():null;
  const payload={kind,label:label.trim(),phase,occurredAt,source:{kind:'user',note:note.trim(),...(occurredAt?{timestampConfirmed:true}:{})}};
  const signature=JSON.stringify(payload);
  if(!retry.current||retry.current.signature!==signature)retry.current={signature,payload:{...payload,eventKey:`user-milestone-${crypto.randomUUID()}`}};
   let row: ApplicationMilestone;
   if(w.demo||w.user){
    if(!application.backendId)throw Error('Wait for this application to sync before recording its timeline.');
    row=await (w.services||createBackend(w.client,w.user.id)).recordApplicationMilestone(application.backendId,retry.current.payload);
   }else row={id:retry.current.payload.eventKey,application_id:application.id,kind,label:payload.label,phase,occurred_at:occurredAt,source:payload.source,created_at:new Date().toISOString()};
   if(ownerRef.current!==owner)return;
   if(w.user&&window.JB.auth.userId!==w.user.id)return;
   w.store.update('workflow.applications',(apps: Record<string, Application>)=>({...apps,[application.id]:{...apps[application.id],milestones:[...(apps[application.id]?.milestones||[]).filter(item=>item.id!==row.id),row]}}));
   retry.current=null;setMessage('Timeline update recorded.');
  }catch(error){if(ownerRef.current===owner)setMessage(error instanceof Error ? error.message : 'Timeline could not save. Try again.');}
  finally{if(ownerRef.current===owner)setBusy(false);}
 }
 return <form onSubmit={save} className="glass-inset mt-4 space-y-4 rounded-xl p-4">
  <p className="text-sm text-board-muted">Record a stage yourself. Leave the date blank if it has not been confirmed.</p>
  <fieldset disabled={busy||w.locked} className="grid gap-4 sm:grid-cols-2">
   <Field label="Timeline stage"><select className={control} value={kind} onChange={e=>{setKind(e.target.value);setLabel(labels[e.target.value]);}}>{Object.entries(labels).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></Field>
   <Field label="Stage name"><input className={control} required maxLength={300} value={label} onChange={e=>setLabel(e.target.value)}/></Field>
   <Field label="Stage progress"><select className={control} value={phase} onChange={e=>setPhase(e.target.value as ApplicationMilestone['phase'])}><option value="completed">Completed</option><option value="scheduled">Scheduled</option><option value="received">Update received</option></select></Field>
   <Field label="Confirmed date and time (optional)"><input type="datetime-local" className={control} value={date} onChange={e=>setDate(e.target.value)}/></Field>
   <Field label="Round notes (private)"><textarea className={control} placeholder="Topics covered, reminders, contacts, or your interview experience" maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></Field>
  </fieldset>
  <button className={primary} disabled={busy||w.locked}>{busy?'Saving…':'Record timeline update'}</button>
  <Notice>{message}</Notice>
 </form>;
}
