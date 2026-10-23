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
import {Field,Notice,control,primary,secondary} from './ui';
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
export default function CardPackWidgets({onOpened,configure=false,onEditSearch}:{onOpened?:(drops:Drop[])=>void;configure?:boolean;onEditSearch?:()=>void}){
 const w=useWorkspace(),owner=w.demo?'demo':w.user?.id;
 const api=useMemo(()=>w.user&&w.client?createBackend(w.client,w.user.id):null,[w.user?.id,w.client]);
 const [setup,setSetup]=useState<Setup|null>(null),[draft,setDraft]=useState<Pack|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reload,setReload]=useState(0);
 const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const packs:Pack[]=setup?.theme.cardPacks||[];
 const savedSchedule=w.state.workflow.searchPreferences?.schedule;
 const tasks=(savedSchedule&&(savedSchedule.configVersion||0)>=(setup?.schedule?.configVersion||0)?savedSchedule:setup?.schedule)?.routines||[];
 useEffect(()=>{let current=true;setLoading(true);setError('');
  if(!owner){setLoading(false);return;}
  const read=w.demo?Promise.resolve({theme:w.store.get('workflow.theme'),sources:w.store.get('workflow.searchPreferences.targets')||[],schedule:w.store.get('workflow.searchPreferences.schedule')||null,updatedAt:null}):api!.readCardPackSettings();
  read.then(value=>{if(current)setSetup(value);}).catch(failure=>{if(current)setError(apiErrorText('card_packs.settings.read',failure));}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};
 },[api,owner,w.demo,w.demoEpoch,reload]);
 function edit(pack?:Pack){setError('');setNotice('');setDraft(pack?structuredClone(pack):{id:crypto.randomUUID(),title:'My card pack',enabled:true,taskId:tasks[0]?.id||'',archive:'none'});}
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
 function submit(event:FormEvent){event.preventDefault();if(draft)void save([...packs.filter(p=>p.id!==draft.id),draft]);}
 if(!owner)return configure?<p className="py-4 text-sm text-board-muted">Sign in to save card packs to your account.</p>:<PackSetupSuggestion/>;
 return <section className={configure?"my-2":"my-6"} aria-label="Your card packs">
  <div className={configure?"sr-only":"mb-4 flex flex-wrap items-center justify-between gap-3"}><h2 className="text-lg font-semibold">{configure?'Card packs':'Your card packs'}</h2>{!configure&&packs.some(p=>p.enabled)&&<Link className={secondary} href={w.demo?"/profile/?section=agent&demo=1#pack-setup":"/profile/?section=agent#pack-setup"}>Set up packs &amp; connection</Link>}</div>
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
    {!tasks.length&&<p className="text-sm text-board-muted">Create a search task to fill your pack. <button type="button" className="min-h-11 px-1 font-semibold text-board-accent underline" onClick={onEditSearch}>Set up a task</button></p>}
    {!draft&&<button className={primary} disabled={busy||packs.length>=8||!tasks.length} onClick={()=>edit()}>Add card pack</button>}
    {draft&&<form onSubmit={submit} className="space-y-4 border-t border-board-line pt-4" aria-label="Card pack setup">
      <Field label="Pack name"><input className={control} required maxLength={80} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></Field>
      <Field label="My Agent task"><select aria-label="My Agent task" className={control} required disabled={busy} value={draft.taskId} onChange={e=>setDraft({...draft,taskId:e.target.value,archive:'none'})}><option value="">Choose a task</option>{tasks.map((task:Task)=><option key={task.id} value={task.id}>{task.title}{task.enabled?'':' (paused)'}</option>)}</select></Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.enabled} onChange={e=>setDraft({...draft,enabled:e.target.checked})}/>Enabled</label>
        <button type="button" onClick={onEditSearch} className="min-h-11 text-sm text-board-accent underline underline-offset-4">Edit search</button>
      </div>
      {tasks.find((t:Task)=>t.id===draft.taskId)?.sourceIds?.includes('zero2sudo')&&<label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={draft.archive==='zero2sudo'} onChange={e=>setDraft({...draft,archive:e.target.checked?'zero2sudo':'none'})}/>Include historical Zero2Sudo cards</label>}
      <div className="flex flex-wrap items-center gap-2">
        <button className={primary} disabled={busy}>{busy?'Saving…':'Save card pack'}</button>
        <button type="button" className={secondary} disabled={busy} onClick={()=>setDraft(null)}>Cancel</button>
        {packs.some(p=>p.id===draft.id)&&<button type="button" className="ml-auto min-h-11 px-2 text-sm text-board-muted underline underline-offset-4" aria-label={`Remove ${draft.title}`} disabled={busy} onClick={()=>void save(packs.filter(p=>p.id!==draft.id))}>Remove pack</button>}
      </div>
    </form>}
    </div><PackSetupPreview title={draft?.title||packs[0]?.title||"My discovery pack"}/>
   </div>}
  </>}
 </section>;
}
