"use client";
import { useState } from 'react';
import { useWorkspace } from '../lib/workspace';
import { dailyRoutines, defaultDailySchedule } from '../../lib/daily-schedule.mjs';
import { Section, Field, control, primary, Notice } from './ui';

type Routine = {id:string;enabled:boolean;time:string};
type Schedule = {enabled:boolean;timezone:string;routines:Routine[]};
function Editor() {
  const w=useWorkspace(),prefs=w.state.workflow.searchPreferences||{};
  const initial:Schedule=prefs.schedule?.routines?.length===4?prefs.schedule:defaultDailySchedule(Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC');
  const [draft,setDraft]=useState<Schedule>(initial),[feedback,setFeedback]=useState(''),[error,setError]=useState('');
  const dirty=JSON.stringify(draft)!==JSON.stringify(prefs.schedule);
  function edit(next:Schedule){setDraft(next);setFeedback('');setError('');}
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
    <p className="mb-5 max-w-prose text-sm leading-relaxed text-board-muted">Your agent works through the day and checks in with important reminders and progress for you to review.</p>
    <form onSubmit={e=>{e.preventDefault();void save();}}>
      <fieldset disabled={w.locked}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
            <input type="checkbox" role="switch" className="h-5 w-5 accent-board-accent" checked={draft.enabled} onChange={e=>edit({...draft,enabled:e.target.checked})}/>
            Follow this schedule
          </label>
          <div className="w-full sm:w-64"><Field label="Time zone"><input required maxLength={100} className={control} value={draft.timezone} placeholder="America/New_York" onChange={e=>edit({...draft,timezone:e.target.value})}/></Field></div>
        </div>
        <ul aria-label="Daily agent routines" className="divide-y divide-board-line border-y border-board-line">
          {dailyRoutines.map(({id,title,description})=>{
            const routine=draft.routines.find(r=>r.id===id)!;
            return <li key={id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-start gap-3">
                <input type="checkbox" role="switch" aria-label={title} className="mt-1 h-5 w-5 shrink-0 accent-board-accent" checked={routine.enabled} disabled={!draft.enabled} onChange={e=>edit({...draft,routines:draft.routines.map(r=>r.id===id?{...r,enabled:e.target.checked}:r)})}/>
                <span className="min-w-0"><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-sm leading-relaxed text-board-muted">{description}</span></span>
              </label>
              <input type="time" required aria-label={`${title} time`} className={`${control} basis-32 sm:w-32 sm:flex-none`} disabled={!draft.enabled||!routine.enabled} value={routine.time} onChange={e=>edit({...draft,routines:draft.routines.map(r=>r.id===id?{...r,time:e.target.value}:r)})}/>
            </li>;
          })}
        </ul>
        <button type="submit" className={`${primary} mt-5`} disabled={!dirty}>Save schedule</button>
      </fieldset>
    </form>
    <p className="mt-3 text-sm text-board-muted">{w.demo?'Fictional demo schedule. Changes stay in this preview.':'Your connected agent handles scheduling and delivery.'}</p>
    <Notice>{error}</Notice>
    <Notice>{feedback}</Notice>
  </Section>;
}
export default function DailySchedule(){const w=useWorkspace();return <Editor key={w.demo?`demo-${w.demoEpoch}`:w.user?.id||'guest'}/>;}
