"use client";
import { useEffect, useRef, useState } from 'react';
import { createBackend } from '../../backend/client.mjs';
import { normalizeQuietMode } from '../../quiet-mode.mjs';
import { useWorkspace } from './workspace';
export function useQuietSettings() {
 const w=useWorkspace(),owner=w.demo?'demo':w.user?.id||'guest';
 const [version,setVersion]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const currentOwner=useRef(owner);currentOwner.current=owner;
 const service=w.services||(w.user?createBackend(w.client,w.user.id):null);
 useEffect(()=>{
  let active=true;setVersion(null);setError('');
  if(!service)return;
  setBusy(true);
  service.readQuietMode().then(value=>{
    if(!active||currentOwner.current!==owner)return;
    setVersion(value.personalVersion);
    // Real quiet state goes into the account cache only after an owned read.
    w.store.set('workflow.searchPreferences',{...w.store.get('workflow.searchPreferences'),quietMode:value.settings});
  }).catch(()=>{if(active)setError('Update settings could not load. Retry before saving.');}).finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;};
 },[owner,w.client,w.services,retry]);
 const quiet=normalizeQuietMode(w.state?.workflow.searchPreferences?.quietMode);
 async function save(next) {
  if(busy)return;
  setError('');
  const settings=normalizeQuietMode(next);
  if(!service){w.store.set('workflow.searchPreferences',{...w.store.get('workflow.searchPreferences'),quietMode:settings});return;}
  if(version===null){setError('Reload update settings before saving.');return;}
  setBusy(true);
  try{
   const result=await service.saveQuietMode(settings,version);
   if(currentOwner.current!==owner)return;
   setVersion(result.personalVersion);
   w.store.set('workflow.searchPreferences',{...w.store.get('workflow.searchPreferences'),quietMode:result.settings});
  }catch{if(currentOwner.current===owner)setError('Settings changed elsewhere or could not save. Reload update settings, then try again.');}
  finally{if(currentOwner.current===owner)setBusy(false);}
 }
 return {quiet,save,busy,error,reload:()=>setRetry(n=>n+1)};
}
