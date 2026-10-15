"use client";
import { useState } from "react";
import NeedsYouRow from "./needs-you-row";
import { demoNeedsYouTasks } from "../lib/demo.mjs";
import { Heading, Notice, Field, control, primary, secondary } from "./ui";
import styles from "./needs-you.module.css";
type Task = (typeof demoNeedsYouTasks)[number];
function TaskControls({ task }: { task: Task }) {
 const [result,setResult]=useState("");
 const [text,setText]=useState(task.id==='outreach-review' ? 'Hi Alex, I’m exploring infrastructure engineering at Example Platform. Would you be open to pointing me toward the right recruiting contact?' : task.id==='application-review' ? 'I enjoy debugging reliability and performance problems.' : '');
 const [choice,setChoice]=useState('');
 const [checked,setChecked]=useState(false);
 const [opened,setOpened]=useState(false);
 const [date,setDate]=useState('2026-10-22');
 return <><fieldset disabled={!!result} className="max-w-2xl space-y-4 disabled:opacity-60">
 {task.id==='application-review' && <>
 <Field label="Resume"><select className={control} value={choice} onChange={e=>{setChoice(e.target.value);setChecked(false);}}><option value="">Choose a resume</option><option>Backend resume · v1</option><option>Infrastructure resume · v1</option></select></Field>
 <Field label="Why this team?"><textarea className={control} value={text} onChange={e=>{setText(e.target.value);setChecked(false);}} /></Field>
 <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} />I reviewed this resume and answer.</label>
 <button className={primary} disabled={!checked||!choice||!text.trim()} onClick={()=>setResult('This version is approved in the demo. Nothing was submitted.')}>Approve this version</button></>}
 {task.id==='missing-answer' && <><Field label="Can you work onsite three days a week?"><select className={control} value={choice} onChange={e=>setChoice(e.target.value)}><option value="">Choose an answer</option><option>Yes</option><option>No</option><option>I need to discuss the schedule</option></select></Field><button className={primary} disabled={!choice} onClick={()=>setResult(`Answer confirmed: ${choice}. The demo draft can continue.`)}>Confirm answer</button></>}
 {task.id==='manual-step' && <><p className="text-sm text-board-muted">Complete verification in the employer form, then return here.</p><div className="flex flex-wrap gap-3"><button className={secondary} onClick={()=>setOpened(true)}>Preview employer form</button><button className={primary} disabled={!opened} onClick={()=>setResult('Manual step completed in the demo. The draft can continue.')}>I completed verification</button></div>{opened&&<Notice>A CAPTCHA would appear on the real employer form. This preview opens no external site.</Notice>}</>}
 {task.id==='uncertain-submission' && <><p className="text-sm text-board-muted">Check the employer portal or confirmation email before deciding.</p><Field label="Verification note"><textarea className={control} value={text} onChange={e=>setText(e.target.value)} /></Field><div className="flex flex-wrap gap-3"><button className={primary} disabled={!text.trim()} onClick={()=>setResult('Recorded as submitted by you in the demo. Retry is blocked.')}>It submitted</button><button className={secondary} disabled={!text.trim()} onClick={()=>setResult('Verified not submitted in the demo. A fresh attempt can be prepared.')}>It did not submit</button><button className={secondary} onClick={()=>setResult('Still uncertain. The application stays paused and retry remains blocked.')}>Still unsure</button></div></>}
 {task.id==='deadline-confirmation' && <><blockquote className="border-l border-board-line pl-4 text-sm text-board-muted">Fictional email: “Please complete the interview by Friday, October 23.” Scheduling link: Thursday, October 22.</blockquote><Field label="Confirmed deadline"><input type="date" className={control} value={date} onChange={e=>{setDate(e.target.value);setChecked(false);}} /></Field><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} />I checked the correct date with the recruiter.</label><button className={primary} disabled={!date||!checked} onClick={()=>setResult(`Deadline confirmed: ${date}. Demo preparation can be scheduled.`)}>Confirm deadline</button></>}
 {task.id==='outreach-review' && <><p className="text-sm text-board-muted">To: Alex Morgan · Example Platform (fictional)</p><Field label="Referral message"><textarea className={`${control} min-h-36`} value={text} onChange={e=>setText(e.target.value)} /></Field><div className="flex flex-wrap gap-3"><button className={primary} disabled={!text.trim()} onClick={()=>setResult('This edited message is authorized in the demo. Nothing was sent.')}>Authorize this message</button><button className={secondary} onClick={()=>setResult('Message held. Sending remains unauthorized.')}>Hold message</button></div></>}
 {task.id==='reconnect-service' && <><p className="text-sm">Email connection: expired</p><p className="text-sm text-board-muted">Invitation checks are paused. Reconnecting would allow reading interview invitations for saved applications.</p><button className={primary} onClick={()=>setResult('Reconnection simulated. Invitation checks can resume; no access was granted.')}>Reconnect email (demo)</button></>}
 </fieldset>{result&&<Notice>{result}</Notice>}</>;
}
export default function DemoNeedsYou() {
 const [version,setVersion]=useState(0);
 return <><Heading title="Needs you">Decisions and manual steps that are holding up your search.</Heading><p className="mb-6 text-sm text-board-muted">Seven fictional examples. Actions affect this preview only.</p><ul className={styles.grid}>{demoNeedsYouTasks.map((task,index)=><NeedsYouRow key={`${version}:${task.id}`} sequence={index+1} title={task.title} context={task.context} reason={task.reason}><details className="group"><summary className={`${secondary} cursor-pointer list-none`}>{task.action}</summary><div className="mt-4"><TaskControls task={task}/></div></details></NeedsYouRow>)}</ul><button className={`${secondary} mt-5`} onClick={()=>setVersion(v=>v+1)}>Reset task previews</button></>;
}
