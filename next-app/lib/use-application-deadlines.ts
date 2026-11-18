"use client";
import {useEffect,useRef,useState} from 'react';
import {createBackend} from '../../backend/client.mjs';
import {useReadRevision,useWorkspaceReads} from './workspace-reads';
import {useWorkspace} from './workspace';
import type {PreparationPlan} from '../components/workflow-types';

// Use the existing owner-scoped planner reader rather than a second date store.
export function useApplicationDeadlines() {
 const w=useWorkspace(),owner=w.demo?'demo':w.user?.id||null;
 const key=`${owner}:${w.demoEpoch||0}`;
 const keyRef=useRef(key);keyRef.current=key;
 const [loaded,setLoaded]=useState<{key:string;plans:Record<string,PreparationPlan>;error:string}|null>(null);
 const reads=useWorkspaceReads(),revision=useReadRevision('planner');
 const applicationKey=Object.values(w.state.workflow.applications as Record<string,{backendId?:string}>).map(app=>app.backendId||'').sort().join('|');
 useEffect(()=>{
  if(!owner)return;
  let active=true,generation=0;
  const load=()=>{
   const ticket=++generation;
   const current=()=>active&&keyRef.current===key&&ticket===generation&&(w.demo||window.JB?.auth?.userId===owner);
   reads.read<{plans:{application_id:string;plan:PreparationPlan}[]}>('planner','bundle',()=> (w.services||createBackend(w.client,owner)).readPreparationPlanner())
    .then((value:{plans:{application_id:string;plan:PreparationPlan}[]})=>{if(current())setLoaded({key,plans:Object.fromEntries(value.plans.map(row=>[row.application_id,row.plan])),error:''});})
    .catch(()=>{if(current())setLoaded(previous=>({key,plans:previous?.key===key?previous.plans:{},error:'Preparation dates could not load. Reload to retry.'}));});
  };
  load();
  return()=>{active=false;++generation;};
 },[key,owner,w.client,w.services,applicationKey,reads,revision]);
 return owner?loaded?.key===key?loaded:{plans:{},error:''}:{plans:w.state.workflow.preparationPlans||{},error:''};
}
