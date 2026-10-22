'use client';
import {useState,type FormEvent} from 'react';
import {COMPANY_PRIORITIES} from '../../lib/network-model.mjs';
import {Field,Notice,control,primary,secondary} from './ui';
import type {Application} from './workflow-types';
export type Company={name:string;website:string;priority:string;interest:string;targetTeams:string;concerns:string;research:string;nextAction:string;followUpDate:string;sources:{title:string;url:string;observedAt:string;summary:string}[];contactIds:string[];applicationIds:string[];archived:boolean};
export type CompanyRow={id:string;record:Company;revision:number;companyId?:string|null;needsReview?:boolean;legacyNotes?:string;conflict?:boolean;suggested?:boolean;updated_at?:string};
export type EditMode='create'|'focus'|'next'|'brief'|'details';
const headings={create:'Add a company',focus:'Adjust your focus',next:'Change next step',brief:'Edit company brief',details:'Company settings'};
type Props={row:CompanyRow;mode:EditMode;contacts:{id:string;company:string;contact?:string;name?:string}[];applications:Application[];onSave:(r:CompanyRow)=>Promise<unknown>;onCancel:()=>void;onReload:()=>void;disabled:boolean};
export default function NetworkCompanyEditor({row,mode,contacts,applications,onSave,onCancel,onReload,disabled}:Props){
 const [record,setRecord]=useState<Company>(row.record),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const field=(key:keyof Company,value:unknown)=>setRecord(r=>({...r,[key]:value}));
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{await onSave({...row,record});}catch(error){setError(error instanceof Error?error.message:'Changes could not save. Try again.');}finally{setBusy(false);}}
 const toggle=(key:'contactIds'|'applicationIds',id:string)=>field(key,record[key].includes(id)?record[key].filter(v=>v!==id):[...record[key],id]);
 return <form aria-label={headings[mode]} onSubmit={submit} className="max-w-2xl rounded-xl border border-board-line bg-board-panel p-5 sm:p-6">
  <h3 className="text-lg font-semibold">{headings[mode]}</h3>
  <fieldset disabled={busy||disabled} className="mt-5 space-y-5">
   {(mode==='create'||mode==='details')&&<Field label="Company name"><input aria-label="Company name" autoFocus className={control} required maxLength={200} value={record.name} onChange={e=>field('name',e.target.value)}/></Field>}
   {(mode==='create'||mode==='focus')&&<Field label="Roles or teams you’re interested in"><input aria-label="Roles or teams you’re interested in" autoFocus={mode==='focus'} className={control} maxLength={10000} placeholder="e.g. New grad · backend & infrastructure" value={record.targetTeams} onChange={e=>field('targetTeams',e.target.value)}/></Field>}
   {mode==='create'&&<p className="text-sm leading-relaxed text-board-muted">That’s enough to get started. Research, people and applications can be added as you go.</p>}
   {mode==='focus'&&<>
    <Field label="What matters to you"><textarea aria-label="What matters to you" className={control} rows={3} maxLength={10000} value={record.interest} onChange={e=>field('interest',e.target.value)}/></Field>
    <Field label="Questions to resolve"><textarea aria-label="Questions to resolve" className={control} rows={2} maxLength={10000} value={record.concerns} onChange={e=>field('concerns',e.target.value)}/></Field>
    <Field label="Priority"><select aria-label="Priority" className={control} value={record.priority} onChange={e=>field('priority',e.target.value)}>{COMPANY_PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></Field>
   </>}
   {mode==='next'&&<><Field label="Next step"><textarea aria-label="Next step" autoFocus className={control} rows={3} maxLength={10000} value={record.nextAction} onChange={e=>field('nextAction',e.target.value)}/></Field><Field label="Follow-up date"><input aria-label="Follow-up date" className={control} type="date" value={record.followUpDate} onChange={e=>field('followUpDate',e.target.value)}/></Field></>}
   {mode==='brief'&&<>
    <Field label="Company brief"><textarea aria-label="Company brief" autoFocus className={control} rows={6} maxLength={10000} value={record.research} onChange={e=>field('research',e.target.value)}/></Field>
    <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Edit research sources ({record.sources.length})</summary>
     {record.sources.map((s,i)=><div key={i} className="space-y-3 border-t border-board-line py-5">
      <Field label={`Source ${i+1} title`}><input aria-label={`Source ${i+1} title`} className={control} required maxLength={200} value={s.title} onChange={e=>field('sources',record.sources.map((v,n)=>n===i?{...v,title:e.target.value}:v))}/></Field>
      <Field label={`Source ${i+1} URL`}><input aria-label={`Source ${i+1} URL`} className={control} type="url" required maxLength={2048} value={s.url} onChange={e=>field('sources',record.sources.map((v,n)=>n===i?{...v,url:e.target.value}:v))}/></Field>
      <Field label={`Source ${i+1} observed date`}><input aria-label={`Source ${i+1} observed date`} className={control} type="date" required value={s.observedAt} onChange={e=>field('sources',record.sources.map((v,n)=>n===i?{...v,observedAt:e.target.value}:v))}/></Field>
      <Field label={`Source ${i+1} findings`}><textarea aria-label={`Source ${i+1} findings`} className={control} maxLength={2000} value={s.summary} onChange={e=>field('sources',record.sources.map((v,n)=>n===i?{...v,summary:e.target.value}:v))}/></Field>
      <button type="button" className={secondary} onClick={()=>field('sources',record.sources.filter((_,n)=>n!==i))}>Remove source {i+1}</button>
     </div>)}<button type="button" className={secondary} disabled={record.sources.length>=30} onClick={()=>field('sources',[...record.sources,{title:'',url:'',observedAt:'',summary:''}])}>Add source</button>
    </details>
   </>}
   {mode==='details'&&<>
    <Field label="Company website"><input aria-label="Company website" className={control} type="url" placeholder="https://" maxLength={2048} value={record.website} onChange={e=>field('website',e.target.value)}/></Field>
    <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Linked people and applications</summary><p className="my-3 text-sm text-board-muted">Matching records appear automatically. Add explicit links for aliases or other connections.</p>
     <h4 className="font-semibold">People</h4>{contacts.map(c=><label key={c.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={record.contactIds.includes(c.id)} onChange={()=>toggle('contactIds',c.id)}/>{c.contact||c.name} · {c.company}</label>)}
     {record.contactIds.filter(id=>!contacts.some(c=>c.id===id)).map(id=><label key={id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked onChange={()=>toggle('contactIds',id)}/>Unavailable contact · remove link</label>)}
     <h4 className="mt-4 font-semibold">Applications</h4>{applications.filter(a=>a.backendId).map(a=><label key={a.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={record.applicationIds.includes(a.backendId!)} onChange={()=>toggle('applicationIds',a.backendId!)}/>{a.company} · {a.title}</label>)}
     {record.applicationIds.filter(id=>!applications.some(a=>a.backendId===id)).map(id=><label key={id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked onChange={()=>toggle('applicationIds',id)}/>Unavailable application · remove link</label>)}
    </details>
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={record.archived} onChange={e=>field('archived',e.target.checked)}/>Archive company and pause its follow-up reminders</label>
   </>}
   <div className="flex flex-wrap gap-3"><button className={primary}>{busy?'Saving…':mode==='create'?'Add company':'Save changes'}</button><button type="button" className={secondary} onClick={onCancel}>Cancel</button></div>
  </fieldset>
  {error&&<><Notice>{error}</Notice><button type="button" className={`${secondary} mt-3`} onClick={onReload}>Discard draft & reload saved company</button></>}
 </form>;
}
