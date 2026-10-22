"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "../lib/workspace";
import { createBackend } from "../../backend/client.mjs";
import { debriefMarker, debriefPayload, debriefForumContent } from "../../lib/interview-debrief.mjs";
import { timelineItems } from "../../lib/application-timeline.mjs";
import { useKnowledgeClient } from "../app/circles/_lib/client";
import type { Circle } from "../app/circles/_lib/types";
import type { Application } from "./workflow-types";
import { control, primary, secondary, Notice } from "./ui";
import ProfileIcon from "./profile-icon";
type Debrief = { id: string; version: number; content: { title: string; purpose: string; body: string; kind: string; format: string }; updated_at: string };
type Draft = { id: string; version: number; round: string; summary: string };
export default function InterviewDebriefs({ application }: { application: Application }) {
  const w=useWorkspace();
  return <Debriefs key={`${w.demo ? `demo-${w.demoEpoch}` : w.user?.id || 'guest'}:${application.backendId || application.id}`} application={application}/>;
}
function Debriefs({ application }: { application: Application }) {
  const w=useWorkspace(), knowledge=useKnowledgeClient();
  const owner=w.demo?`demo-${w.demoEpoch}`:w.user?.id||'guest';
  const api=useMemo(()=>w.demo?w.services:w.client&&w.user?createBackend(w.client,w.user.id):null,[w.demo,w.services,w.client,w.user?.id]);
  const [rows,setRows]=useState<Debrief[]>([]),[draft,setDraft]=useState<Draft|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [sharing,setSharing]=useState<Debrief|null>(null),[circles,setCircles]=useState<Circle[]>([]),[circleId,setCircleId]=useState(''),[forumBody,setForumBody]=useState(''),[forumLink,setForumLink]=useState('');
  const active=useRef(true),identity=useRef(owner);identity.current=owner;
  const stillHere=()=>active.current&&identity.current===owner;
  const marker=debriefMarker(application.backendId||application.id);
  const load=useCallback(async()=>{
    if(!api){setLoading(false);return;}
    try {
      const metadata:Debrief[]=[];let offset:number|null=0;
      do {const page:{items:Debrief[];nextOffset:number|null}=await api.artifactAction('artifacts.list',{kind:'notes',query:marker,offset});metadata.push(...page.items.filter((r:Debrief)=>r.content.purpose.startsWith(marker+' ')));offset=page.nextOffset;}while(offset!==null&&offset!==undefined);
      const records=await Promise.all(metadata.map(r=>api.artifactAction('artifacts.read',{id:r.id})));
      if(active.current){setRows(records);setError('');}
    } catch(e){if(active.current)setError(e instanceof Error?e.message:'Debriefs could not load.');}
    finally{if(active.current)setLoading(false);}
  },[api,marker]);
  useEffect(()=>{active.current=true;void load();const focus=()=>void load();window.addEventListener('focus',focus);const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},30000);return()=>{active.current=false;window.removeEventListener('focus',focus);clearInterval(timer);};},[load]);
  const rounds=timelineItems(application);
  function add(){const round=[...rounds].reverse().find(r=>r.phase==='completed'&&['interview','technical_round','recruiter_call','onsite'].includes(r.kind));setDraft({id:crypto.randomUUID(),version:0,round:round?.label||'',summary:''});setNotice('');}
  async function save(){if(!draft||!api||busy||w.locked)return;setBusy(true);setError('');try{const result=await api.artifactAction('artifacts.save',debriefPayload(application,draft));if(!stillHere())return;setRows(previous=>[result,...previous.filter(r=>r.id!==result.id)]);setDraft(null);setNotice('Debrief saved privately. It has not been shared.');}catch(e){if(stillHere())setError(e instanceof Error?e.message:'Debrief could not save.');}finally{if(stillHere())setBusy(false);}}
  async function share(row:Debrief){setSharing(row);setForumBody(row.content.body);setForumLink('');setCircleId('');setCircles([]);setError('');setBusy(true);try{const result=await knowledge.request<{circles:Circle[]}>('circles.list');if(stillHere())setCircles(result.circles);}catch(e){if(stillHere())setError(e instanceof Error?e.message:'Circles could not load.');}finally{if(stillHere())setBusy(false);}}
  const pendingShare=useRef<{signature:string;key:string}|null>(null);
  async function saveForum(){if(!sharing||!circleId||busy||w.locked)return;setBusy(true);setError('');try{
    const content=debriefForumContent(application,sharing,forumBody),signature=JSON.stringify({circleId,content,source:sharing.id,version:sharing.version});
    if(pendingShare.current?.signature!==signature)pendingShare.current={signature,key:crypto.randomUUID()};
    const result=await knowledge.request<{postId:string}>('knowledge.propose',{circleId,expectedRevision:0,content,eventKey:pendingShare.current.key});
    if(stillHere())setForumLink(`/circles/?circle=${encodeURIComponent(circleId)}&thread=${encodeURIComponent(result.postId)}`);
  }catch(e){if(stillHere())setError(e instanceof Error?e.message:'Forum draft could not save.');}finally{if(stillHere())setBusy(false);}}
  return <section className="interview-debriefs" aria-label="Interview debriefs">
    <header><div><h3>Debriefs</h3><p>Your agent can capture the conversation here. You can also add or update a summary.</p></div><button className={`${secondary} gap-2`} disabled={!api||w.locked||busy||!!draft} onClick={add}><ProfileIcon name="pen" width={17} height={17}/>Add debrief</button></header>
    {!api&&<p className="text-sm text-board-muted">Sign in to save private debriefs.</p>}
    <Notice>{error}</Notice><p role="status" className="text-sm text-board-muted">{notice}</p>
    {loading?<p className="text-sm text-board-muted">Loading debriefs…</p>:!rows.length&&!draft&&<p className="debrief-empty">No debriefs yet. After a round, tell your agent how it went.</p>}
    {error&&<button className={secondary} disabled={busy} onClick={()=>void load()}>Reload debriefs</button>}
    {rows.map(row=><article key={row.id} className="debrief-entry"><h4>{row.content.title}</h4><small>Updated {new Date(row.updated_at).toLocaleDateString()}</small><p className="debrief-summary">{row.content.body}</p><div className="debrief-actions"><button className={secondary} disabled={busy||w.locked} onClick={()=>{setDraft({id:row.id,version:row.version,round:row.content.purpose.slice(marker.length).trim(),summary:row.content.body});setSharing(null);}}>Update debrief</button><button className={`${secondary} gap-2`} disabled={busy||w.locked||!knowledge.ready} onClick={()=>void share(row)}><ProfileIcon name="conversation" width={17} height={17}/>Share to Circle</button></div></article>)}
    {draft&&<form className="debrief-editor" onSubmit={e=>{e.preventDefault();void save();}}><h4>{draft.version?'Update debrief':'Add debrief'}</h4><fieldset disabled={busy||w.locked} className="space-y-4"><label className="block text-sm text-board-muted">Round<input className={`${control} mt-2`} aria-label="Debrief round" required maxLength={200} value={draft.round} onChange={e=>setDraft({...draft,round:e.target.value})} placeholder="Technical round 1"/></label><label className="block text-sm text-board-muted">Debrief summary<textarea className={`${control} mt-2 min-h-40`} aria-label="Debrief summary" required maxLength={12000} value={draft.summary} onChange={e=>setDraft({...draft,summary:e.target.value})} placeholder="What came up, what went well, what was difficult, and any feedback or next steps."/></label><div className="debrief-actions"><button className={primary}>{busy?'Saving…':'Save debrief'}</button><button className={secondary} type="button" onClick={()=>setDraft(null)}>Cancel</button></div></fieldset></form>}
    {sharing&&<section className="debrief-editor" aria-label="Share debrief to Circle"><h4>Turn this debrief into a forum post</h4><p className="text-sm leading-relaxed text-board-muted">Review the summary and remove private details. Saving creates a private Round insight draft; you publish it from your Circle.</p>{forumLink?<Link href={forumLink} className={primary}>Review draft in Circle</Link>:<><label className="block text-sm text-board-muted">Circle<select className={`${control} mt-2`} value={circleId} disabled={busy} onChange={e=>setCircleId(e.target.value)}><option value="">Choose a Circle</option>{circles.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{!busy&&!circles.length&&<Link href="/circles/" className="text-sm text-board-accent underline">Join or create a Circle</Link>}<label className="block text-sm text-board-muted">Forum summary<textarea className={`${control} mt-2 min-h-40`} aria-label="Forum summary" maxLength={12000} value={forumBody} disabled={busy} onChange={e=>setForumBody(e.target.value)}/></label><button className={primary} disabled={busy||w.locked||!circleId||!forumBody.trim()} onClick={()=>void saveForum()}>{busy?'Saving…':'Save forum draft'}</button></>}<button className={secondary} disabled={busy} onClick={()=>setSharing(null)}>Close sharing</button></section>}
    {w.demo&&<p className="mt-3 text-xs text-board-muted">Fictional demo. Debriefs and forum drafts stay in this preview.</p>}
  </section>;
}
