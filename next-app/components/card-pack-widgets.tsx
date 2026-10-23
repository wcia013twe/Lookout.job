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
import { PackSetupSuggestion } from './discovery-setup-link';
import PackSetupPreview from './pack-setup-preview';
import ApiError from './api-error';
import TierLists from './tierlists';
import {Field,Notice,control,primary,secondary} from './ui';
import {createPackTask,savePackWithTask} from '../../lib/card-pack-setup.mjs';
import type {AgentConnection} from './agent-connections';
type Pack={id:string;title:string;enabled:boolean;taskId:string;archive?:string};
type Source={id:string;name:string;address:string};
type Task={id:string;title:string;enabled:boolean;sourceIds?:string[];connectionIds?:string[]};
type Setup={theme:Record<string,any>;sources:Source[];schedule:{routines:Task[];configVersion?:number}|null;updatedAt:string|null};
function Feed({pack,api,demo,onOpened}:{pack:Pack;api:ReturnType<typeof createBackend>|null;demo:boolean;onOpened?:(drops:Drop[])=>void}){
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
 return <><ApiError message={error} cached={drops.length>0} onRetry={()=>setRetry(v=>v+1)}/>{loading?<Notice>Loading {pack.title}…</Notice>:!error&&<DailyDrops id={pack.id} title={pack.title} drops={drops} onOpened={onOpened}/>} {pack.archive==='zero2sudo'&&<p className="mb-4 text-xs text-board-muted">Includes the dated Zero2Sudo archive. Historical cards are not freshly verified openings.</p>}{!error&&next!==null&&<button className={secondary} disabled={loading} onClick={()=>setOffset(next)}>Load older packs</button>}</>;
}
export default function CardPackWidgets({onOpened,configure=false,onEditSearch,connections=[]}:{onOpened?:(drops:Drop[])=>void;configure?:boolean;onEditSearch?:()=>void;connections?:AgentConnection[]}){
 const w=useWorkspace(),owner=w.demo?'demo':w.user?.id;
 const api=useMemo(()=>w.user&&w.client?createBackend(w.client,w.user.id):null,[w.user?.id,w.client]);
 const [setup,setSetup]=useState<Setup|null>(null),[draft,setDraft]=useState<Pack|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reload,setReload]=useState(0);
 const [newTask,setNewTask]=useState<ReturnType<typeof createPackTask>|null>(null);
 const [committedTask,setCommittedTask]=useState<ReturnType<typeof createPackTask>|null>(null);
 const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const packs:Pack[]=setup?.theme.cardPacks||[];
 const savedSchedule=w.state.workflow.searchPreferences?.schedule;
 const tasks=(savedSchedule&&(savedSchedule.configVersion||0)>=(setup?.schedule?.configVersion||0)?savedSchedule:setup?.schedule)?.routines||[];
 useEffect(()=>{let current=true;setLoading(true);setError('');
  if(!owner){setLoading(false);return;}
  const read=w.demo?Promise.resolve({theme:w.store.get('workflow.theme'),sources:w.store.get('workflow.searchPreferences.targets')||[],schedule:w.store.get('workflow.searchPreferences.schedule')||null,updatedAt:null}):api!.readCardPackSettings();
  read.then(value=>{if(current)setSetup(value);}).catch(failure=>{if(current)setError(apiErrorText('card_packs.settings.read',failure));}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};
 },[api,owner,w.demo,w.demoEpoch,reload]);
 function edit(pack?:Pack){
  setError('');setNotice('');setCommittedTask(null);
  if(pack){setNewTask(null);setDraft(structuredClone(pack));return;}
  const id=crypto.randomUUID(),title='My card pack';
  const task=createPackTask({packId:id,title,sources:w.state.workflow.searchPreferences?.targets||setup?.sources||[],connections});
  setNewTask(task);setDraft({id,title,enabled:true,taskId:task.id,archive:'none'});
 }
 async function saveNewPack(){
  if(!draft||!newTask||!setup)return;
  setBusy(true);setError('');setNotice('');let taskSaved=false;
  try {
   const readSettings=async()=>w.demo?{theme:w.store.get('workflow.theme')||{},sources:w.store.get('workflow.searchPreferences.targets')||[],schedule:w.store.get('workflow.searchPreferences.schedule')||null,updatedAt:null}:api!.readCardPackSettings();
   const performAction=async(operation:string,payload:any)=>{
    if(!w.demo)return api!.performPlatformAction(operation,payload);
    if(operation==='preferences.notifications.save'){
     w.store.update('workflow.searchPreferences',(previous:Record<string,unknown>)=>({...previous,schedule:payload.settings.schedule}));
     return {search:{schedule:payload.settings.schedule},updated_at:null};
    }
    w.store.update('workflow.theme',(previous:Record<string,unknown>)=>({...previous,...payload.theme}));
    return {theme:payload.theme,updated_at:null};
   };
   const saved=await savePackWithTask({readSettings,performAction,pack:draft,task:committedTask||{...newTask,title:`${draft.title} discovery`},expectedPackVersion:setup.theme.cardPacksVersion||0,
    timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',
    onTaskSaved:(schedule:any,updatedAt:string|null)=>{
     taskSaved=true;if(!active.current)return;
     w.store.update('workflow.searchPreferences',(previous:Record<string,unknown>)=>({...previous,schedule}));
     setSetup(previous=>previous?{...previous,schedule,updatedAt}:previous);setCommittedTask(schedule.routines.find((task:Task)=>task.id===draft.taskId));
    }});
   if(!active.current)return;
   setSetup(previous=>previous?{...previous,theme:saved.theme,updatedAt:saved.updated_at}:previous);
   w.store.update('workflow.theme',(previous:Record<string,unknown>)=>({...previous,cardPacks:saved.theme.cardPacks,cardPacksVersion:saved.theme.cardPacksVersion}));
   setDraft(null);setNewTask(null);setCommittedTask(null);setNotice(w.demo?'Pack and task saved in demo memory.':'Pack and task saved. Copy the request to your agent.');
  }catch(failure){if(active.current)setError(`${taskSaved?'Task saved. Retry Save card pack to finish. ':''}${failure instanceof Error&&failure.name!=='ApiFailure'?failure.message:apiErrorText('preferences.theme.save',failure)}`);}
  finally{if(active.current)setBusy(false);}
 }
 async function save(next:Pack[]){
  if(!setup)return;setBusy(true);setError('');setNotice('');
  try{validateCardPacks(next);
   const current=w.demo?setup:await api!.readCardPackSettings();
   if((current.theme.cardPacksVersion||0)!==(setup.theme.cardPacksVersion||0))throw Error('Pack settings changed in another session. Reload the saved setup before retrying.');
   const theme={...current.theme,cardPacks:next,cardPacksVersion:(setup.theme.cardPacksVersion||0)+1};
   const saved=w.demo?{theme,updated_at:null}:await api!.performPlatformAction('preferences.theme.save',{theme,expectedUpdatedAt:current.updatedAt});
   if(!active.current)return;setSetup({...setup,theme:saved.theme,updatedAt:saved.updated_at});
   // The canonical API has saved first. Legacy autosync cannot roll back versioned packs.
   w.store.update('workflow.theme',(old:Record<string,unknown>)=>({...old,cardPacks:saved.theme.cardPacks,cardPacksVersion:saved.theme.cardPacksVersion}));
   setDraft(null);setNotice(w.demo?'Pack setup saved in demo memory.':'Card pack setup saved to your account.');
  }catch(failure){if(active.current)setError(failure instanceof Error&&failure.name!=='ApiFailure'?failure.message:apiErrorText('preferences.theme.save',failure));}finally{if(active.current)setBusy(false);}
 }
 function submit(event:FormEvent){event.preventDefault();if(draft)void (newTask?saveNewPack():save([...packs.filter(p=>p.id!==draft.id),draft]));}
 if(!owner)return configure?<p className="py-4 text-sm text-board-muted">Sign in to save card packs to your account.</p>:<PackSetupSuggestion/>;
 return <section className={configure?"my-2":"my-6"} aria-label="Your card packs">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{configure?'Card packs':'Your card packs'}</h2>{!configure&&packs.some(p=>p.enabled)&&<Link className={secondary} href={w.demo?"/profile/?section=agent&demo=1#pack-setup":"/profile/?section=agent#pack-setup"}>Set up packs &amp; connection</Link>}</div>
  <ApiError message={error} onRetry={()=>setReload(v=>v+1)}/>{notice&&<Notice>{notice}</Notice>}
  {loading?<Notice>Loading your pack setup…</Notice>:setup&&<>
   {!configure&&packs.filter(p=>p.enabled).map(pack=>{const task=tasks.find((t:{id:string;title:string;enabled?:boolean;sourceIds?:string[]})=>t.id===pack.taskId);return <div key={`${owner}:${pack.id}:${w.demoEpoch}`}><p className="mb-2 text-sm text-board-muted">{task?`${task.title}${task.enabled?'':' · paused'}`:'Linked task removed. Configure this pack to select another task.'}</p><Feed pack={pack} api={api} demo={w.demo} onOpened={onOpened}/></div>;})}
   {!packs.some(p=>p.enabled)&&!configure&&<PackSetupSuggestion/>}
   {configure&&<div className="grid items-start gap-6 lg:grid-cols-2"><div className="min-w-0 space-y-4">
    <ul className="divide-y divide-board-line">{packs.map(pack=><li className="flex items-center justify-between gap-3 py-3" key={pack.id}>
      <div className="min-w-0"><h3 className="break-words font-semibold">{pack.title}</h3><p className="mt-1 text-xs text-board-muted">{pack.enabled?'Enabled':'Disabled'} · {tasks.find((t:Task)=>t.id===pack.taskId)?.title||'Choose a search task'}</p></div>
      <div className="flex shrink-0 gap-2">
        <button className="min-h-11 px-2 text-sm font-semibold text-board-accent hover:underline" aria-label={`Copy agent request for ${pack.title}`} onClick={async()=>{try{await navigator.clipboard.writeText(packAgentRequest(pack));setNotice('Request copied. Send it to your agent.');}catch{setNotice('Copy failed. Enable clipboard access and retry.');}}}>Copy request</button>
        <button className={secondary} aria-label={`Edit ${pack.title}`} disabled={busy} onClick={()=>edit(pack)}>Edit</button>
      </div>
    </li>)}</ul>

    {!draft&&<button className={primary} disabled={busy||packs.length>=8} onClick={()=>edit()}>Add card pack</button>}
    {draft&&<form onSubmit={submit} className="space-y-4 border-t border-board-line pt-4" aria-label="Card pack setup"><fieldset disabled={busy} className="space-y-4">
      <Field label="Pack name"><input className={control} required maxLength={80} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></Field>
      {newTask?<div className="space-y-3">
        <Field label="Task instructions"><textarea aria-label="Task instructions" className={control} rows={5} required disabled={Boolean(committedTask)} maxLength={4000} value={newTask.description} onChange={e=>setNewTask({...newTask,description:e.target.value})}/></Field>
        <div className="grid grid-cols-2 items-end gap-3"><Field label="Daily at"><input className={control} type="time" required disabled={Boolean(committedTask)} value={newTask.time} onChange={e=>setNewTask({...newTask,time:e.target.value})}/></Field><p className="pb-3 text-xs text-board-muted">{savedSchedule?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}</p></div>
        <p className="text-xs text-board-muted">{newTask.sourceIds.length} {newTask.sourceIds.length===1?'source':'sources'} · {newTask.connectionIds.length} {newTask.connectionIds.length===1?'agent':'agents'} selected. {(!newTask.sourceIds.length||!newTask.connectionIds.length)&&'Assign missing sources or an agent in Search after saving.'}</p>
        <p className="text-xs text-board-muted">Creates a linked task. Your agent arranges recurring runs.{savedSchedule?.enabled===false?' Recurring runs are currently off.':''}</p>
      </div>:<><Field label="My Agent task"><select aria-label="My Agent task" className={control} required disabled={busy} value={draft.taskId} onChange={e=>setDraft({...draft,taskId:e.target.value,archive:'none'})}><option value="">Choose a task</option>{tasks.map((task:Task)=><option key={task.id} value={task.id}>{task.title}{task.enabled?'':' (paused)'}</option>)}</select></Field></>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.enabled} onChange={e=>setDraft({...draft,enabled:e.target.checked})}/>Enabled</label>
        {!newTask&&<button type="button" onClick={onEditSearch} className="min-h-11 text-sm text-board-accent underline underline-offset-4">Edit search</button>}
      </div>
      {tasks.find((t:Task)=>t.id===draft.taskId)?.sourceIds?.includes('zero2sudo')&&<label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={draft.archive==='zero2sudo'} onChange={e=>setDraft({...draft,archive:e.target.checked?'zero2sudo':'none'})}/>Include historical Zero2Sudo cards</label>}
      <div className="flex flex-wrap items-center gap-2">
        <button className={primary} disabled={busy}>{busy?'Saving…':'Save card pack'}</button>
        <button type="button" className={secondary} disabled={busy} onClick={()=>{setDraft(null);setNewTask(null);setCommittedTask(null);}}>Cancel</button>
        {packs.some(p=>p.id===draft.id)&&<button type="button" className="ml-auto min-h-11 px-2 text-sm text-board-muted underline underline-offset-4" aria-label={`Remove ${draft.title}`} disabled={busy} onClick={()=>void save(packs.filter(p=>p.id!==draft.id))}>Remove pack</button>}
      </div>
    </fieldset></form>}
    <details className="border-t border-board-line pt-4">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Company ranking</summary>
      <div className="space-y-4 pt-2">
        <p className="text-sm text-board-muted">Tune the company tiers your agent uses when ranking pack discoveries. Keep separate lists for full-time roles and internships. These are shared account preferences. Selecting a list here changes the account’s active list; it does not replace a list explicitly selected in your search profile. Choose the discovery list in your profile’s Company priorities settings.</p>
        <p className="text-sm text-board-muted">Company tier is a baseline. Team, technical scope and personal fit can outweigh it. Unranked companies need investigation rather than automatic exclusion.</p>
        <p className="text-xs text-board-muted">Ranking edits save separately from this pack. Existing cards stay as published; your agent uses saved preferences on its next discovery run.</p>
        <TierLists/>
      </div>
    </details>
    </div><PackSetupPreview title={draft?.title||packs[0]?.title||"My discovery pack"}/>
   </div>}
  </>}
 </section>;
}
