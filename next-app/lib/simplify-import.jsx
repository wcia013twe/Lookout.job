"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {useReadRevision,useWorkspaceReads} from './workspace-reads';
import {createSimplifyImporter} from '../../backend/simplify-import.mjs';
import {useWorkspace} from './workspace';
export function useSimplifyImports(){
 const w=useWorkspace(),reads=useWorkspaceReads(),revision=useReadRevision('imports');
 const scope=`${w.demo?'demo':w.user?.id||'guest'}:${w.demoEpoch||0}`,current=useRef(scope);current.current=scope;
 const [snapshot,setSnapshot]=useState(()=>({...reads.peek('imports','list'),scope:reads.peek('imports','list')?scope:null})),[error,setError]=useState('');
 const call=useCallback(async(action,payload={})=>{
  const started=scope;
  let result;
  if(w.demo)result=await w.services.simplifyImport(action,payload);
  else result=await createSimplifyImporter(w.client,w.user?.id)(action,payload);
  if(current.current!==started)throw Error('Account changed. Choose your CSV again.');
  if(!w.demo&&(action==='save'||action==='update'))reads.invalidate('planner');
  return result;
 },[scope,w.client,w.services,reads]);
 const load=useCallback(async(isCurrent=()=>true)=>{
  const started=reads.revision('imports');
  try{
  const data=await reads.read('imports','list',()=>call('list'));
  if(isCurrent()&&started===reads.revision('imports')){setSnapshot({...data,scope});setError('');}
 }catch(e){if(isCurrent()&&started===reads.revision('imports')&&current.current===scope)setError(e.message);}},[call,reads,scope]);
 const refresh=useCallback(()=>{reads.invalidate('imports');return load();},[reads,load]);
 useEffect(()=>{
  if(!w.demo&&!w.user)return;
  let active=true;void load(()=>active);return()=>{active=false;};
 },[load,revision,scope]);
 return {ready:snapshot.scope===scope,version:snapshot.scope===scope?snapshot.version:0,records:snapshot.scope===scope?snapshot.records:[],error,call,refresh,scope};
}
