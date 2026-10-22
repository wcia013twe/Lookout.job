"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {useWorkspace} from './workspace';
import {prepareSearch,searchResponse} from '../../supabase/functions/agent-gateway/search.mjs';
import {searchDemo,synchronizeSearchDemo} from '../../lib/search/demo.mjs';
export type SearchDocument={kind:string;id:string;version:number;content:string;projection:Record<string,any>};
export type SearchRun={id:string;profile_id:string;state:string;version:number;mode:string;days:number;summary:string;created_at?:string;contextChanged?:boolean;sources?:Record<string,any>[]};
export function useSearchHarness(profileId?:string){
 const w=useWorkspace(),[context,setContext]=useState<any>(null),[runs,setRuns]=useState<SearchRun[]>([]),[listings,setListings]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const generation=useRef(0);const owner=w.demo?`demo-${w.demoEpoch}`:w.user?.id||'guest';const currentOwner=useRef(owner);currentOwner.current=owner;

 const action=useCallback(async(operation:string,payload:Record<string,unknown>={})=>{
  const expected=owner;
  const prepared=prepareSearch(operation,payload);
  if(w.demo){
   const d:ReturnType<typeof searchDemo>=synchronizeSearchDemo(w.store.get('workflow.searchHarness')||searchDemo(),w.store.get('workflow.searchPreferences')||{});
   w.store.set('workflow.searchHarness',d);
   if(operation==='search.context'){const selected=payload.profileId||d.profileId;return searchResponse(operation,{documents:d.documents.filter(v=>v.kind!=='profile'||v.id===selected),profiles:d.documents.filter(v=>v.kind==='profile').map(v=>({id:v.id,name:v.projection.name,active:v.projection.active,version:v.version})),profileId:selected});}
   if(operation==='search.run.read')return payload.runId?d.runs.find(r=>r.id===payload.runId):d.runs;
   if(operation==='search.discoveries.read')return {listings:d.listings,nextOffset:null};
   if(operation==='search.document.history')return d.documents.filter(v=>v.kind===payload.kind&&v.id===payload.id);
   if(operation==='search.document.save'){
    const previous=d.documents.find(v=>v.kind===payload.kind&&v.id===payload.id);
    if((previous?.version||0)!==payload.expectedVersion)throw Error('Document changed. Reload before saving.');
    const {parseDocument}=await import('../../lib/search/documents.mjs');
    const next={kind:payload.kind as string,id:payload.id as string,version:(previous?.version||0)+1,...parseDocument(payload.kind,prepared.content)};
    d.documents=previous?d.documents.map(v=>v===previous?next:v):[...d.documents,next];w.store.set('workflow.searchHarness',d);
    if(next.kind==='profile'){const prefs=w.store.get('workflow.searchPreferences')||{};const list=prefs.profiles||[];const p={...next.projection,version:next.version};w.store.set('workflow.searchPreferences',{...prefs,profiles:list.some((v:any)=>v.id===next.id)?list.map((v:any)=>v.id===next.id?p:v):[...list,p]});}
    if(next.kind==='portals'){const prefs=w.store.get('workflow.searchPreferences')||{};w.store.set('workflow.searchPreferences',{...prefs,targets:next.projection.tracked_companies.map((s:any)=>({id:s.id,name:s.name,kind:s.kind,address:s.careers_url})),targetsVersion:next.version});}
    return next;
   }
   if(operation==='search.request')return {state:'queued',id:'demo-task'};
   throw Error('This fictional preview does not execute searches.');
  }
  if(!w.user||!w.client)throw Error('Sign in to share career context with your personal agent.');
  const {data,error:failure}=await w.client.rpc('search_action',{operation,payload:prepared});
  if(currentOwner.current!==expected||window.JB.auth.userId!==expected)throw Error('Account changed. Reload this view.');
  if(failure)throw Error(failure.code==='40001'?'Saved state changed. Reload before retrying; your draft is kept.':failure.code==='42883'?'Search context is not deployed on this backend yet.':'Could not complete this request. Your draft is kept; check the connection and retry.');
  return searchResponse(operation,data);
 },[owner,w.demo,w.user,w.client]);
 const reload=useCallback(async()=>{
  const token=++generation.current;setBusy(true);setError('');
  try{const [c,r]=await Promise.all([action('search.context',profileId?{profileId}:{}),action('search.run.read')]);if(token!==generation.current)return;if(!Array.isArray(c?.documents)||!Array.isArray(r))throw Error("Search data is unavailable. Reload after the backend release.");setContext(c);setRuns(r);}
  catch(e){if(token===generation.current)setError(e instanceof Error?e.message:'Could not load context.');}
  finally{if(token===generation.current)setBusy(false);}
 },[action,profileId]);
 useEffect(()=>{generation.current++;setContext(null);setRuns([]);setListings([]);if(w.demo||w.user)void reload();return()=>{generation.current++;};},[owner,profileId]); // account/profile boundary, not each local store render
 return {context,runs,listings,setListings,action,reload,error,setError,busy,setBusy,owner};
}
