"use client";
import {WorkIndicator} from './apply-work-flag';
import {applicationRequestLabel} from "../../lib/application-request-state.mjs";
import {useActionBoard} from '../lib/use-action-board';
import {ApplicationWorkControl} from './decision-buttons';
import {useEffect,useRef,useState} from 'react';
import {useWorkspace} from '../lib/workspace';
import {createBackend} from '../../backend/client.mjs';
import {roleApplication,roleApplied} from '../../lib/discover-application-state.mjs';
import {primary,secondary} from './ui';
import type {Role} from './role-card';
export default function ApplicationActions({role,onPreview}:{role:Role;onPreview?:(role:Role)=>void}){
 const w=useWorkspace(),owner=w.demo?`demo-${w.demoEpoch}`:w.user?.id||null;
 return <Actions key={`${owner}:${role.id}`} role={role} onPreview={onPreview}/>;
}
function Actions({role,onPreview}:{role:Role;onPreview?:(role:Role)=>void}){
 const w=useWorkspace(),owner=w.demo?'demo':w.user?.id||null;
 const app=roleApplication(role,w.state.workflow.applications);
 const board=useActionBoard(),held=board.snapshot?.holds.some(h=>h.application_id===app?.backendId&&!h.resumed_at);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState<{id:string;status:string;version?:number;result?:Record<string,unknown>}|null>(null);
 const pending=useRef<{signature:string;key:string}|null>(null),active=useRef(true);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const current=app?.executionJob;
 const job=current&&(!saved||current.id===saved.id&&Number(current.version||0)>=Number(saved.version||0))?current:saved;
 const queued=job&&['queued','running'].includes(job.status),applied=roleApplied(role,w.state.workflow.applications,w.state.tracker.items);
 async function demoStep(){
  if(!w.demo||!job||busy)return;
  setBusy(true);setError('');
  try{
   const payload={jobId:job.id,expectedVersion:job.version,expectedRevision:app?.backendRevision||0,eventKey:crypto.randomUUID()};
   const result=job.status==='queued'?await w.services.claimApplicationRequest(payload):await w.services.reportApplicationRequest({...payload,outcome:'prepared',summary:'Fictional draft checked. Ready for review; no employer form opened or submission made.'});
   if(active.current)setSaved(result.job);
  }catch(e){setError(e instanceof Error?e.message:'Demo step failed.');}finally{setBusy(false);}
 }
 async function apply(){
  if(busy||queued||applied||held||w.locked)return;
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
   document.dispatchEvent(new CustomEvent('workspace:cloud-ready',{detail:{userId:owner}}));
   if(!w.demo)await window.JB?.cloud?.refresh?.();
  }catch(e){if(active.current)setError(e&&typeof e==='object'&&'message' in e&&typeof e.message==='string'?e.message:'Application job could not queue. Your posting stays here.');}
  finally{if(active.current)setBusy(false);}
 }
 return <div className="mt-auto pt-1 md:pt-2"><div className="role-card-actions grid gap-2 min-[360px]:grid-cols-2">
  <button className={`${primary} w-full`} disabled={busy||!!queued||applied||held||w.locked} onClick={()=>void apply()}>{!held&&!busy&&!applied&&job?.status==='running'&&<WorkIndicator working/>}{held?'Agent work stopped':busy?'Queueing…':applied?'Applied':queued?(job?.status==='running'?'Working':'Queued'):'AI Apply'}</button>
  {onPreview ? <button type="button" className={`${secondary} w-full`} onClick={()=>onPreview(role)} aria-haspopup="dialog">Preview Job</button> : <a className={`${secondary} w-full`} href={role.applicationUrl} target="_blank" rel="noopener noreferrer" onClick={e=>{if(w.demo)e.preventDefault();}}>Open Application</a>}
 </div>{app?.backendId&&held&&<ApplicationWorkControl applicationId={app.backendId}/>} {error&&<p role="alert" className="mt-2 text-sm text-board-warning">{error}</p>}{job&&!applied&&<p role="status" className="mt-2 text-sm text-board-muted">{applicationRequestLabel(job)}</p>}{w.demo&&queued&&<button type="button" className={`${secondary} mt-2`} disabled={busy} onClick={()=>void demoStep()}>{job?.status==='queued'?'Demo: Muse picks up':'Demo: save outcome'}</button>}{w.demo&&<p className="mt-2 text-xs text-board-muted">Fictional preview; no external submissions.</p>}</div>;
}
