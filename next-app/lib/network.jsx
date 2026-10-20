"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {useWorkspace,useSlice} from './workspace';
import {validateCompany} from '../../lib/network-model.mjs';
export function useNetworkCompanies(){
 const w=useWorkspace(),[local]=useSlice('network.companies');
 const owner=w.demo?'demo':w.user?.id||'guest';
 const current=useRef(owner);current.current=owner;
 const [remote,setRemote]=useState({owner:'',rows:[]}),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const active=useRef(0),saving=useRef(false);
 const refresh=useCallback(async()=>{
  if(owner==='guest'||owner==='demo'||saving.current)return;
  const generation=++active.current;setLoading(true);
  try{
   let rows=[],offset=0,total=0;
   do{
    const {data,error}=await w.client.rpc('network_action',{operation:'network.companies.read',payload:{offset,limit:100},p_expected_owner:owner});
    if(error)throw error;
    if(current.current!==owner||generation!==active.current)return;
    rows.push(...data.companies);total=data.total;offset+=100;
   }while(offset<total);
   setRemote({owner,rows});setError('');
  }catch{if(current.current===owner&&generation===active.current)setError('Company records could not load. Retry to reconnect.');}
  finally{if(current.current===owner&&generation===active.current)setLoading(false);}
 },[owner,w.client]);
 useEffect(()=>{setError('');setLoading(false);refresh();const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);return()=>{active.current++;clearInterval(timer);window.removeEventListener('focus',refresh);};},[refresh]);
 const rows=owner==='guest'||owner==='demo'?(local||[]):remote.owner===owner?remote.rows:[];
 async function save(row){
  validateCompany(row.record);
  if(current.current!==owner)throw Error('Account changed. Reopen the company.');
  if(owner==='guest'||owner==='demo'){
   const existing=(w.store.get('network.companies')||[]);
   const found=existing.find(r=>r.id===row.id);
   if((found?.revision||0)!==row.revision)throw Error('Company changed. Reopen it before saving.');
   if(existing.some(r=>r.id!==row.id&&r.record.name.trim().toLowerCase().replace(/\s+/g,' ')===row.record.name.trim().toLowerCase().replace(/\s+/g,' ')))throw Error('This company already exists. Open its current record.');
   const result={id:row.id,record:row.record,revision:row.revision+1,updated_at:new Date().toISOString()};
   w.store.set('network.companies',[...existing.filter(r=>r.id!==row.id),result]);return result;
  }
  if(error||loading||remote.owner!==owner)throw Error('Wait for company records to load, or retry the connection.');
  saving.current=true;active.current++;
  let result;
  try {result=await w.client.rpc('network_action',{operation:'network.company.save',payload:{id:row.id,expectedRevision:row.revision,record:row.record},p_expected_owner:owner});} finally {saving.current=false;}
  const {data,error:failure}=result;
  if(current.current!==owner)throw Error('Account changed. Reopen the company.');
  if(failure)throw Error(failure.code==='40001'?'Company changed elsewhere. Your draft is kept; reload the saved record before retrying.':failure.code==='23505'?'This company already exists. Open its current record.':'Company could not save. Your draft is kept; try again.');
  setRemote(previous=>({owner,rows:[...previous.rows.filter(r=>r.id!==data.id),data]}));return data;
 }
 return {rows,save,refresh,error,loading,ready:owner==='guest'||owner==='demo'||remote.owner===owner,owner};
}
