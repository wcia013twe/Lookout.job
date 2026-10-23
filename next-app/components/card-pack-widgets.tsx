'use client';
import Link from 'next/link';
import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {useWorkspace,asset} from '../lib/workspace';
import {createBackend} from '../../backend/client.mjs';
import {validateCardPacks,packAgentRequest} from '../../lib/card-packs.mjs';
import {apiErrorText,apiFailure} from '../../lib/api-failure.mjs';
import {DEMO_PACK_ID} from '../lib/card-pack-demo.mjs';
import {demoDrops,dropKey,type Drop} from '../lib/drop-pack';
import {dayStamp} from '../lib/progress.mjs';
import DailyDrops from './daily-drops';
import ApiError from './api-error';
import {Field,Notice,control,primary,secondary} from './ui';
type Pack={id:string;title:string;enabled:boolean;taskId:string;archive?:string};
type Source={id:string;name:string;address:string};
type Task={id:string;title:string;enabled:boolean;sourceIds?:string[];connectionIds?:string[]};
type Setup={theme:Record<string,any>;sources:Source[];schedule:{routines:Task[]}|null;updatedAt:string|null};
function Feed({pack,api,demo}:{pack:Pack;api:ReturnType<typeof createBackend>|null;demo:boolean}){
 const [drops,setDrops]=useState<Drop[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0),[next,setNext]=useState<number|null>(null),[offset,setOffset]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');
  (async()=>{
   if(demo)return {drops:pack.id===DEMO_PACK_ID?demoDrops(dayStamp()):[],nextOffset:null};
   const feed=await api!.readCardPackFeed(pack.id,offset);
   if(pack.archive==='zero2sudo'&&offset===0){const response=await fetch(asset('data/sudo-drops.json'));if(!response.ok)throw apiFailure('card_packs.archive.read',{},response.status);const archived=await response.json();if(!Array.isArray(archived?.drops))throw apiFailure('card_packs.archive.read',{code:'INVALID_RESPONSE'});feed.drops=[...feed.drops,...archived.drops];}
   return feed;
  })().then(result=>{if(active){setDrops(previous=>{const rows=[...(offset?previous:[]),...result.drops].map(drop=>({...drop,packId:pack.id}));return [...new Map(rows.slice().reverse().map(drop=>[dropKey(drop),drop])).values()].reverse();});setNext(result.nextOffset);}}).catch(failure=>{if(active)setError(apiErrorText('card_packs.feed.read',failure));}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[api,pack.id,pack.archive,demo,retry,offset]);
 return <><ApiError message={error} cached={drops.length>0} onRetry={()=>setRetry(v=>v+1)}/>{loading?<Notice>Loading {pack.title}…</Notice>:!error&&<DailyDrops id={pack.id} title={pack.title} drops={drops}/>} {pack.archive==='zero2sudo'&&<p className="mb-4 text-xs text-board-muted">Includes the dated Zero2Sudo archive. Historical cards are not freshly verified openings.</p>}{!error&&next!==null&&<button className={secondary} disabled={loading} onClick={()=>setOffset(next)}>Load older packs</button>}</>;
}
export default function CardPackWidgets(){
 const w=useWorkspace(),owner=w.demo?'demo':w.user?.id;
 const api=useMemo(()=>w.user&&w.client?createBackend(w.client,w.user.id):null,[w.user?.id,w.client]);
 const [setup,setSetup]=useState<Setup|null>(null),[manage,setManage]=useState(false),[draft,setDraft]=useState<Pack|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reload,setReload]=useState(0);
 const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const packs:Pack[]=setup?.theme.cardPacks||[];
 useEffect(()=>{let current=true;setLoading(true);setError('');
  if(!owner){setLoading(false);return;}
  const read=w.demo?Promise.resolve({theme:w.store.get('workflow.theme'),sources:w.store.get('workflow.searchPreferences.targets')||[],schedule:w.store.get('workflow.searchPreferences.schedule')||null,updatedAt:null}):api!.readCardPackSettings();
  read.then(value=>{if(current)setSetup(value);}).catch(failure=>{if(current)setError(apiErrorText('card_packs.settings.read',failure));}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};
 },[api,owner,w.demo,w.demoEpoch,reload]);
 function edit(pack?:Pack){setManage(true);setError('');setNotice('');setDraft(pack?structuredClone(pack):{id:crypto.randomUUID(),title:'My card pack',enabled:true,taskId:setup?.schedule?.routines[0]?.id||'',archive:'none'});}
 async function save(next:Pack[]){
  if(!setup)return;setBusy(true);setError('');setNotice('');
  try{validateCardPacks(next);const theme={...setup.theme,cardPacks:next,cardPacksVersion:(setup.theme.cardPacksVersion||0)+1};
   const saved=w.demo?{theme,updated_at:null}:await api!.performPlatformAction('preferences.theme.save',{theme,expectedUpdatedAt:setup.updatedAt});
   if(!active.current)return;setSetup({...setup,theme:saved.theme,updatedAt:saved.updated_at});
   // The canonical API has saved first. Legacy autosync cannot roll back versioned packs.
   w.store.update('workflow.theme',(old:Record<string,unknown>)=>({...old,cardPacks:saved.theme.cardPacks,cardPacksVersion:saved.theme.cardPacksVersion}));
   setDraft(null);setNotice(w.demo?'Pack setup saved in demo memory.':'Card pack setup saved to your account.');
  }catch(failure){if(active.current)setError(failure instanceof Error&&failure.name!=='ApiFailure'?failure.message:apiErrorText('preferences.theme.save',failure));}finally{if(active.current)setBusy(false);}
 }
 function submit(event:FormEvent){event.preventDefault();if(draft)void save([...packs.filter(p=>p.id!==draft.id),draft]);}
 if(!owner)return null;
 return <section className="my-6" aria-label="Your card packs">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Your card packs</h2><button className={secondary} disabled={loading||busy} onClick={()=>{setManage(!manage);setDraft(null);}}>Configure packs</button></div>
  <ApiError message={error} onRetry={()=>setReload(v=>v+1)}/><Notice>{notice}</Notice>
  {loading?<Notice>Loading your pack setup…</Notice>:setup&&<>
   {packs.filter(p=>p.enabled).map(pack=>{const task=setup.schedule?.routines.find(t=>t.id===pack.taskId);return <div key={`${owner}:${pack.id}:${w.demoEpoch}`}><p className="mb-2 text-sm text-board-muted">{task?`${task.title}${task.enabled?'':' · paused'}`:'Linked task removed. Configure this pack to select another task.'}</p><Feed pack={pack} api={api} demo={w.demo}/></div>;})}
   {!packs.some(p=>p.enabled)&&!manage&&<p className="py-3 text-sm text-board-muted">No card packs enabled. Configure a pack to collect discoveries from a My Agent task.</p>}
   {manage&&<div className="space-y-5 border-y border-board-line py-5">
    <p className="max-w-prose text-sm leading-relaxed text-board-muted">Link each pack to a My Agent task. The task owns the instructions, sources, connections and requested timing. Removing a widget keeps its saved batches.</p>
    <ul className="divide-y divide-board-line">{packs.map(pack=><li className="flex flex-wrap items-center justify-between gap-3 py-4" key={pack.id}><div><h3 className="font-semibold">{pack.title}</h3><p className="text-sm text-board-muted">{pack.enabled?'Enabled':'Disabled'} · {setup.schedule?.routines.find(t=>t.id===pack.taskId)?.title||'Task removed — select another'}</p></div><div className="flex flex-wrap gap-2"><button className={secondary} disabled={busy} onClick={()=>void edit(pack)}>Edit {pack.title}</button><button className={secondary} disabled={busy} onClick={()=>void save(packs.map(p=>p.id===pack.id?{...p,enabled:!p.enabled}:p))}>{pack.enabled?'Disable':'Enable'}</button><button className={secondary} disabled={busy} onClick={()=>void save(packs.filter(p=>p.id!==pack.id))}>Remove {pack.title}</button><button className={secondary} onClick={async()=>{try{await navigator.clipboard.writeText(packAgentRequest(pack));setNotice('Pack request copied. Send it to a connected agent.');}catch{setNotice('Copy failed. Try again with clipboard access enabled.');}}}>Copy agent request</button></div></li>)}</ul>
    {!draft&&<button className={primary} disabled={busy||packs.length>=8} onClick={()=>void edit()}>Add card pack</button>}
    {draft&&<form onSubmit={submit} className="space-y-5" aria-label="Card pack setup"><Field label="Pack name"><input className={control} required maxLength={80} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></Field>
     <Field label="My Agent task"><select aria-label="My Agent task" className={control} required disabled={busy} value={draft.taskId} onChange={e=>setDraft({...draft,taskId:e.target.value,archive:'none'})}><option value="">Choose a task</option>{(setup.schedule?.routines||[]).map(task=><option key={task.id} value={task.id}>{task.title}{task.enabled?'':' (paused)'}</option>)}</select></Field>
     <Link className="inline-flex min-h-11 items-center text-sm text-board-accent underline" href="/profile/?section=agent">Set up tasks and connections in My Agent</Link>
     {setup.schedule?.routines.find(t=>t.id===draft.taskId)?.sourceIds?.includes('zero2sudo')&&<label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={draft.archive==='zero2sudo'} onChange={e=>setDraft({...draft,archive:e.target.checked?'zero2sudo':'none'})}/>Include the historical Zero2Sudo archive</label>}
     <div className="flex flex-wrap gap-3"><button className={primary} disabled={busy}>{busy?'Saving…':'Save card pack'}</button><button type="button" className={secondary} disabled={busy} onClick={()=>setDraft(null)}>Cancel</button></div>
    </form>}
   </div>}
  </>}
 </section>;
}
