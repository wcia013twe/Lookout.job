"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {createSimplifyImporter} from '../../backend/simplify-import.mjs';
import {useWorkspace} from './workspace';
export function useSimplifyImports(){
 const w=useWorkspace(),[snapshot,setSnapshot]=useState({records:[],version:0}),[error,setError]=useState('');
 const scope=`${w.demo?'demo':w.user?.id||'guest'}:${w.demoEpoch||0}`,current=useRef(scope);current.current=scope;
 const call=useCallback(async(action,payload={})=>{
  const started=scope;
  let result;
  if(w.demo)result=await w.services.simplifyImport(action,payload);
  else result=await createSimplifyImporter(w.client,w.user?.id)(action,payload);
  if(current.current!==started)throw Error('Account changed. Choose your CSV again.');
  return result;
 },[scope,w.client,w.services]);
 const refresh=useCallback(async()=>{try{const data=await call('list');setSnapshot({...data,scope});setError('');}catch(e){if(current.current===scope)setError(e.message);}},[call,scope]);
 useEffect(()=>{setSnapshot({records:[],version:0});setError('');if(!w.demo&&!w.user)return;void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>clearInterval(timer);},[refresh,scope]);
 return {records:snapshot.scope===scope?snapshot.records:[],error,call,refresh,scope};
}
