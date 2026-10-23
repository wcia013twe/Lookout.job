"use client";
import {useEffect,useRef,useState} from 'react';
import {Context} from './workspace-context.jsx';
import {navigateWorkspaceMode} from './workspace-mode.mjs';
import {createDetachedDemo} from './demo-runtime.mjs';
import {dayStamp} from './progress.mjs';
import presets from '../../data/tierlist-presets.json';
let modelBoot;
async function loadModels() {
 // These modules expose pure domain helpers; do not import the persistent store.
 window.JB ||= {};
 await Promise.all([import('../../lib/workflow-model.js'),import('../../lib/saved-answers-model.js'),import('../../lib/tierlist-model.js')]);
 window.JB.tierlistModel.configure(presets);
 return window.JB;
}
export default function DemoWorkspaceProvider({children}) {
 const [state,setState]=useState(null),[epoch,setEpoch]=useState(0),[error,setError]=useState('');
 const runtime=useRef(null),subscription=useRef(null);
 function reset(models=window.JB) {
  subscription.current?.();
  const next=createDetachedDemo({date:dayStamp(),models,presets});
  runtime.current=next;
  // Legacy domain consumers see only the fictional store, never account handles.
  models.store=next.store;models.auth={client:null,userId:null};models.cloud=null;
  subscription.current=next.store.subscribe('',setState);
  setState(next.store.get());setEpoch(n=>n+1);
 }
 useEffect(()=>{
  let alive=true;
  (modelBoot ||= loadModels()).then(models=>{if(alive)reset(models);}).catch(()=>{if(alive)setError('Demo could not load. Reload to retry.');});
  return()=>{alive=false;subscription.current?.();};
 },[]);
 const exit=()=>navigateWorkspaceMode(window.location,false);
 const value={state,store:runtime.current?.store||null,user:null,accountUser:null,demo:true,demoEpoch:epoch,canDemo:true,
  toggleDemo:exit,resetDemo:()=>{if(runtime.current)reset();},locked:false,status:'Fictional demo. Changes stay in memory.',error,syncError:'',authReady:false,
  signIn:()=>setError('Exit demo mode before signing in.'),signOut:()=>setError('Demo mode has no signed-in account.'),
  roles:state?.demo.roles||[],date:state?.demo.date||'',batchLabel:'Demo listings — fictional data for preview.',
  models:typeof window!=='undefined'?window.JB:null,client:null,services:runtime.current?.services||null};
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
