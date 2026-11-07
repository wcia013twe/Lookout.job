"use client";
import {useState} from 'react';
import {buildSubmissionRecord} from '../../lib/submission-record.mjs';
import type {Application,SavedResume} from './workflow-types';
import {control,secondary} from './ui';
const display=(value:unknown):string=>value==null||value===''?'Not available':typeof value==='boolean'?(value?'Yes':'No'):typeof value==='object'?JSON.stringify(value,null,2):String(value);
export default function ApplicationDocumentsPreview({application,draft,resume,recordApplication,attempts,loading,error,onRetry,onDownloadResume}:{
 application:Application;draft:Application;profile:Record<string,unknown>;resume?:SavedResume;hasDraft:boolean;
 recordApplication?:Partial<Application>;attempts:Record<string,unknown>[];loading:boolean;error:string;onRetry:()=>void;onDownloadResume?:(resume:SavedResume)=>void|Promise<void>;
}){
 const [selection,setSelection]=useState<string|null>(null);
 const record=buildSubmissionRecord(recordApplication||{...application,id:application.backendId||application.id},attempts);
 const snapshots=record.attempts.filter(attempt=>attempt.hasSnapshot);
 const external=Boolean(application.imported);
 const historical=(external&&application.imported?.record.status!=='SAVED')||['Submitted','Applied','Interview','Offer','Rejected','Withdrawn','Closed'].includes(application.status);
 const preferred=snapshots.find(attempt=>attempt.confirmed)||snapshots[0];
 const snapshot=snapshots.find(attempt=>attempt.id===(selection||preferred?.id));
 if(loading)return <section aria-label="Application documents"><h3>Submitted application</h3><p role="status" className="mt-3 text-sm text-board-muted">Loading…</p></section>;
 if(error)return <section aria-label="Application documents"><h3>Submitted application</h3><p role="alert" className="mt-3 text-sm text-board-muted">Saved application unavailable.</p><button className={`${secondary} mt-3`} onClick={onRetry}>Retry</button></section>;
 if((historical||external)&&!snapshot)return <section aria-label="Application documents"><h3>{historical?'Submitted application':'Application documents'}</h3><p className="mt-3 text-sm text-board-muted">{!historical?'Not available. No application materials were recorded.':application.imported?'Not available. This application was submitted outside Lookout.':'Not available. No submission snapshot was saved.'}</p></section>;
 const questions:{question:string;answer:unknown;fieldType?:string|null}[]=snapshot?snapshot.questions:draft.questions||[];
 const savedResume=snapshot?snapshot.resume:resume;
 return <section className="application-form-preview" aria-label="Application documents">
  <h3>{snapshot?.confirmed?'Submitted application':snapshot?'Saved application attempt':'Application draft'}</h3>
  {snapshot&&!snapshot.confirmed&&<p className="mt-2 text-sm text-board-muted">Submission not confirmed.</p>}
  {snapshots.length>1&&<label className="mt-4 block text-sm text-board-muted">Saved attempt<select className={`${control} mt-2`} value={snapshot?.id} onChange={e=>setSelection(e.target.value)}>{snapshots.map(attempt=><option key={attempt.id} value={attempt.id}>{attempt.label}{attempt.createdAt?` · ${attempt.createdAt.slice(0,10)}`:''}</option>)}</select></label>}
  <section className="application-form-section"><h4>Résumé</h4><p className="mt-2 text-sm">{savedResume?.name||'Not available'}</p>{savedResume?.version!=null&&<p className="mt-1 text-sm text-board-muted">Version {savedResume.version}</p>}{snapshot?.resume?.objectPath&&onDownloadResume&&<button className={`${secondary} mt-3`} onClick={()=>onDownloadResume(snapshot.resume!)}>Download résumé</button>}</section>
  <section className="application-form-section"><h4>Employer questions</h4>{questions.length?<div className="application-form-answers">{questions.map((question,index)=><details key={index} className="border-b border-board-line py-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">{question.question||'Employer question'}</summary><p className="whitespace-pre-wrap break-words pb-3 text-sm text-board-muted">{('fieldType' in question&&question.fieldType==='file'&&question.answer===savedResume?.id)?savedResume?.name||'Recorded attachment':display(question.answer)}</p></details>)}</div>:<p className="mt-3 text-sm text-board-muted">Not available.</p>}</section>
 </section>;
}
