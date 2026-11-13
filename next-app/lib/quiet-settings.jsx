"use client";
import { useEffect, useRef, useState } from 'react';
import { createBackend } from '../../backend/client.mjs';
import { normalizeQuietMode } from '../../lib/quiet-mode.mjs';
import { useWorkspace } from './workspace';
export function useQuietSettings() {
 const w=useWorkspace(),owner=w.demo?'demo':w.user?.id||'guest';
 const [version,setVersion]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [quiet,setQuiet]=useState(()=>normalizeQuietMode());
 const currentOwner=useRef(owner);currentOwner.current=owner;
 const service=w.services||(w.user?createBackend(w.client,w.user.id):null);
 useEffect(()=>{
  let active=true;setVersion(null);setError('');setQuiet(normalizeQuietMode());
  if(!service){setBusy(false);return;}
  setBusy(true);
  service.readQuietMode().then(value=>{
    if(!active||currentOwner.current!==owner)return;
    setVersion(value.personalVersion);
    setQuiet(normalizeQuietMode(value.settings));
  }).catch(()=>{if(active)setError('Update settings could not load. Retry before saving.');}).finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;};
 },[owner,w.client,w.services,retry]);
 async function saveCadence(cadence) {
  if(busy)return;
  setError('');
  if(!service)return;
  if(version===null){setError('Reload update settings before saving.');return;}
  setBusy(true);
  try{
   const current=await service.readQuietMode();
   if(currentOwner.current!==owner)return;
   const settings=normalizeQuietMode({...current.settings,cadence});
   const result=await service.saveQuietMode(settings,current.personalVersion);
   if(currentOwner.current!==owner)return;
   setVersion(result.personalVersion);
   setQuiet(normalizeQuietMode(result.settings));
  }catch{if(currentOwner.current===owner)setError('Settings changed elsewhere or could not save. Reload update settings, then try again.');}
  finally{if(currentOwner.current===owner)setBusy(false);}
 }
 return {quiet,saveCadence,busy,error,reload:()=>setRetry(n=>n+1)};
}
