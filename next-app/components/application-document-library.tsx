"use client";
import {useEffect,useMemo,useState,type FormEvent} from "react";
import {createBackend} from "../../backend/client.mjs";
import {useWorkspace} from "../lib/workspace";
import {ProfileCard} from "./profile-section";
import {control,Field,primary,secondary,Notice} from "./ui";
import {errorMessage} from "./profile-types";
type Kind="cover_letter"|"application_template";
type Document={id:string;version:number;content:{title:string;body?:string;purpose:string;kind:Kind}};
export default function ApplicationDocumentLibrary({kind}:{kind:Kind}){
 const w=useWorkspace(),owner=w.demo?`demo-${w.demoEpoch}`:w.user?.id;
 const services=useMemo(()=>owner?w.services||createBackend(w.client,owner):null,[owner,w.services,w.client]);
 const [items,setItems]=useState<Document[]>([]),[loading,setLoading]=useState(true),[feedback,setFeedback]=useState(""),[busy,setBusy]=useState(false),[offset,setOffset]=useState<number|null>(null);
 const [editor,setEditor]=useState<{id:string;version:number;title:string;body:string;base?:Record<string,any>}|null>(null);
 const label=kind==="cover_letter"?"cover letter":"template",title=kind==="cover_letter"?"Cover letters":"Templates";
 const stillOwner=()=>w.demo||window.JB?.auth?.userId===owner;
 async function load(page=0){
  if(!services){setLoading(false);return;}
  setLoading(true);
  try{const result=await services.artifactAction("artifacts.list",{kind,offset:page});if(!stillOwner())return;setItems(old=>page?[...old,...result.items]:result.items);setOffset(result.nextOffset);}
  catch{if(stillOwner())setFeedback("Documents could not load. Retry when connected; the document service may need updating.");}
  finally{if(stillOwner())setLoading(false);}
 }
 useEffect(()=>{let cancelled=false;setItems([]);setEditor(null);setFeedback("");setLoading(true);
  if(!services){setLoading(false);return;}
  services.artifactAction("artifacts.list",{kind}).then((r:{items:Document[];nextOffset:number|null})=>{if(!cancelled&&stillOwner()){setItems(r.items);setOffset(r.nextOffset);}}).catch(()=>{if(!cancelled)setFeedback("Documents could not load. Retry when connected; the document service may need updating.");}).finally(()=>{if(!cancelled)setLoading(false);});
  return()=>{cancelled=true;};
 },[services,kind]);
 async function edit(row:Document){
  if(!services||busy)return;setBusy(true);setFeedback("");
  try{const current=await services.artifactAction("artifacts.read",{id:row.id});if(stillOwner())setEditor({id:current.id,version:current.version,title:current.content.title,body:current.content.body,base:current.content});}
  catch(e){if(stillOwner())setFeedback(errorMessage(e));}finally{if(stillOwner())setBusy(false);}
 }
 async function save(e:FormEvent){
  e.preventDefault();if(!services||!editor||busy||w.locked)return;setBusy(true);setFeedback("");
  try{const row=await services.artifactAction("artifacts.save",{id:editor.id,expectedVersion:editor.version,...editor.base,title:editor.title.trim(),purpose:editor.base?.purpose || (kind==="cover_letter"?"Saved application cover letter; review before use.":"Reusable application template; replace placeholders and review before use."),kind,format:editor.base?.format || "markdown",body:editor.body.trim(),sources:editor.base?.sources || [],links:editor.base?.links || []});if(!stillOwner())return;setItems(old=>[row,...old.filter(r=>r.id!==row.id)]);setEditor(null);setFeedback(`${kind==="cover_letter"?"Cover letter":"Template"} saved${w.demo?" in demo memory":""}.`);}
  catch(e){if(stillOwner())setFeedback(`${errorMessage(e)} Your draft is kept. If this document changed elsewhere, reload it before revising.`);}finally{if(stillOwner())setBusy(false);}
 }
 async function archive(row:Document){
  if(!services||busy||w.locked)return;setBusy(true);setFeedback("");
  try{await services.artifactAction("artifacts.archive",{id:row.id,expectedVersion:row.version,archived:true});if(stillOwner()){setItems(old=>old.filter(r=>r.id!==row.id));setFeedback("Document archived. Earlier versions remain in Career Toolkit.");}}
  catch(e){if(stillOwner())setFeedback(errorMessage(e));}finally{if(stillOwner())setBusy(false);}
 }
 return <ProfileCard title={title}>
  <p className="mb-4 text-sm text-board-muted">{kind==="cover_letter"?"Save letters for specific applications or a starting point for your next draft.":"Keep reusable resume, cover letter, or outreach text. Replace placeholders before using it."} Shared across profiles.</p>
  {loading?<Notice>Loading {title.toLowerCase()}…</Notice>:!items.length&&!feedback&&<p className="text-sm text-board-muted">No {title.toLowerCase()} added yet.</p>}
  <ul className="divide-y divide-board-line">{items.map(row=><li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 flex-1"><p className="break-words font-semibold">{row.content.title}</p><p className="mt-1 text-xs text-board-muted">Version {row.version} · Private</p></div><div className="flex flex-wrap gap-2"><button type="button" className={secondary} disabled={busy||!!editor} onClick={()=>edit(row)}>Open / edit {label}</button><button type="button" className={secondary} disabled={busy||!!editor||w.locked} onClick={()=>archive(row)}>Archive {label}</button></div></li>)}</ul>
  {!editor&&<div className="mt-4 flex flex-wrap gap-3"><button type="button" className={secondary} disabled={!services||busy||w.locked} onClick={()=>{setFeedback("");setEditor({id:crypto.randomUUID(),version:0,title:"",body:""});}}>Add {label}</button>{feedback&&<button type="button" className={secondary} disabled={busy||loading} onClick={()=>load()}>Reload {title.toLowerCase()}</button>}</div>}
  {offset!==null&&!editor&&<button type="button" className={`${secondary} mt-4`} disabled={busy||loading} onClick={()=>load(offset)}>Load more {title.toLowerCase()}</button>}
  {!owner&&<Notice>Sign in to save {title.toLowerCase()}.</Notice>}
  {editor&&<form onSubmit={save} className="mt-5 space-y-5 border-t border-board-line pt-5"><Field label={`${kind==="cover_letter"?"Cover letter":"Template"} title`}><input className={control} value={editor.title} required maxLength={200} disabled={busy} onChange={e=>setEditor({...editor,title:e.target.value})}/></Field><Field label={`${kind==="cover_letter"?"Cover letter":"Template"} content`}><textarea className={`${control} min-h-60 leading-relaxed`} value={editor.body} required maxLength={150000} disabled={busy} placeholder="Paste text or a document link. Markdown is supported." onChange={e=>setEditor({...editor,body:e.target.value})}/></Field><p className="text-xs text-board-muted">Text and document links are saved here. Links retain their host’s access settings. Saving does not send or approve an application.</p><div className="flex flex-wrap gap-3"><button className={primary} disabled={busy||!editor.title.trim()||!editor.body.trim()}>{busy?"Saving…":`Save ${label}`}</button><button type="button" className={secondary} disabled={busy} onClick={()=>setEditor(null)}>Cancel</button></div></form>}
  <Notice>{feedback}</Notice>
 </ProfileCard>;
}
