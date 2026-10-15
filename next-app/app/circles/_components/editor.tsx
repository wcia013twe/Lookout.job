'use client';
import {useState,type FormEvent} from 'react';
import {Field,Notice,control,primary,secondary} from '../../../components/ui';
import {types,type Content} from '../_lib/types';
type Props={initial?:Content;reply?:boolean;busy:boolean;save:(content:Content)=>Promise<void>;cancel:()=>void};
export default function Editor({initial,reply,busy,save,cancel}:Props){
 const [error,setError]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=new FormData(event.currentTarget),value=(key:string)=>String(form.get(key)||'').trim();
  const sources=value('sources').split('\n').filter(Boolean).map(line=>{const [url,...label]=line.trim().split(/\s+/);return {url,label:label.join(' ')||url};});
  try{
   if(sources.length>10||sources.some(s=>{try{const u=new URL(s.url);return u.protocol!=='https:'||!!u.username||!!u.password;}catch{return true;}}))throw Error('Use up to 10 public HTTPS sources, one per line.');
   const content:Content={title:reply?'Reply':value('title'),body:value('body'),type:reply?'reply':value('type'),sources,provenance:value('provenance'),personalDisclosure:form.has('personalDisclosure')};
   for(const key of ['company','role','stage','experienceDate','uncertainty'] as const)if(value(key))content[key]=value(key);
   setError('');await save(content);
  }catch(e){setError(e instanceof Error?e.message:'Draft could not save. Try again.');}
 }
 return <form onSubmit={submit} className="space-y-5 border-y border-board-line py-6" aria-label={reply?'Write a reply':'Contribution editor'}>
  <h2 className="text-lg font-bold">{reply?'Write a reply':initial?'Edit contribution':'Share what you learned'}</h2>
  <p className="max-w-prose text-sm text-board-muted">Save a private draft, then review the exact text before sharing with this Circle. Leave unknown details blank. Include only sources safe for every member to open.</p>
  {!reply&&<div className="grid gap-4 sm:grid-cols-[1fr_2fr]"><Field label="Content type"><select name="type" className={control} defaultValue={initial?.type||'interview_report'}>{Object.entries(types).filter(([k])=>k!=='reply').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field><Field label="Title"><input name="title" className={control} defaultValue={initial?.title} required maxLength={200}/></Field></div>}
  <Field label={reply?'Your reply':'Experience or useful information'}><textarea name="body" className={`${control} min-h-40`} defaultValue={initial?.body} required maxLength={12000}/></Field>
  {!reply&&<div className="grid gap-4 sm:grid-cols-3"><Field label="Company (optional)"><input name="company" className={control} defaultValue={initial?.company} maxLength={200}/></Field><Field label="Role (optional)"><input name="role" className={control} defaultValue={initial?.role} maxLength={200}/></Field><Field label="Stage (optional)"><input name="stage" className={control} defaultValue={initial?.stage} maxLength={200}/></Field></div>}
  <div className="grid gap-4 sm:grid-cols-2"><Field label="Source classification (reported)"><select name="provenance" className={control} defaultValue={initial?.provenance||'user_confirmed'}><option value="user_confirmed">My confirmed experience</option><option value="employer_verified">Employer source provided</option><option value="agent_observed">Agent observed</option><option value="agent_inferred">Agent inference</option><option value="unknown">Unknown</option></select></Field><Field label="Experience date (optional)"><input name="experienceDate" type="date" className={control} defaultValue={initial?.experienceDate}/></Field></div>
  <Field label="Public sources (optional; HTTPS URL followed by a label, one per line)"><textarea name="sources" className={`${control} min-h-24`} defaultValue={initial?.sources.map(s=>`${s.url} ${s.label}`).join('\n')} placeholder="https://example.com/public-page Source title"/></Field>
  <Field label="Uncertainty or limits (optional)"><input name="uncertainty" className={control} defaultValue={initial?.uncertainty} maxLength={1000}/></Field>
  <label className="flex min-h-11 items-center gap-3 text-sm"><input name="personalDisclosure" type="checkbox" defaultChecked={initial?.personalDisclosure??false}/>Includes personal application status, an offer, compensation, or other personal details</label>
  <div role="alert"><Notice>{error}</Notice></div>
  <div className="flex flex-wrap gap-3"><button className={primary} disabled={busy}>Save private draft</button><button className={secondary} type="button" disabled={busy} onClick={cancel}>Cancel</button></div>
 </form>;
}
