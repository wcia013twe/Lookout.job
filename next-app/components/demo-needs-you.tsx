"use client";
import { useState } from "react";
import NeedsYouRow, { ActionCheck } from "./needs-you-row";
import PreparationReminders from "./preparation-reminders";
import { demoNeedsYouTasks } from "../lib/demo.mjs";
import { Heading, Notice, Field, control, primary, secondary } from "./ui";
type Task = (typeof demoNeedsYouTasks)[number];
type DemoRole = { company:string; roleTitle:string; roleType:string; date:string; status:string; workflow:string };

function TaskControls({ task, onComplete }: { task: Task; onComplete: (message:string)=>void }) {
 const [result,setResult]=useState("");
 const [text,setText]=useState(task.id==='outreach-review' ? 'Hi Alex, I’m exploring infrastructure engineering at Example Platform. Would you be open to pointing me toward the right recruiting contact?' : task.id==='application-review' ? 'I enjoy debugging reliability and performance problems.' : '');
 const [choice,setChoice]=useState('');
 const [checked,setChecked]=useState(false);
 const [opened,setOpened]=useState(false);
 const [date,setDate]=useState('2026-10-22');
 return <><fieldset className="max-w-2xl space-y-4">
 {task.id==='application-review' && <>
 <Field label="Resume"><select className={control} value={choice} onChange={e=>{setChoice(e.target.value);setChecked(false);}}><option value="">Choose a resume</option><option>Backend resume · v1</option><option>Infrastructure resume · v1</option></select></Field>
 <Field label="Why this team?"><textarea className={control} value={text} onChange={e=>{setText(e.target.value);setChecked(false);}} /></Field>
 <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} />I reviewed this resume and answer.</label>
 <button className={primary} disabled={!checked||!choice||!text.trim()} onClick={()=>onComplete('Application review completed in the demo. Nothing was submitted.')}>Approve this version</button></>}
 {task.id==='missing-answer' && <><Field label="Can you work onsite three days a week?"><select className={control} value={choice} onChange={e=>setChoice(e.target.value)}><option value="">Choose an answer</option><option>Yes</option><option>No</option><option>I need to discuss the schedule</option></select></Field><button className={primary} disabled={!choice} onClick={()=>onComplete(`Answer confirmed: ${choice}. The demo draft can continue.`)}>Confirm answer</button></>}
 {task.id==='manual-step' && <><p className="text-sm text-board-muted">Complete verification in the employer form, then return here.</p><div className="flex flex-wrap gap-3"><button className={secondary} onClick={()=>setOpened(true)}>Preview employer form</button><button className={primary} disabled={!opened} onClick={()=>onComplete('Manual step completed in the demo. The draft can continue.')}>I completed verification</button></div>{opened&&<Notice>A CAPTCHA would appear on the real employer form. This preview opens no external site.</Notice>}</>}
 {task.id==='uncertain-submission' && <><p className="text-sm text-board-muted">Check the employer portal or confirmation email before deciding.</p><Field label="Verification note"><textarea className={control} value={text} onChange={e=>setText(e.target.value)} /></Field><div className="flex flex-wrap gap-3"><button className={primary} disabled={!text.trim()} onClick={()=>onComplete('Recorded as submitted by you in the demo. Retry is blocked.')}>It submitted</button><button className={secondary} disabled={!text.trim()} onClick={()=>onComplete('Verified not submitted in the demo. A fresh attempt can be prepared.')}>It did not submit</button><button className={secondary} onClick={()=>setResult('Still uncertain. The application stays on the board and retry remains blocked.')}>Still unsure</button></div></>}
 {task.id==='deadline-confirmation' && <><blockquote className="border-l border-board-line pl-4 text-sm text-board-muted">Fictional email: “Please complete the interview by Friday, October 23.” Scheduling link: Thursday, October 22.</blockquote><Field label="Confirmed deadline"><input type="date" className={control} value={date} onChange={e=>{setDate(e.target.value);setChecked(false);}} /></Field><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} />I checked the correct date with the recruiter.</label><button className={primary} disabled={!date||!checked} onClick={()=>onComplete(`Deadline confirmed: ${date}. Demo preparation can be scheduled.`)}>Confirm deadline</button></>}
 {task.id==='outreach-review' && <><p className="text-sm text-board-muted">To: Alex Morgan · Example Platform (fictional)</p><Field label="Referral message"><textarea className={`${control} min-h-36`} value={text} onChange={e=>setText(e.target.value)} /></Field><div className="flex flex-wrap gap-3"><button className={primary} disabled={!text.trim()} onClick={()=>onComplete('This edited message is authorized in the demo. Nothing was sent.')}>Authorize this message</button><button className={secondary} onClick={()=>onComplete('Message held. Sending remains unauthorized.')}>Hold message</button></div></>}
 {task.id==='reconnect-service' && <><p className="text-sm">Email connection: expired</p><p className="text-sm text-board-muted">Invitation checks are paused. Reconnecting would allow reading interview invitations for saved applications.</p><button className={primary} onClick={()=>onComplete('Reconnection simulated. No access was granted.')}>Reconnect email (demo)</button></>}
 </fieldset>{result&&<Notice>{result}</Notice>}</>;
}

export default function DemoNeedsYou() {
 const [version,setVersion]=useState(0), [active,setActive]=useState<string|null>(null), [completed,setCompleted]=useState<string[]>([]), [feedback,setFeedback]=useState('');
 const tasks=demoNeedsYouTasks.filter(task=>!completed.includes(task.id));
 function finish(task:Task,message:string){setCompleted(current=>[...current,task.id]);setActive(null);setFeedback(message);}
 function reset(){setVersion(value=>value+1);setActive(null);setCompleted([]);setFeedback('');}
 return <><Heading title="Action Board">A working preview of decisions, manual steps, and Muse-organized reminders. Everything here is fictional.</Heading>
 <div className="action-board-layout grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.85fr)]">
        <PreparationReminders />
  <section className="glass-panel action-widget min-w-0 rounded-2xl p-5 md:p-6" aria-labelledby="demo-checklist-heading">
   <div className="flex items-start justify-between gap-4"><div><h2 id="demo-checklist-heading" className="text-lg font-bold">Your checklist</h2><p className="mt-1 text-sm leading-relaxed text-board-muted">Select a box, finish the handoff, and the row clears.</p></div><span className="action-widget-count rounded-md px-2 py-1 text-xs font-semibold tabular-nums">{tasks.length}</span></div>
   {feedback&&<Notice>{feedback}</Notice>}
   {tasks.length?<ul className="mt-3 divide-y divide-board-line">{tasks.map(task=>{const controlsId=`demo-task-controls-${task.id}`;return <NeedsYouRow key={`${version}:${task.id}`} title={task.title} context={task.context} reason={task.reason} role={(task as Task & {role?:DemoRole}).role} control={<ActionCheck label={`${active===task.id?'Close':'Open'} ${task.title}`} expanded={active===task.id} controls={controlsId} onClick={()=>setActive(current=>current===task.id?null:task.id)} />}>
    {active===task.id&&<div id={controlsId}><TaskControls task={task} onComplete={message=>finish(task,message)}/></div>}
   </NeedsYouRow>})}</ul>:<div className="py-12 text-center"><h3 className="font-bold">Checklist cleared</h3><p className="mt-2 text-sm text-board-muted">The fictional handoffs are complete.</p></div>}
   <button className={`${secondary} mt-5`} onClick={reset}>Reset task preview</button>
  </section>
 </div></>;
}
