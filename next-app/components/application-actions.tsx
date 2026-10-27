"use client";
import {useEffect,useRef,useState} from 'react';
import {useWorkspace} from '../lib/workspace';
import {createBackend} from '../../backend/client.mjs';
import {roleApplication,roleApplied} from '../../lib/discover-application-state.mjs';
import {primary,secondary} from './ui';
import type {Role} from './role-card';
export default function ApplicationActions({role}:{role:Role}){
 const w=useWorkspace(),owner=w.demo?`demo-${w.demoEpoch}`:w.user?.id||null;
 return <Actions key={`${owner}:${role.id}`} role={role}/>;
}
function Actions({role}:{role:Role}){
 const w=useWorkspace(),owner=w.demo?'demo':w.user?.id||null;
 const app=roleApplication(role,w.state.workflow.applications);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState<{id:string;status:string}|null>(null);
 const pending=useRef<{signature:string;key:string}|null>(null),active=useRef(true);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const job=app?.executionJob&&(!saved||app.executionJob.id===saved.id)?app.executionJob:saved;
 const queued=job&&['queued','running'].includes(job.status),applied=roleApplied(role,w.state.workflow.applications,w.state.tracker.items);
 async function apply(){
  if(busy||queued||applied||w.locked)return;
  if(!owner){setError('Sign in to queue AI Apply.');return;}
  setBusy(true);setError('');
  const profileId=role.searchProfileId||role.rankingProfile?.id;
  const payload={posting:{id:role.id,url:role.applicationUrl,company:role.company,title:role.title,employmentType:role.employmentType,location:role.location||''},...(profileId?{profileId}:{}),expectedRevision:app?.backendRevision??0};
  const signature=JSON.stringify(payload);
  if(!pending.current||pending.current.signature!==signature||job&&!['queued','running'].includes(job.status))pending.current={signature,key:crypto.randomUUID()};
  try{
   const api=w.demo?w.services:createBackend(w.client,owner);
   const result=await api.queueApplicationJob({...payload,eventKey:pending.current.key});
   if(!active.current||!w.demo&&window.JB?.auth?.userId!==owner)return;
   setSaved(result.job);
   if(!w.demo)await window.JB?.cloud?.refresh?.();
  }catch(e){if(active.current)setError(e instanceof Error?e.message:'Application job could not queue. Your posting stays here.');}
  finally{if(active.current)setBusy(false);}
 }
 return <div className="mt-auto pt-1 md:pt-2"><div className="role-card-actions grid gap-2 min-[360px]:grid-cols-2">
  <button className={`${primary} w-full`} disabled={busy||!!queued||applied||w.locked} onClick={()=>void apply()}>{busy?'Queueing…':applied?'Applied':queued?'Queued':'AI Apply'}</button>
  <a className={`${secondary} w-full`} href={role.applicationUrl} target="_blank" rel="noopener noreferrer" onClick={e=>{if(w.demo)e.preventDefault();}}>Open Application</a>
 </div>{error&&<p role="alert" className="mt-2 text-sm text-board-warning">{error}</p>}{job&&!queued&&!applied&&<p role="status" className="mt-2 text-sm text-board-muted">{job.status==='cancelled'?'Application job cancelled.':job.status==='failed'?'Application job failed.':'Review the application and Action Board before retrying.'}</p>}{w.demo&&<p className="mt-2 text-xs text-board-muted">Fictional preview; no external submissions.</p>}</div>;
}
