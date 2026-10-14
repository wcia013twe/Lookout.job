"use client";
import { useEffect, useRef, useState } from 'react';
import { createBackend } from '../../backend/client.mjs';
import { useWorkspace } from '../lib/workspace';
import Preparation from './preparation';
import { Notice, secondary } from './ui';
export default function ApplicationPreparation({application}) {
 const w=useWorkspace(), owner=w.user?.id||null;
 const [row,setRow]=useState(null), [loading,setLoading]=useState(!!owner), [error,setError]=useState(''), [retry,setRetry]=useState(0);
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  let active=true;
  setRow(null);setError('');
  if(!owner) {setLoading(false);return;}
  if(!application.backendId){setLoading(false);setError('This application has not synced yet. Retry after account sync.');return;}
  setLoading(true);
  createBackend(w.client,owner).readPreparation(application.backendId).then(value=>{if(active && window.JB.auth.userId===owner)setRow(value);}).catch(()=>{if(active)setError('Preparation could not load. Retry to get the current plan.');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[owner,application.backendId,retry,w.client]);
 async function save(plan){
  if(!owner){w.store.set(`workflow.preparationPlans.${application.id}`,plan);return;}
  if(loading||error||!application.backendId)throw Error('Reload the current preparation plan before saving.');
  let saved;
  try { saved=await createBackend(w.client,owner).savePreparation(application.backendId,row?.version||0,plan); }
  catch(failure) {if(alive.current && window.JB.auth.userId===owner)setError('The plan could not save or changed elsewhere. Reload preparation before editing.');throw failure;}
  if(!alive.current||window.JB.auth.userId!==owner)throw Error('Account changed. Reopen preparation.');
  setRow(saved);
 }
 const plan=owner?row?.plan:w.state.workflow.preparationPlans?.[application.id];
 return <div>
  {loading?<Notice>Loading preparation…</Notice>:error?<div><Notice>{error}</Notice><button className={`${secondary} mt-3`} onClick={()=>setRetry(n=>n+1)}>Reload preparation</button></div>:
   <Preparation application={application} plan={plan} onSave={w.locked?undefined:save} timeZone={w.state.workflow.searchPreferences?.quietMode?.timezone}/>}
  {!owner && <Notice>Your preparation stays in this browser. Sign in to share an account plan with Muse.</Notice>}
 </div>;
}
