"use client";
import {isCompanyRecord} from '../../lib/network-model.mjs';
import { outreachDemoMessages } from './outreach-demo.mjs';
import { useEffect, useRef, useState } from 'react';
import { useSlice, useWorkspace } from './workspace';
const recordOf = row => { const {id,_revision,_outreachDirty,origin,...record}=row; return record; };
export function useOutreach() {
 const {client,user,store,demo}=useWorkspace(); const [contacts,setLocal]=useSlice('network.referrals');
 const [requests,setRequests]=useState([]),[status,setStatus]=useState(''),[ready,setReady]=useState(false);
 const session=useRef(null),latest=useRef(contacts||[]); latest.current=contacts||[];
 function isCurrent(s) {return session.current===s && window.JB?.auth?.userId===s.owner;}
 function apply(rows) { latest.current=rows; setLocal(rows); }
 async function refresh(s) {
  if(!isCurrent(s) || s.pending.size || s.running) return;
  const [a,b]=await Promise.all([client.from('outreach_contacts').select('*').eq('user_id',s.owner).order('updated_at'),client.from('outreach_requests').select('*').eq('user_id',s.owner).order('created_at',{ascending:false}).limit(30)]);
  if(!isCurrent(s) || s.pending.size || s.running) return;
  if(a.error||b.error) throw Error('Outreach could not load. Try again.');
  s.revisions=new Map(a.data.map(r=>[r.id,r.revision]));
  apply(a.data.filter(r=>!r.deleted_at&&r.record.collection!=='companies').map(r=>({...r.record,id:r.id,companyId:r.company_id||r.record.companyId,_revision:r.revision}))); setRequests(b.data); setStatus('Saved to your account.');
 }
 async function flush() {
  const s=session.current; if(!s) return;
  clearTimeout(s.timer); if(s.running) { await s.running; if(s.pending.size) return flush(); return; }
  s.running=(async()=>{
   while(s.pending.size && isCurrent(s)) {
    const [id,value]=s.pending.entries().next().value; s.pending.delete(id); s.inFlight=id;
    let result;
    try { result=await client.rpc('save_outreach_contact',{p_id:id,p_expected_revision:s.revisions.get(id)??-1,p_record:recordOf(value||{id}),p_expected_owner:s.owner,p_deleted:!value}); }
    catch(error) {result={error};}
    const {data,error}=result;
    if(!isCurrent(s)) return;
    s.inFlight=null;
    if(error) { if(!s.pending.has(id)) s.pending.set(id,value); setStatus('Your outreach edits are kept here. Sync will retry automatically.'); throw Error('Outreach sync paused.'); }
    s.revisions.set(id,data.revision);
    if(value) apply(latest.current.map(r=>r.id===id && JSON.stringify(recordOf(r))===JSON.stringify(recordOf(value)) ? {...r,_revision:data.revision,_outreachDirty:false} : r));
    else store.set('network.outreachDeletions',(store.get('network.outreachDeletions')||[]).filter(r=>r.id!==id));
   }
   if(isCurrent(s)) setStatus('Saved to your account.');
  })();
  try { await s.running; } finally { s.running=null; }
 }
 function setContacts(next) {
  const previous=latest.current; const s=session.current; if(!s) {apply(next);return;}
  next=next.map(r=>{const old=previous.find(p=>p.id===r.id);if(old&&old.company!==r.company)r={...r,companyId:undefined};return !old || JSON.stringify(recordOf(old))!==JSON.stringify(recordOf(r)) ? {...r,_outreachDirty:true}:r;});apply(next);
  for(const row of next) { const old=previous.find(r=>r.id===row.id); if(!old || JSON.stringify(recordOf(old))!==JSON.stringify(recordOf(row))) s.pending.set(row.id,row); }
  for(const row of previous) if(!next.some(r=>r.id===row.id)) {if(!s.revisions.has(row.id) && s.inFlight!==row.id){s.pending.delete(row.id);continue;}s.pending.set(row.id,null);store.set('network.outreachDeletions',[...(store.get('network.outreachDeletions')||[]).filter(r=>r.id!==row.id),{id:row.id,revision:s.revisions.get(row.id)??-1}]);}
  clearTimeout(s.timer); s.timer=setTimeout(()=>flush().catch(()=>{}),500); setStatus('Saving outreach…');
 }
 useEffect(()=>{
  setReady(false);setRequests([]); const owner=user?.id;
  if(demo){session.current=null;setReady(true);setStatus('Demo contacts — changes stay in memory.');return;}
  if(!owner || !client || !store) {session.current=null;setStatus('Saved in this browser. Sign in to ask Muse to prepare outreach.');return;}
  const s={owner,pending:new Map(),revisions:new Map(),running:null,timer:null};session.current=s;
  async function sync() {
   if(s.syncing || !isCurrent(s)) return;
   s.syncing=true;
   try {
   if(!s.initialized) {
    const {data,error}=await client.from('outreach_contacts').select('*').eq('user_id',owner);
   if(error) throw error; if(!isCurrent(s))return;
   s.revisions=new Map(data.map(r=>[r.id,r.revision]));
   const local=[...(store.get('network.referrals')||[]).filter(r=>!isCompanyRecord(r)),...(store.get('network.people')||[]).map(r=>({...r,id:`network:${r.id}`,contact:r.name}))];
   for(const r of local) if(!s.revisions.has(r.id) || r._outreachDirty) {s.pending.set(r.id,r);if(r._outreachDirty && r._revision!==undefined)s.revisions.set(r.id,r._revision);}
   for(const r of store.get('network.outreachDeletions')||[]) if(s.revisions.has(r.id)) {s.revisions.set(r.id,r.revision);s.pending.set(r.id,null);}
   s.initialized=true;
   }
   await flush(); if(!isCurrent(s))return;
   if(!s.peopleImported) {store.set('network.people',[]);s.peopleImported=true;}
   await refresh(s); if(isCurrent(s))setReady(true);
  } catch { if(isCurrent(s))setStatus('Your outreach edits are kept here. Sync will retry automatically.'); }
   finally {s.syncing=false;}
  }
  sync();
  const timer=setInterval(sync,15000);
  window.addEventListener('online',sync);
  window.addEventListener('focus',sync);
  return()=>{clearInterval(timer);clearTimeout(s.timer);window.removeEventListener('online',sync);window.removeEventListener('focus',sync);if(isCurrent(s))session.current=null;};
 },[user?.id,client,store,demo]);
 async function request(companies) {
  if(demo){const next=companies.map((company,i)=>{const example=outreachDemoMessages[i%outreachDemoMessages.length];return {...example,id:crypto.randomUUID(),company:company.trim(),contact:example.name,message:example.message.replaceAll(example.company,company.trim()),title:i%2?'Infrastructure Engineer':'Backend Engineer',status:'Not asked',source:'Demo'};});setContacts([...latest.current,...next]);setStatus('Demo outreach prepared. No backend request was sent.');return;}
  const s=session.current;if(!s||!ready)throw Error('Sign in and wait for your outreach account to connect.');
  const names=[...new Set(companies.map(v=>v.trim()).filter(Boolean))];if(!names.length||names.length>50||names.some(n=>n.length>200))throw Error('Choose between 1 and 50 companies.');
  await flush(); if(!isCurrent(s))throw Error('Account changed.');
  const {error}=await client.from('outreach_requests').insert({companies:names,user_id:s.owner});if(error)throw Error('Could not save your request. Try again.');
  await refresh(s);
 }
 return {demo,records:contacts||[],setRecords:setContacts,flush,contacts:(contacts||[]).filter(r=>!isCompanyRecord(r)),setContacts:next=>setContacts([...latest.current.filter(isCompanyRecord),...next]),requests,status,ready,request,refresh:async()=>{const s=session.current;if(s){await flush();await refresh(s);if(isCurrent(s))setReady(true);}},signedIn:!!user || demo};
}
