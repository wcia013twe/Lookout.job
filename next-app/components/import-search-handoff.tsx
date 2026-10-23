"use client";
import {useEffect,useRef,useState} from 'react';
import {useWorkspace} from '../lib/workspace';
import {parseSimplifyCsv,MAX_CSV_BYTES} from '../../lib/simplify-import.mjs';
import {parseDemoSimplify} from '../lib/simplify-import-demo.mjs';
import {primary,secondary} from './ui';
import styles from './import-search-handoff.module.css';
export default function ImportSearchHandoff({imports}:{imports:any}){
 const w=useWorkspace(),[parsed,setParsed]=useState<any>(null),[preview,setPreview]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[feedback,setFeedback]=useState('');
 const request=useRef<any>(null),generation=useRef(0);
 useEffect(()=>{generation.current++;setParsed(null);setPreview(null);setError('');setFeedback('');setBusy(false);request.current=null;},[imports.scope]);
 async function inspect(file?:File){
  const turn=++generation.current;setBusy(true);setError('');setFeedback('');setPreview(null);setParsed(null);request.current=null;
  try{
   if(file&&file.size>MAX_CSV_BYTES)throw Error('Choose a CSV smaller than 200 KB.');
   const data=w.demo?parseDemoSimplify():parseSimplifyCsv(await file!.text());
   if(generation.current!==turn)return;
   const next=await imports.call('preview',{rows:data.rows});
   if(generation.current!==turn)return;
   setParsed(data);setPreview(next);request.current={rows:data.rows,expectedVersion:next.version,eventKey:`simplify:${crypto.randomUUID()}`};
  }catch(e:any){if(generation.current===turn)setError(e.message);}finally{if(generation.current===turn)setBusy(false);}
 }
 async function save(){
  const turn=generation.current;setBusy(true);setError('');
  try{const result=await imports.call('save',request.current);if(turn!==generation.current)return;
   setFeedback(`${result.added} jobs imported. ${result.skipped} existing jobs preserved. ${result.duplicateRows} repeated rows combined.`);setPreview(null);setParsed(null);request.current=null;await imports.refresh();
  }catch(e:any){if(turn===generation.current)setError(e.message);}finally{if(turn===generation.current)setBusy(false);}
 }
 return <details className={styles.handoff}>
  <summary>Import from Simplify</summary>
  <div className={styles.content}>
   <p>Bring your saved jobs and application history into Lookout. Export tracked jobs from Simplify, then choose the CSV.</p>
   <p>Existing statuses stay unchanged. Imported applications are user-reported; notes and jobs without links stay private.</p>
   {w.demo?<button className={secondary} disabled={busy} onClick={()=>void inspect()}>Preview fictional Simplify CSV</button>:<label className="block text-sm">Simplify tracked-jobs CSV<input className="mt-2 block w-full min-h-11" type="file" accept=".csv,text/csv" disabled={busy||!w.user||w.locked} onChange={e=>{const file=e.target.files?.[0];if(file)void inspect(file);e.target.value='';}}/></label>}
   {!w.demo&&!w.user&&<p>Sign in to import into your private tracker.</p>}
   {busy&&<p role="status">{preview?'Saving imported history…':'Checking your CSV…'}</p>}
   {error&&<p role="alert">{error}</p>}
   {feedback&&<p role="status">{feedback}</p>}
   {preview&&parsed&&<div className="mt-4">
    <p><strong>{parsed.total} rows reviewed</strong> · {preview.added} new jobs · {preview.skipped} existing · {preview.duplicateRows} repeated rows</p>
    <p>{parsed.applied} applied · {parsed.saved} saved · {parsed.missingUrls} without links. Repeated rows retain their original history; an applied report takes precedence over saved.</p>
    <div className="max-h-80 overflow-auto rounded-lg border border-board-line"><table className="w-full text-left text-sm"><caption className="sr-only">Simplify import preview</caption><thead><tr><th scope="col" className="p-3">Job</th><th scope="col" className="p-3">Status</th><th scope="col" className="p-3">Import</th></tr></thead><tbody>{preview.decisions.map((d:any,i:number)=><tr className="border-t border-board-line" key={i}><td className="p-3"><strong>{d.record.company}</strong><br/>{d.record.title}{!d.record.url&&<small className="block">No job link</small>}</td><td className="p-3">{d.record.status==='APPLIED'?'Applied':'Saved'}{d.record.archived?' · Archived':''}</td><td className="p-3">{d.disposition==='new'?'Add':`${d.disposition} · keep unchanged`}{d.existingStatus&&<small className="block">Current status: {d.existingStatus}</small>}{d.duplicateRows>0&&<small className="block">{d.duplicateRows} repeated rows combined</small>}</td></tr>)}</tbody></table></div>
    <div className="mt-4 flex flex-wrap gap-3"><button className={primary} disabled={busy||w.locked} onClick={()=>void save()}>Import {preview.added} jobs{w.demo?' into demo':''}</button><button className={secondary} disabled={busy} onClick={()=>{generation.current++;setPreview(null);setParsed(null);request.current=null;}}>Cancel</button></div>
   </div>}
  </div>
 </details>;
}
