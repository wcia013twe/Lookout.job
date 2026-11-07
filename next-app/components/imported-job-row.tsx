import {useState} from 'react';
import {importStatuses,importEmploymentTypes} from '../../lib/simplify-import.mjs';
import {useWorkspace} from '../lib/workspace';
import {Field,control,primary,secondary} from './ui';
import type {Application} from './workflow-types';
import {ApplicationIdentity} from './tracker-progress';
export default function ImportedJobRow({application:a,imports}:{application:Application;imports?:any}){
 const w=useWorkspace();
 const [draft,setDraft]=useState<any>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const imported=a.imported!,r=imported.record,sources=imported.source_rows||[];
 async function save(){
  setBusy(true);setMessage('');
  try{
   const changes=Object.fromEntries(Object.entries(draft.changes).filter(([k,v])=>v!==r[k]));
   if(!Object.keys(changes).length){setDraft(null);return;}
   const saved=await imports.call('update',{id:imported.id,expectedVersion:draft.version,eventKey:draft.eventKey,changes});
   const readback=await imports.call('list');
   const confirmed=readback.records.find((record:any)=>record.id===imported.id);
   if(!confirmed||Object.keys(changes).some(k=>JSON.stringify(confirmed.record[k])!==JSON.stringify(saved.record.record[k])))throw Error('Update was saved, but read-back differs. Reload the tracker before editing again.');
   await imports.refresh();setDraft(null);setMessage('Tracker updated.');
  }catch(e:any){setMessage(e.message);}finally{setBusy(false);}
 }
 return <li className="glass-inset rounded-2xl border border-board-line p-4"><details>
  <summary className="min-h-11 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-board-accent"><span className="inline-grid w-[calc(100%-1.5rem)] grid-cols-2 gap-x-4 gap-y-2 align-middle sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"><span className="tracker-role col-span-2 min-w-0 sm:col-span-1"><ApplicationIdentity company={a.company} title={a.title} location={a.location||'Location not recorded'}/></span><span className="text-sm">{importStatuses[r.status]} · {importEmploymentTypes[r.employmentType]||r.employmentType}{r.archived?' · Archived':''}</span><span className="text-sm text-board-muted">Simplify import{r.appliedDate&&<span className="block">Applied {r.appliedDate}</span>}</span></span></summary>
  <div className="mt-4 space-y-3 pl-3 text-sm">
   <p>{r.status==='SAVED'?'Saved in Simplify. No application reported.':`${importStatuses[r.status]}. Applied date: ${r.appliedDate||'Not recorded'}. User-reported; no verified submission receipt.`}</p>
   {imports&&!draft&&<button className={secondary} disabled={w.locked} onClick={()=>{setMessage('');setDraft({version:imports.version,eventKey:`tracker:${crypto.randomUUID()}`,changes:Object.fromEntries(['title','location','employmentType','status','statusDate','appliedDate','notes','archived','archivedDate'].map(k=>[k,r[k]]))});}}>Edit tracked job</button>}
   {draft&&<form className="space-y-4" onSubmit={e=>{e.preventDefault();void save();}}>
    <div className="grid gap-4 sm:grid-cols-2">
     <Field label="Job title"><input className={control} required maxLength={500} disabled={busy} value={draft.changes.title} onChange={e=>setDraft({...draft,changes:{...draft.changes,title:e.target.value}})}/></Field>
     <Field label="Location"><input className={control} maxLength={500} disabled={busy} value={draft.changes.location} onChange={e=>setDraft({...draft,changes:{...draft.changes,location:e.target.value}})}/></Field>
     <Field label="Job type"><select className={control} disabled={busy} value={draft.changes.employmentType} onChange={e=>setDraft({...draft,changes:{...draft.changes,employmentType:e.target.value}})}>{Object.entries(importEmploymentTypes).map(([value,label])=><option key={value} value={value}>{label as string}</option>)}</select></Field>
     <Field label="Hiring status"><select className={control} disabled={busy} value={draft.changes.status} onChange={e=>setDraft({...draft,changes:{...draft.changes,status:e.target.value}})}>{Object.entries(importStatuses).map(([value,label])=><option key={value} value={value}>{label as string}</option>)}</select></Field>
     {(['appliedDate','statusDate','archivedDate'] as const).map(k=><Field key={k} label={k==='appliedDate'?'Applied date (if known)':k==='statusDate'?'Status date (if known)':'Archived date (if known)'}><input className={control} type="date" disabled={busy} value={draft.changes[k]||''} onChange={e=>setDraft({...draft,changes:{...draft.changes,[k]:e.target.value||null}})}/></Field>)}
    </div>
    <Field label="Notes"><textarea className={control} maxLength={10000} disabled={busy} value={draft.changes.notes} onChange={e=>setDraft({...draft,changes:{...draft.changes,notes:e.target.value}})}/></Field>
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" disabled={busy} checked={draft.changes.archived} onChange={e=>setDraft({...draft,changes:{...draft.changes,archived:e.target.checked}})}/>Archived</label>
    <div className="flex flex-wrap gap-3"><button className={primary} disabled={busy||w.locked}>{busy?'Saving…':'Save tracked job'}</button><button className={secondary} type="button" disabled={busy} onClick={()=>setDraft(null)}>Cancel</button></div>
   </form>}
   {message&&<p role="status">{message}</p>}
   {r.statusDate&&<p>Status date: {r.statusDate}</p>}{r.archivedDate&&<p>Archived date: {r.archivedDate}</p>}
   {r.notes&&<p className="max-w-prose whitespace-pre-wrap break-words">{r.notes}</p>}
   {r.url?<a className="inline-flex min-h-11 items-center underline underline-offset-4" href={r.url} target="_blank" rel="noopener noreferrer">Open original job link</a>:<p>No job link was included in this export.</p>}
   {(imported.source_rows?.length||0)>1&&<details><summary className="min-h-11 cursor-pointer">Original reports ({sources.length})</summary><ul>{sources.map((source:any,i:number)=><li className="border-t border-board-line py-2" key={i}>{source.status} · {source.appliedDate||source.statusDate||'Date not recorded'}{source.notes&&<p className="whitespace-pre-wrap break-words">{source.notes}</p>}</li>)}</ul></details>}
  </div>
 </details></li>;
}
