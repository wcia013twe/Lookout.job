'use client';
import {useEffect,useMemo,useState,useRef} from 'react';
import {useWorkspace} from '../lib/workspace';
import {createBackend} from '../../backend/client.mjs';
import {readDailySchedule,defaultDailySchedule} from '../../lib/daily-schedule.mjs';
import {validateAutomationSchedule} from '../../lib/card-packs.mjs';
import {invokeConnection} from '../../lib/agent-connections.mjs';
import {apiErrorText} from '../../lib/api-failure.mjs';
import {demoPackConnections} from '../lib/card-pack-demo.mjs';
import {Section,Field,control,primary,secondary,Notice} from './ui';
import ApiError from './api-error';
type Routine={id:string;title:string;description:string;enabled:boolean;time:string;mode?:'manual'|'scheduled';sourceIds?:string[];connectionIds?:string[]};
type Schedule={enabled:boolean;timezone:string;routines:Routine[];configVersion?:number};
type Connection={id:string;name:string;scopes:string[];expires_at:string;revoked_at?:string|null};
function Editor({connections:liveConnections}:{connections?:Connection[]}){
 const w=useWorkspace();
 const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const api=useMemo(()=>w.user&&w.client?createBackend(w.client,w.user.id):null,[w.user?.id,w.client]);
 const [draft,setDraft]=useState<Schedule>({enabled:false,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',routines:[]});
 const [base,setBase]=useState<{version:number;updatedAt:string|null}>({version:0,updatedAt:null});
 const [loadedSources,setSources]=useState<{id:string;name:string}[]>([]),[connections,setConnections]=useState<Connection[]>([]);
 const [editing,setEditing]=useState<string|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[dirty,setDirty]=useState(false),[error,setError]=useState(''),[feedback,setFeedback]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{let current=true;setLoading(true);setError('');
  (async()=>{
   if(w.demo||!w.user)return {settings:{schedule:w.store.get('workflow.searchPreferences.schedule'),sources:w.store.get('workflow.searchPreferences.targets')||[],updatedAt:null},connections:w.demo?demoPackConnections:[]};
   const [settings,result]=await Promise.all([api!.readCardPackSettings(),invokeConnection(w.client,'connections.list',{},()=>window.JB.auth.userId,w.user.id)]);
   return {settings,connections:result.data||[]};
  })().then(({settings,connections})=>{if(!current)return;setSources(settings.sources);setConnections(connections);setBase({version:settings.schedule?.configVersion||0,updatedAt:settings.updatedAt});
   setDraft(readDailySchedule(settings.schedule,Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'));setDirty(!settings.schedule);setEditing(null);
  }).catch(e=>{if(current)setError(apiErrorText('automation.settings.read',e));}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};
 },[api,w.demo,w.demoEpoch,reload]);
 const sources=w.state.workflow.searchPreferences?.targets||loadedSources;
 const availableConnections=liveConnections||connections;
 function edit(next:Schedule){setDraft(next);setDirty(true);setFeedback('');}
 function patch(id:string,next:Partial<Routine>){edit({...draft,routines:draft.routines.map(t=>t.id===id?{...t,...next}:t)});}
 function toggle(task:Routine,field:'sourceIds'|'connectionIds',id:string){const values=task[field]||[];patch(task.id,{[field]:values.includes(id)?values.filter(v=>v!==id):[...values,id]});}
 async function save(){
  setError('');setFeedback('');setSaving(true);
  try{const schedule={...draft,routines:draft.routines.map(t=>({...t,sourceIds:t.sourceIds||[],connectionIds:t.connectionIds||[]})),configVersion:base.version+1};validateAutomationSchedule(schedule);
   const current=api&&!w.demo?await api.readCardPackSettings():null;
   if(current&&(current.schedule?.configVersion||0)!==base.version)throw Error('Tasks changed in another session. Reload saved settings before retrying; your edits are still here.');
   const result=api&&!w.demo?await api.performPlatformAction('preferences.notifications.save',{settings:{schedule},expectedUpdatedAt:current?.updatedAt??base.updatedAt}):{search:{schedule},updated_at:null};
   if(!active.current)return;const saved=result.search.schedule;setDraft(saved);setBase({version:saved.configVersion,updatedAt:result.updated_at});setDirty(false);
   w.store.update('workflow.searchPreferences',(previous:Record<string,unknown>)=>({...previous,schedule:structuredClone(saved)}));
   setFeedback(w.demo?'Demo tasks saved. Changes stay in this preview.':w.user?'Tasks saved. Ask your personal agent to run them or arrange their schedule.':'Tasks saved in this browser. Sign in to connect agents.');
  }catch(e){setError(e instanceof Error&&e.name!=='ApiFailure'?e.message:apiErrorText('preferences.notifications.save',e));}finally{setSaving(false);}
 }
 return <Section title="My Agent tasks" help={<>Set instructions, sources and agent connections here. A card pack in Discover displays a task’s results. Your personal agent runs the work.<br/><br/>Saving requests timing; it does not create a running automation. On-demand tasks remain available when recurring runs are off. Pause a task to stop new cards; saved cards stay available.</>}>
  <ApiError message={error} onRetry={()=>{if(!dirty)setReload(v=>v+1);else setFeedback('Your edits are still here. Retry Save tasks, or reload saved settings to resolve a conflict.');}}/>
  {loading?<Notice>Loading your tasks…</Notice>:<form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={w.locked||saving||Boolean(error&&!dirty)}>
   <div className="mb-4 flex flex-wrap items-center justify-between gap-4"><label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" role="switch" className="h-5 w-5 accent-board-accent" checked={draft.enabled} onChange={e=>edit({...draft,enabled:e.target.checked})}/>Request recurring runs</label><div className="w-full sm:w-64"><Field label="Time zone"><input required maxLength={100} className={control} value={draft.timezone} onChange={e=>edit({...draft,timezone:e.target.value})}/></Field></div></div>
   <ul aria-label="My Agent automation tasks" className="divide-y divide-board-line border-y border-board-line">{draft.routines.map(task=><li className="py-4" key={task.id}>
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between"><label className="flex min-h-11 min-w-0 flex-1 items-start gap-3"><input type="checkbox" role="switch" aria-label={`${task.title} enabled`} className="mt-1 h-5 w-5 shrink-0 accent-board-accent" checked={task.enabled} onChange={e=>patch(task.id,{enabled:e.target.checked})}/><span className="min-w-0 [overflow-wrap:anywhere]"><span className="block font-semibold">{task.title||'New task'}</span><span className="block text-sm text-board-muted">{!task.enabled?'Paused':task.mode==='manual'?'On demand':draft.enabled?`${task.time} · schedule requested`:'Recurring runs off'} · {task.sourceIds?.length||0} {task.sourceIds?.length===1?'source':'sources'} · {task.connectionIds?.length||0} {task.connectionIds?.length===1?'agent':'agents'}</span></span></label><div className="flex gap-2"><button type="button" className={secondary} aria-expanded={editing===task.id} aria-controls={editing===task.id?`task-editor-${task.id}`:undefined} onClick={()=>setEditing(editing===task.id?null:task.id)}>{editing===task.id?'Done editing':'Edit task'}</button><button type="button" className={secondary} aria-label={`Remove ${task.title}`} onClick={()=>edit({...draft,routines:draft.routines.filter(t=>t.id!==task.id)})}>Remove</button></div></div>
    {editing===task.id?<div id={`task-editor-${task.id}`} className="mt-4 space-y-4"><Field label="Task name"><input required maxLength={120} className={control} value={task.title} onChange={e=>patch(task.id,{title:e.target.value})}/></Field><Field label="Task instructions"><textarea rows={4} maxLength={4000} className={control} value={task.description} onChange={e=>patch(task.id,{description:e.target.value})}/></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Run timing"><select aria-label="Run timing" className={control} value={task.mode||'scheduled'} onChange={e=>patch(task.id,{mode:e.target.value as Routine['mode'],time:task.time||'09:00'})}><option value="manual">On demand</option><option value="scheduled">At a recurring time</option></select></Field>{task.mode!=='manual'&&<Field label="Requested time"><input required type="time" className={control} value={task.time} onChange={e=>patch(task.id,{time:e.target.value})}/></Field>}</div>
     <fieldset><legend className="text-sm font-semibold">Task sources</legend>{sources.map((source:{id:string;name:string})=><label key={source.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={task.sourceIds?.includes(source.id)||false} onChange={()=>toggle(task,'sourceIds',source.id)}/>{source.name}</label>)}{(task.sourceIds||[]).filter(id=>!sources.some((s:{id:string})=>s.id===id)).map(id=><label key={id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked onChange={()=>toggle(task,'sourceIds',id)}/>Unavailable source: {id}</label>)}{!sources.length&&<p className="py-2 text-sm text-board-muted">Add sources in the Sources tab.</p>}</fieldset>
     <fieldset><legend className="text-sm font-semibold">Connected agents</legend>{availableConnections.map(c=>{const usable=!c.revoked_at&&Date.parse(c.expires_at)>Date.now()&&c.scopes.includes('batches:write');return <label key={c.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={task.connectionIds?.includes(c.id)||false} disabled={!usable&&!task.connectionIds?.includes(c.id)} onChange={()=>toggle(task,'connectionIds',c.id)}/>{c.name}{!usable?' · unavailable for pack publishing':''}</label>;})}{!availableConnections.length&&<p className="py-2 text-sm text-board-muted">Add an agent in Connections.</p>}</fieldset>
    </div>:<p className="mt-2 whitespace-pre-wrap pl-8 text-sm text-board-muted">{task.description}</p>}
   </li>)}</ul>
   {!draft.routines.length&&<div className="mt-4 flex flex-wrap items-center gap-3"><p className="text-sm text-board-muted">No tasks yet.</p><button type="button" className={secondary} onClick={()=>{edit({...defaultDailySchedule(draft.timezone),configVersion:draft.configVersion});setEditing(null);}}>Use default schedule</button></div>}
   <div className="mt-5 flex flex-wrap gap-3"><button type="button" className={secondary} disabled={draft.routines.length>=30} onClick={()=>{const id=crypto.randomUUID();edit({...draft,routines:[...draft.routines,{id,title:'New task',description:'',enabled:true,mode:'manual',time:'',sourceIds:[],connectionIds:[]}]});setEditing(id);}}>Add task</button><button type="submit" className={primary} disabled={!dirty}>{saving?'Saving…':'Save tasks'}</button></div>
  </fieldset></form>}
  {dirty&&<button type="button" className={`${secondary} mt-3`} disabled={saving} onClick={()=>setReload(v=>v+1)}>Discard edits and reload saved settings</button>}
  <Notice>{feedback}</Notice>
 </Section>;
}
export default function DailySchedule({connections}:{connections?:Connection[]}){const w=useWorkspace();return <Editor connections={connections} key={w.demo?`demo-${w.demoEpoch}`:w.user?.id||'guest'}/>;}
