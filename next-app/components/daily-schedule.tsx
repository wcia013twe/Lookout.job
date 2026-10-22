"use client";
import { useState } from 'react';
import { useWorkspace } from '../lib/workspace';
import { readDailySchedule } from '../../lib/daily-schedule.mjs';
import { Section, Field, control, primary, secondary, Notice } from './ui';

type Routine = {id:string;title:string;description:string;enabled:boolean;time:string};
type Schedule = {enabled:boolean;timezone:string;routines:Routine[]};
function Editor() {
  const w=useWorkspace(),prefs=w.state.workflow.searchPreferences||{};
  const initial:Schedule=readDailySchedule(prefs.schedule,Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC');
  const [draft,setDraft]=useState<Schedule>(initial),[feedback,setFeedback]=useState(''),[error,setError]=useState('');
  const [newTask,setNewTask]=useState<{title:string;description:string;time:string}|null>(null);
  const dirty=!prefs.schedule||JSON.stringify(readDailySchedule(draft))!==JSON.stringify(readDailySchedule(prefs.schedule));
  function edit(next:Schedule){setDraft(next);setFeedback('');setError('');}
  function addTask() {
    if(!newTask?.title.trim()){setError('Give your task a name.');return;}
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(newTask.time)){setError('Choose a time for your task.');return;}
    edit({...draft,routines:[...draft.routines,{...newTask,title:newTask.title.trim(),description:newTask.description.trim(),id:crypto.randomUUID(),enabled:true}]});
    setNewTask(null);
  }
  function save() {
    setError('');
    try {
      new Intl.DateTimeFormat('en',{timeZone:draft.timezone}).format();
      if(!draft.timezone.trim())throw Error();
    } catch {setError('Enter a valid time zone, such as America/New_York.');return;}
    if(draft.routines.some(r=>!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time))){setError('Choose a time for each routine.');return;}
    w.store.update('workflow.searchPreferences',(previous:Record<string,unknown>)=>({...previous,schedule:structuredClone(draft)}));
    setFeedback(w.demo?'Demo schedule saved. Changes stay in this preview.':w.user?'Schedule saved. Syncing with your settings.':'Schedule saved in this browser.');
  }
  return <Section title="Daily schedule">
    <p className="mb-5 max-w-prose text-sm leading-relaxed text-board-muted">Start with the Lookout defaults, then add or remove tasks to shape your agent’s day.</p>
    <form onSubmit={e=>{e.preventDefault();if(newTask)addTask();else save();}}>
      <fieldset disabled={w.locked}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
            <input type="checkbox" role="switch" className="h-5 w-5 accent-board-accent" checked={draft.enabled} onChange={e=>edit({...draft,enabled:e.target.checked})}/>
            Follow this schedule
          </label>
          <div className="w-full sm:w-64"><Field label="Time zone"><input required maxLength={100} className={control} value={draft.timezone} placeholder="America/New_York" onChange={e=>edit({...draft,timezone:e.target.value})}/></Field></div>
        </div>
        <ul aria-label="Daily agent routines" className="divide-y divide-board-line border-y border-board-line">
          {[...draft.routines].sort((a,b)=>a.time.localeCompare(b.time)).map(routine=>{
            const {id,title,description}=routine;
            return <li key={id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-start gap-3">
                <input type="checkbox" role="switch" aria-label={title} className="mt-1 h-5 w-5 shrink-0 accent-board-accent" checked={routine.enabled} disabled={!draft.enabled} onChange={e=>edit({...draft,routines:draft.routines.map(r=>r.id===id?{...r,enabled:e.target.checked}:r)})}/>
                <span className="min-w-0 [overflow-wrap:anywhere]"><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-sm leading-relaxed text-board-muted">{description}</span></span>
              </label>
              <div className="flex shrink-0 items-center gap-2 pl-8 sm:pl-0">
                <input type="time" required aria-label={`${title} time`} className={`${control} w-32`} disabled={!draft.enabled||!routine.enabled} value={routine.time} onChange={e=>edit({...draft,routines:draft.routines.map(r=>r.id===id?{...r,time:e.target.value}:r)})}/>
                <button type="button" className={secondary} aria-label={`Remove ${title}`} onClick={()=>edit({...draft,routines:draft.routines.filter(r=>r.id!==id)})}>Remove</button>
              </div>
            </li>;
          })}
        </ul>
        {!draft.routines.length&&<p className="mt-4 text-sm text-board-muted">No daily tasks. Add a task to build your schedule.</p>}
        {newTask?<div className="mt-5 space-y-4 border-b border-board-line pb-5">
          <h3 className="text-sm font-semibold">Add task</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Task name"><input autoFocus required maxLength={120} className={control} value={newTask.title} placeholder="Practice system design" onChange={e=>setNewTask({...newTask,title:e.target.value})}/></Field>
            <Field label="Task time"><input type="time" required className={control} value={newTask.time} onChange={e=>setNewTask({...newTask,time:e.target.value})}/></Field>
          </div>
          <Field label="Task instructions (optional)"><textarea rows={2} maxLength={1000} className={control} value={newTask.description} placeholder="What should your agent work on or remind you about?" onChange={e=>setNewTask({...newTask,description:e.target.value})}/></Field>
          <div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={addTask}>Add to schedule</button><button type="button" className={secondary} onClick={()=>{setNewTask(null);setError('');}}>Cancel</button></div>
        </div>:<button type="button" className={`${secondary} mt-4`} onClick={()=>{setNewTask({title:'',description:'',time:'09:00'});setError('');}}>Add task</button>}
        <div className="mt-5"><button type="submit" className={primary} disabled={!dirty||Boolean(newTask)}>Save schedule</button></div>
      </fieldset>
    </form>
    <p className="mt-3 text-sm text-board-muted">{w.demo?'Fictional demo schedule. Changes stay in this preview.':'Your connected agent handles scheduling and delivery.'}</p>
    <Notice>{error}</Notice>
    <Notice>{feedback}</Notice>
  </Section>;
}
export default function DailySchedule(){const w=useWorkspace();return <Editor key={w.demo?`demo-${w.demoEpoch}`:w.user?.id||'guest'}/>;}
