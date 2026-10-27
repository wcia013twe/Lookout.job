"use client";
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {useKnowledgeClient} from '../app/circles/_lib/client';
import ApiError from './api-error';
import {secondary} from './ui';
type Report={id:string;title:string;insight:string;experienceDate:string|null;uncertainty:string|null;source:{path:string;revision:number}};
type Packet={status:'no_discussions'|'evidence_available';evidence:Report[];coverage:{possiblyMore:boolean}};
export default function InterviewIntelligence({jobId,applicationId}:{jobId:string;applicationId?:string}){
 const client=useKnowledgeClient(),[packet,setPacket]=useState<(Packet&{identity:string})|null>(null),[busy,setBusy]=useState(false),[explicit,setExplicit]=useState(false),[error,setError]=useState('');
 const sequence=useRef(0),identity=`${client.identity}:${applicationId||jobId}`,latest=useRef(identity);latest.current=identity;
 async function load(manual=false,limit=3){
  const request=++sequence.current,started=identity;if(manual)setExplicit(true);setBusy(true);setError('');
  try{const next=await client.request<Packet>('knowledge.interview',{...(applicationId?{applicationId}:{jobId}),limit});if(sequence.current===request&&latest.current===started)setPacket({...next,identity:started});}
  catch(failure){if(sequence.current===request&&latest.current===started){setPacket(null);setError(failure instanceof Error?failure.message:'Interview reports could not load.');}}
  finally{if(sequence.current===request&&latest.current===started)setBusy(false);}
 }
 useEffect(()=>{setPacket(null);setExplicit(false);setError('');if(client.ready)void load();const refresh=()=>{if(client.ready)void load();};window.addEventListener('focus',refresh);return()=>{sequence.current++;window.removeEventListener('focus',refresh);};},[identity,client.ready]);
 if(!client.ready)return null;
 const visible=packet?.identity===identity?packet:null;
 const evidence=visible?.evidence||[];
 return <section className="col-span-full min-w-0" aria-label="Interview reports">
  {!!evidence.length&&<><h3 className="text-base font-semibold">From your Circles</h3><p className="mt-1 text-sm text-board-muted">Shared experiences linked to this posting.</p>
   <ul className="mt-3 divide-y divide-board-line">{evidence.map(report=><li key={report.id} className="py-4">
    <h4 className="break-words font-medium">{report.title}</h4>
    <p className="mt-1 text-xs text-board-muted">{report.experienceDate||'Experience date unknown'} · User-reported</p>
    <p className="mt-2 max-w-prose whitespace-pre-wrap break-words text-sm leading-7">{report.insight}</p>
    {report.uncertainty&&<p className="mt-2 max-w-prose text-xs leading-6 text-board-muted">{report.uncertainty}</p>}
    <Link href={report.source.path} className="mt-2 inline-flex min-h-11 items-center text-sm text-board-accent underline underline-offset-4">Read conversation</Link>
   </li>)}</ul></>}
  <ApiError message={error} onRetry={()=>void load(true)}/>
  {explicit&&visible?.status==='no_discussions'&&!busy&&!error&&<p role="status" className="mb-2 text-sm text-board-muted">No matching reports were found in your accessible Circles.</p>}
  <button className={secondary} disabled={busy} onClick={()=>void load(true,10)}>{busy?'Checking interview reports…':evidence.length?'Refresh interview reports':'Check interview reports'}</button>
 </section>;
}
