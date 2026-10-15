'use client';
import {useState,type FormEvent} from 'react';
import {Field,Notice,control,primary,secondary} from '../../../components/ui';
import {types,type Content} from '../_lib/types';
import {validateCircleContextContent} from '../../../../lib/circle-context.mjs';
type Props={initial?:Content;reply?:boolean;busy:boolean;save:(content:Content)=>Promise<void>;cancel:()=>void};
export default function Editor({initial,reply,busy,save,cancel}:Props){
 const [error,setError]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=new FormData(event.currentTarget),value=(key:string)=>String(form.get(key)||'').trim();
  const sources=value('sources').split('\n').filter(Boolean).map(line=>{const [url,...label]=line.trim().split(/\s+/);return {url,label:label.join(' ')||url};});
  try{
   if(sources.length>10||sources.some(s=>{try{const u=new URL(s.url);return u.protocol!=='https:'||!!u.username||!!u.password;}catch{return true;}}))throw Error('Use up to 10 public HTTPS sources, one per line.');
   if(!value('body')&&!value('insight'))throw Error('Add an insight or a message before saving.');
   const content:Content={title:reply?'Reply':value('title')||value('insight').slice(0,100)||value('body').slice(0,100),body:value('body'),type:reply?'reply':value('type'),sources,provenance:value('provenance'),personalDisclosure:form.has('personalDisclosure')};
   for(const key of ['company','role','stage','experienceDate','uncertainty','insight','jobUrl'] as const)if(value(key))content[key]=value(key);
   validateCircleContextContent(content);
   setError('');await save(content);
  }catch(e){setError(e instanceof Error?e.message:'Draft could not save. Try again.');}
 }
 return <form onSubmit={submit} className="space-y-5 border-y border-board-line py-6" aria-label={reply?'Write a reply':'Contribution editor'}>
  <h2 className="text-lg font-bold">{reply?'Write a reply':initial?'Edit contribution':'Share useful context'}</h2>
  <p className="max-w-prose text-sm leading-relaxed text-board-muted">{reply?'Your draft stays private until you share it.':'A useful insight is enough. You do not need to write a post. Review before sharing.'}</p>
  {reply?<Field label="Your reply"><textarea name="body" className={`${control} min-h-40`} defaultValue={initial?.body} required maxLength={12000}/></Field>:<>
   <Field label="Insight"><textarea name="insight" className={`${control} min-h-24`} defaultValue={initial?.insight} required={!initial?.body} maxLength={4000} placeholder="What could help someone else?"/></Field>
   <div className="grid gap-4 sm:grid-cols-2"><Field label="Job link (optional)"><input name="jobUrl" type="url" pattern="https://.*" className={control} defaultValue={initial?.jobUrl} maxLength={2000} placeholder="https://…"/></Field><Field label="Stage (optional)"><input name="stage" className={control} defaultValue={initial?.stage} maxLength={200} placeholder="e.g. Technical interview"/></Field></div>
   <details open={!!initial?.body||undefined}><summary className="min-h-11 cursor-pointer py-2 text-sm text-board-muted">Add a human message (optional)</summary><div className="pt-3"><Field label="Message to your Circle"><textarea name="body" className={`${control} min-h-24`} defaultValue={initial?.body} maxLength={12000}/></Field></div></details>
  </>}
  <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed"><input name="personalDisclosure" className="mt-1" type="checkbox" defaultChecked={initial?.personalDisclosure??false}/>Contains personal details</label>
  <details className="border-y border-board-line py-2" open={!!initial?.sources.length||undefined}><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">More details <span className="font-normal text-board-muted">(optional)</span></summary><div className="space-y-5 py-4">
  <p className="max-w-prose text-sm leading-relaxed text-board-muted">Add public links or context if useful.</p>
  {!reply&&<Field label="Title (optional)"><input name="title" className={control} defaultValue={initial?.title} maxLength={200}/></Field>}
  {!reply&&<Field label="Contribution type"><select name="type" className={control} defaultValue={initial?.type||'interview_report'}>{Object.entries(types).filter(([key])=>key!=='reply').map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></Field>}
  {!reply&&<div className="grid gap-4 sm:grid-cols-2"><Field label="Company (optional)"><input name="company" className={control} defaultValue={initial?.company} maxLength={200}/></Field><Field label="Role (optional)"><input name="role" className={control} defaultValue={initial?.role} maxLength={200}/></Field></div>}
  <div className="grid gap-4 sm:grid-cols-2"><Field label="Source classification (reported)"><select name="provenance" className={control} defaultValue={initial?.provenance||'user_confirmed'}><option value="user_confirmed">My confirmed experience</option><option value="employer_verified">Employer source provided</option><option value="agent_observed">Agent observed</option><option value="agent_inferred">Agent inference</option><option value="unknown">Unknown</option></select></Field><Field label="Experience date (optional)"><input name="experienceDate" type="date" className={control} defaultValue={initial?.experienceDate}/></Field></div>
  <Field label="Public sources (optional; HTTPS URL followed by a label, one per line)"><textarea name="sources" className={`${control} min-h-24`} defaultValue={initial?.sources.map(s=>`${s.url} ${s.label}`).join('\n')} placeholder="https://example.com/public-page Source title"/></Field>
  <Field label="Uncertainty or limits (optional)"><input name="uncertainty" className={control} defaultValue={initial?.uncertainty} maxLength={1000}/></Field>
  </div></details>
  <div role="alert"><Notice>{error}</Notice></div>
  <div className="flex flex-wrap gap-3"><button className={primary} disabled={busy}>{busy?'Saving draft…':'Save private draft'}</button><button className={secondary} type="button" disabled={busy} onClick={cancel}>Cancel</button></div>
 </form>;
}
