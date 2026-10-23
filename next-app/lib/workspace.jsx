"use client";
import {lazy,Suspense,useEffect,useState} from 'react';
import {Context} from './workspace-context.jsx';
import {resolveDemoMode} from './workspace-mode.mjs';
export {basePath,asset,useWorkspace,useSlice} from './workspace-context.jsx';
const AccountWorkspace=lazy(()=>import('./account-workspace.jsx'));
const DemoWorkspace=lazy(()=>import('./demo-workspace.jsx'));
const loading={state:null,store:null,user:null,accountUser:null,demo:false,demoEpoch:0,canDemo:false,locked:false,status:'',error:'',syncError:'',authReady:false,roles:[],date:'',models:null,client:null,services:null};
export function WorkspaceProvider({children}) {
 const [demo,setDemo]=useState(null);
 useEffect(()=>{setDemo(resolveDemoMode(window.location.href,()=>window.sessionStorage));},[]);
 const fallback=<Context.Provider value={loading}>{children}</Context.Provider>;
 if(demo===null)return fallback;
 const Provider=demo?DemoWorkspace:AccountWorkspace;
 return <Suspense fallback={fallback}><Provider>{children}</Provider></Suspense>;
}
