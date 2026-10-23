"use client";
import {callApi,apiErrorText} from '../../lib/api-failure.mjs';
import {useEffect,useRef,useState} from 'react';
import {useSlice,useWorkspace} from './workspace';
import {validateCompany} from '../../lib/network-model.mjs';
import {createCompanySync} from '../../lib/company-sync.mjs';
export function useNetworkCompanies(_outreach){
 const w=useWorkspace(),owner=w.demo?'demo':w.user?.id||'guest';
 const [rows,setRows]=useSlice('network.companies');
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 const session=useRef(null);
 const current=s=>session.current===s&&(w.demo||window.JB?.auth?.userId===s.owner);
 useEffect(()=>{
  setError('');setReady(false);
  if(!w.store)return;
  if(w.demo||!w.user){session.current=null;setReady(true);return;}
  const s={owner};session.current=s;
  s.sync=createCompanySync({owner,isCurrent:()=>current(s),get:()=>w.store.get('network.companies')||[],set:value=>w.store.set('network.companies',value),onStatus:setError,
   read:async()=>{let offset=0,all=[];for(;;){const data=await callApi('company_workspaces.list',()=>w.client.rpc('company_action',{operation:'company_workspaces.list',payload:{limit:1000,offset},expected_owner:owner}),data=>!!data&&Array.isArray(data.items));all.push(...data.items);if(data.items.length<1000)return all;offset+=1000;}},
   write:async row=>{return callApi('company_workspaces.save',()=>w.client.rpc('company_action',{operation:'company_workspaces.save',payload:{id:row.id,record:row.record,expectedRevision:row.revision},expected_owner:owner}));}});
  const sync=async()=>{try{await s.sync.synchronize();}catch(e){if(current(s))setError(apiErrorText('company_workspaces.sync',e)+' Your local edits are preserved.');}finally{if(current(s))setReady(true);}};
  sync();
  const timer=setInterval(sync,15000);window.addEventListener('online',sync);window.addEventListener('focus',sync);
  return()=>{clearInterval(timer);window.removeEventListener('online',sync);window.removeEventListener('focus',sync);if(session.current===s)session.current=null;};
 },[owner,w.store,w.client,w.demo]);
 async function save(row){
  validateCompany(row.record);
  const s=session.current;
  if(w.user&&!w.demo&&(!s||!current(s)))throw Error('Account changed. Reopen the company.');
  const latest=w.store.get('network.companies')||[],saved=latest.find(r=>r.id===row.id);
  if(saved?.conflict||(saved?.revision||0)!==row.revision)throw Error('Company changed. Your draft is kept here. Reload the saved company.');
  // Identity-sensitive edits are resolved by the server; local identity is cleared immediately.
  const value={...row,companyId:saved&&saved.record.name===row.record.name&&saved.record.website===row.record.website?saved.companyId:null,dirty:!!s,revision:s?row.revision:row.revision+1};
  setRows([...latest.filter(r=>r.id!==row.id),value]);
  if(s){try{await s.sync.synchronize();}catch(e){const message=apiErrorText('company_workspaces.save',e)+' Your local edits are preserved; the save is not confirmed.';setError(message);throw Error(message);}}
  return (w.store.get('network.companies')||[]).find(r=>r.id===row.id)||value;
 }
 async function refresh(){const s=session.current;if(s)try{await s.sync.synchronize();}catch(e){setError(apiErrorText('company_workspaces.list',e)+' Your local edits are preserved.');}}
 async function discard(id){const s=session.current;if(!s||!current(s))return;const data=await callApi('company_workspaces.list',()=>w.client.rpc('company_action',{operation:'company_workspaces.list',payload:{},expected_owner:owner}),data=>!!data&&Array.isArray(data.items));if(!current(s))return;const saved=data.items.find(r=>r.id===id);if(!saved)throw Error('Saved company unavailable. Your draft is still kept.');setRows((w.store.get('network.companies')||[]).map(r=>r.id===id?saved:r));setError('');}
 return {rows:rows||[],save,refresh,discard,error,loading:!ready,ready,owner};
}
