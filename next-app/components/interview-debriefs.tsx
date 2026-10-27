"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { subscribePreparationRefresh } from "../lib/action-board.mjs";
import { createBackend } from "../../backend/client.mjs";
import { debriefMarker, debriefPayload } from "../../lib/interview-debrief.mjs";
import type { Application } from "./workflow-types";
import { control, primary, secondary, Notice } from "./ui";
type Note = { id: string; version: number; content: { title: string; purpose: string; body: string; sources?: unknown[]; links?: unknown[] }; updated_at: string };
type Draft = { id: string; version: number; round?: string; summary: string; original?: Note['content'] };
export default function InterviewDebriefs({ application }: { application: Application }) {
  const w=useWorkspace();
  return <Notes key={`${w.demo ? `demo-${w.demoEpoch}` : w.user?.id || 'guest'}:${application.backendId || application.id}`} application={application}/>;
}
function Notes({ application }: { application: Application }) {
  const w=useWorkspace(), owner=w.demo?'demo':w.user?.id||null;
  const api=useMemo(()=>w.demo?w.services:w.client&&w.user?createBackend(w.client,w.user.id):null,[w.demo,w.services,w.client,w.user?.id]);
  const [rows,setRows]=useState<Note[]>([]),[draft,setDraft]=useState<Draft|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const active=useRef(true), request=useRef(0), identity=useRef(owner);identity.current=owner;
  const marker=debriefMarker(application.backendId||application.id);
  const load=useCallback(async()=>{
    const ticket=++request.current;
    const current=()=>active.current&&request.current===ticket&&identity.current===owner&&(w.demo||window.JB?.auth?.userId===owner);
    if(!api){setLoading(false);return;}
    try {
      const metadata:Note[]=[];let offset:number|null=0;
      do {const page:{items:Note[];nextOffset:number|null}=await api.artifactAction('artifacts.list',{kind:'notes',query:marker,offset});if(!current())return;metadata.push(...page.items.filter((r:Note)=>r.content.purpose.startsWith(marker+' ')));offset=page.nextOffset;}while(offset!==null&&offset!==undefined);
      const records=await Promise.all(metadata.map(r=>api.artifactAction('artifacts.read',{id:r.id})));
      if(current()){setRows(records);setError('');}
    } catch(e){if(current())setError(e instanceof Error?e.message:'Notes could not load.');}
    finally{if(current())setLoading(false);}
  },[api,marker,owner,w.demo]);
  useEffect(()=>{active.current=true;void load();const stop=owner&&!w.demo?subscribePreparationRefresh(document,window,owner,()=>void load()):()=>{};return()=>{active.current=false;++request.current;stop();};},[load,owner,w.demo]);
  async function save(){
    if(!draft||!api||busy||w.locked)return;
    setBusy(true);setError('');++request.current;
    const current=()=>active.current&&identity.current===owner&&(w.demo||window.JB?.auth?.userId===owner);
    try{const result=await api.artifactAction('artifacts.save',debriefPayload(application,draft));if(!current())return;++request.current;setRows(previous=>[result,...previous.filter(r=>r.id!==result.id)]);setDraft(null);setNotice('Note saved privately.');setLoading(false);}
    catch(e){if(current())setError(e instanceof Error?e.message:'Note could not save.');}
    finally{if(current())setBusy(false);}
  }
  return <section className="interview-debriefs" aria-label="Interview notes">
    <header><div><h3>Interview notes</h3><p>Muse saves relevant updates from your conversations here. You can add a note too.</p></div><button className={secondary} disabled={!api||w.locked||busy||!!draft} onClick={()=>{setDraft({id:crypto.randomUUID(),version:0,summary:''});setNotice('');}}>Add note</button></header>
    {!api&&<p className="text-sm text-board-muted">Sign in to save private notes.</p>}
    <Notice>{error}</Notice><p role="status" className="text-sm text-board-muted">{notice}</p>
    {loading?<p className="text-sm text-board-muted">Loading notes…</p>:!rows.length&&!draft&&<p className="debrief-empty">No notes yet. Tell Muse how your interview went.</p>}
    {error&&<button className={secondary} disabled={busy} onClick={()=>void load()}>Reload notes</button>}
    {rows.map(row=><article key={row.id} className="debrief-entry"><h4>{row.content.title}</h4><small>Updated {new Date(row.updated_at).toLocaleDateString()}</small><p className="debrief-summary">{row.content.body}</p><button className={secondary} disabled={busy||w.locked} onClick={()=>setDraft({id:row.id,version:row.version,round:row.content.purpose.slice(marker.length).trim(),summary:row.content.body,original:row.content})}>Edit note</button></article>)}
    {draft&&<form className="debrief-editor" onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy||w.locked} className="space-y-4"><label className="block text-sm text-board-muted">Private note<textarea className={`${control} mt-2 min-h-40`} aria-label="Private interview note" required maxLength={12000} value={draft.summary} onChange={e=>setDraft({...draft,summary:e.target.value})} placeholder="What came up, feedback, or next steps."/></label><div className="debrief-actions"><button className={primary}>{busy?'Saving…':'Save note'}</button><button className={secondary} type="button" onClick={()=>setDraft(null)}>Cancel</button></div></fieldset></form>}
    {w.demo&&<p className="mt-3 text-xs text-board-muted">Fictional demo. Notes stay in this preview.</p>}
  </section>;
}
