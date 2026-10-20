"use client";
import {useState} from 'react';
import {useWorkspace} from '../lib/workspace';
import {useSearchHarness,type SearchDocument} from '../lib/search-harness';
import {parseDocument,sourceTemplates,profileDocument,portalsDocument} from '../../lib/search/documents.mjs';
import {Field,Section,control,primary,secondary,Notice} from './ui';
const emptyPortals={tracked_companies:[],search_queries:[],title_filter:{positive:[],negative:[]},location_filter:{allow:[],strict:false}};
function Editor(){
 const w=useWorkspace();
 const [selection,setSelection]=useState('rules:shared'),[draft,setDraft]=useState<{key:string;content:string;version:number}|null>(null),[feedback,setFeedback]=useState(''),[history,setHistory]=useState<SearchDocument[]>([]);
 const [kind,id]=selection.split(':');
 const h=useSearchHarness(kind==='profile'?id:undefined);
 const docs:SearchDocument[]=h.context?.documents||[];
 const profiles:{id:string;name:string}[]=h.context?.profiles||[];
 const saved=docs.find(d=>d.kind===kind&&d.id===id);
 const defaults=kind==='portals'?portalsDocument(emptyPortals):kind==='profile'?profileDocument({id,name:'General',active:true,filters:{},priorities:{},instructions:''}):'';
 const content=draft?.key===selection?draft.content:saved?.content||defaults;
 const version=draft?.key===selection?draft.version:saved?.version||0;
 function patch(value:string){setDraft({key:selection,content:value,version});setFeedback('Unsaved changes.');}
 async function save(){h.setBusy(true);setFeedback('');try{
  const normalized=kind==='portals'?portalsDocument({...parseDocument('portals',content).projection,search_queries:parseDocument('portals',content).projection.search_queries.filter((q:string)=>q.trim())}):content;
  const next=await h.action('search.document.save',{kind,id,content:normalized,expectedVersion:version,eventKey:crypto.randomUUID()});
  if(kind==='profile'&&!w.demo){
   const current=w.store.get('workflow.searchPreferences')||{};const list=current.profiles||[];const p={...next.projection,version:next.version};
   w.store.update('workflow.searchPreferences',(v:Record<string,unknown>)=>({...v,profiles:list.some((a:any)=>a.id===id)?list.map((a:any)=>a.id===id?p:a):[...list,p]}));
  }else if(kind==='portals'&&!w.demo){
   const {data,error}=await w.client.from('preferences').select('search').eq('user_id',w.user.id).maybeSingle();
   if(!error&&window.JB.auth.userId===w.user.id)w.store.update('workflow.searchPreferences',(v:Record<string,unknown>)=>({...v,targets:data?.search?.targets||[],targetsVersion:data?.search?.targetsVersion||0}));
  }
  setDraft(null);await h.reload();setFeedback(w.demo?'Fictional context updated in memory.':'Context saved for your personal agent.');
 }catch(e){setFeedback(e instanceof Error?e.message:'Could not save.');}finally{h.setBusy(false);}}
 function addTemplate(template:typeof sourceTemplates[number]){try{const p=parseDocument('portals',content).projection;if(p.tracked_companies.some((s:any)=>s.id===template.id))throw Error('This template is already listed.');patch(portalsDocument({...p,tracked_companies:[...p.tracked_companies,template]}));}catch(e){setFeedback(e instanceof Error?e.message:'Check portals first.');}}
 return <Section title="Career context">
  <p className="mb-5 max-w-prose text-sm leading-relaxed text-board-muted">Your personal agent uses these documents for targeting, search sources, and working preferences. Profile facts and application permissions are managed separately.</p>
  {!w.user&&!w.demo?<p className="text-sm text-board-muted">Sign in to keep context available to your connected agent.</p>:<>
   <Field label="Context document"><select className={control} value={selection} disabled={h.busy||!!draft} onChange={e=>{setSelection(e.target.value);setHistory([]);setFeedback('');}}><option value="rules:shared">House rules</option><option value="portals:shared">Portals and search queries</option>{profiles.map(d=><option key={d.id} value={`profile:${d.id}`}>{d.name} targeting</option>)}{!profiles.length&&<option value="profile:general">General targeting</option>}</select></Field>
   <p className="my-3 text-xs text-board-muted">Revision {saved?.version||0}. Existing targeting controls and source lists edit these same documents. Reload here after changes elsewhere.</p>
   {kind==='rules'&&<Field label="How your agent should work"><textarea className={`${control} min-h-40`} value={content} maxLength={20000} disabled={h.busy||w.locked} onChange={e=>patch(e.target.value)} placeholder="For example: show location on every shortlisted role; preserve unknowns; ask before sending messages." /></Field>}
   {kind==='portals'&&<div className="mb-4 space-y-4"><Field label="Broad search queries, one per line"><textarea className={`${control} min-h-28`} disabled={h.busy||w.locked} value={(()=>{try{return parseDocument('portals',content).projection.search_queries.join('\n');}catch{return '';}})()} onChange={e=>{try{const p=parseDocument('portals',content).projection;patch(portalsDocument({...p,search_queries:e.target.value.split('\n')}));}catch{setFeedback('Fix the portals document before editing queries.');}}} /></Field><p className="text-sm text-board-muted">Add source templates when useful. Your agent checks the current list and employer postings.</p><div className="flex flex-wrap gap-2">{sourceTemplates.map(t=><button key={t.id} className={secondary} disabled={h.busy||w.locked} onClick={()=>addTemplate(t)}>Add {t.name}</button>)}</div></div>}
   {kind!=='rules'&&<details><summary className="min-h-11 py-3 font-semibold">Edit complete {kind==='profile'?'targeting':'portals'} document</summary><Field label="Canonical context source"><textarea spellCheck={false} className={`${control} min-h-80 font-mono text-sm`} disabled={h.busy||w.locked} value={content} onChange={e=>patch(e.target.value)} /></Field><p className="mt-2 text-xs text-board-muted">YAML is accepted and saved as JSON-compatible YAML. Targeting narrative remains Markdown below frontmatter. Source comments are normalized on save.</p></details>}
   <div className="mt-4 flex flex-wrap gap-2"><button className={primary} disabled={h.busy||w.locked} onClick={save}>{h.busy?'Working…':'Save context'}</button><button className={secondary} disabled={h.busy} onClick={()=>{setDraft(null);setFeedback('');void h.reload();}}>Discard draft and reload</button><button className={secondary} disabled={h.busy||!saved} onClick={async()=>{try{setHistory(await h.action('search.document.history',{kind,id}));}catch(e){h.setError(String(e));}}}>View revisions</button><button className={secondary} onClick={()=>{const blob=new Blob([content],{type:'text/plain'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=kind==='portals'?'portals.yml':`${kind}-${id}.md`;a.click();URL.revokeObjectURL(u);}}>Export document</button></div>
   {history.map(d=><details key={d.version} className="mt-3 border-t border-board-line py-2"><summary className="min-h-11 py-3">Revision {d.version}</summary><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-sm">{d.content}</pre><button className={secondary} onClick={()=>patch(d.content)}>Use this revision as a draft</button></details>)}
  </>}
  <Notice>{h.error||feedback}</Notice>
 </Section>;
}
export default function SearchContext(){const w=useWorkspace();return <Editor key={w.demo?`demo-${w.demoEpoch}`:w.user?.id||'guest'} />;}
