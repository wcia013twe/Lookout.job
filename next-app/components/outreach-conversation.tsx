"use client";
import { useState, type FormEvent } from "react";
import { conversationMessages, conversationTimeline, conversationMeetings, recordMeeting, localDate, logInteraction, readConversation, validDate, waitingOn } from "../../lib/outreach-conversation.mjs";
import { Field, Notice, control, primary, secondary } from "./ui";
import ProfileIcon from "./profile-icon";
import type { ContactRecord } from "./referrals";

type Meeting = {id:string;kind:"coffee_chat"|"meeting";status:"scheduled"|"completed"|"cancelled";date:string;notes:string;location:string};
type LoggedMessage = {id:string;kind:string;direction?:string;channel?:string;date:string;body?:string;status?:string;notes?:string;location?:string};
type Props = { contact: ContactRecord; update: (fields: Partial<ContactRecord>) => void; ongoing: boolean };
export default function OutreachConversation({contact,update,ongoing}: Props) {
  const data = readConversation(contact);
  const messages = conversationMessages(contact);
  const events = conversationTimeline(contact);
  const meetings = conversationMeetings(contact) as Meeting[];
  const [meetingDraft,setMeetingDraft] = useState<Meeting|null>(null);
  const nextMeeting = meetings.find(meeting=>meeting.status === "scheduled" && meeting.date >= localDate());
  function saveMeeting(event:FormEvent<HTMLFormElement>) {event.preventDefault();if(!meetingDraft)return;try{update(recordMeeting(contact,meetingDraft));setMeetingDraft(null);setFeedback("Meeting record saved. No invitation was sent.");}catch(error){setFeedback(error instanceof Error?error.message:"Meeting could not save.");}}
  const [open,setOpen] = useState(false);
  const [followUpOpen,setFollowUpOpen] = useState(false);
  const [direction,setDirection] = useState("sent");
  const [feedback,setFeedback] = useState("");
  function log(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form)) as Record<string,string>;
    try {
      update(logInteraction(contact,{id:crypto.randomUUID(),direction,channel:values.channel,date:values.date,body:values.body.trim()},values.url.trim()));
      setOpen(false);setFeedback(direction === "sent" ? "Sent message logged." : "Reply logged.");
    } catch(error) {setFeedback(error instanceof Error ? error.message : "Could not log message.");}
  }
  return <section className="network-conversation" aria-label="Conversation history">
    {ongoing && <>
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-semibold">Conversation</h3><span className="network-status-badge">{waitingOn(contact)}</span></div>
      <p className="mt-2 text-xs text-board-muted">Logged updates · inboxes aren’t synced</p>
      {data.url && <a className={`${secondary} mt-3 inline-flex`} href={data.url} target="_blank" rel="noreferrer">Open conversation</a>}
      {nextMeeting && <div className="network-meeting-next"><ProfileIcon name="clock" width={18} height={18}/><span>{nextMeeting.kind === 'coffee_chat' ? 'Coffee chat' : 'Meeting'} scheduled · <time dateTime={nextMeeting.date}>{nextMeeting.date}</time></span><button type="button" onClick={()=>setMeetingDraft({...nextMeeting})}>Update</button></div>}
      {events.length ? <ol className="network-message-history" aria-label="Conversation timeline">{events.map((entry: LoggedMessage)=>entry.kind === 'message' ? <li key={entry.id} className="network-message-event">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><strong>{entry.direction === "sent" ? "You" : contact.contact || contact.name}</strong><span className="text-board-muted">{entry.channel} · <time dateTime={entry.date}>{entry.date}</time></span></div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{entry.body}</p>
      </li> : <li key={entry.id} className="network-meeting-event"><ProfileIcon name={entry.kind==='coffee_chat'?'conversation':'clock'} width={20} height={20}/><div><header><strong>{entry.kind==='coffee_chat'?'Coffee chat':'Meeting'}</strong><span className="network-status-badge">{entry.status === 'scheduled'?'Scheduled':entry.status === 'completed'?'Completed':'Cancelled'}</span><time dateTime={entry.date}>{entry.date}</time></header>{entry.location&&<p className="text-sm text-board-muted">{entry.location}</p>}{entry.notes?<p className="debrief-summary">{entry.notes}</p>:<p className="mt-2 text-xs text-board-muted">No notes added.</p>}<button type="button" className="network-quiet-action" onClick={()=>setMeetingDraft({...entry} as Meeting)}>{entry.notes?'Update meeting':'Add notes or update'}</button></div></li>)}</ol> : <p className="network-history-empty">No interactions logged yet. Add a message, reply or meeting to capture the conversation.</p>}


    </>}
    <div className="network-log-actions">
      <button type="button" className={secondary} onClick={()=>{setDirection("sent");setOpen(true);setFeedback("");}}>Log sent message</button>
      {ongoing && <button type="button" className={secondary} onClick={()=>{setDirection("received");setOpen(true);setFeedback("");}}>Log reply</button>}
      <button type="button" className={secondary} onClick={()=>{setMeetingDraft({id:crypto.randomUUID(),kind:"coffee_chat",status:"scheduled",date:localDate(),notes:"",location:""});setFeedback("");}}>Log meeting</button>
      {ongoing && <button type="button" className="network-quiet-action" aria-expanded={followUpOpen} onClick={()=>setFollowUpOpen(!followUpOpen)}>{contact.followUpDate ? `Follow up · ${contact.followUpDate}` : "Set follow-up"}</button>}
    </div>
    {ongoing && followUpOpen && <div className="network-follow-up"><Field label="Next follow-up"><input className={control} type="date" value={contact.followUpDate as string || ""} onChange={event=>{if(!event.target.value || validDate(event.target.value))update({followUpDate:event.target.value});}}/></Field>{Boolean(contact.followUpDate) && String(contact.followUpDate)<localDate()&&<p className="mt-2 text-xs text-board-muted">Follow-up overdue</p>}</div>}
    {meetingDraft && <form onSubmit={saveMeeting} className="network-meeting-editor" aria-label="Log meeting"><h4>Coffee chat or meeting</h4><p className="text-sm text-board-muted">Keep a record of an arranged or completed conversation. Notes are optional; this does not send an invitation.</p><div className="grid gap-4 sm:grid-cols-2"><Field label="Interaction type"><select aria-label="Interaction type" className={control} value={meetingDraft.kind} onChange={e=>setMeetingDraft({...meetingDraft,kind:e.target.value as Meeting['kind']})}><option value="coffee_chat">Coffee chat</option><option value="meeting">Meeting</option></select></Field><Field label="Meeting status"><select aria-label="Meeting status" className={control} value={meetingDraft.status} onChange={e=>setMeetingDraft({...meetingDraft,status:e.target.value as Meeting['status']})}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></Field><Field label="Meeting date"><input aria-label="Meeting date" className={control} type="date" required value={meetingDraft.date} onChange={e=>setMeetingDraft({...meetingDraft,date:e.target.value})}/></Field><Field label="Location or call details (optional)"><input aria-label="Location or call details (optional)" className={control} maxLength={500} value={meetingDraft.location} onChange={e=>setMeetingDraft({...meetingDraft,location:e.target.value})}/></Field></div><Field label="Meeting notes (optional)"><textarea aria-label="Meeting notes (optional)" className={control} rows={3} maxLength={4000} value={meetingDraft.notes} onChange={e=>setMeetingDraft({...meetingDraft,notes:e.target.value})} placeholder="Topics, takeaways, and anything you agreed to follow up on."/></Field><div className="debrief-actions"><button type="submit" className={primary}>Save meeting</button><button type="button" className={secondary} onClick={()=>setMeetingDraft(null)}>Cancel</button></div></form>}
    {open && <form key={direction} onSubmit={log} className="mt-5 space-y-4 border-t border-board-line pt-5" aria-label={direction === "sent" ? "Log sent message" : "Log reply"}>
      <p className="text-sm text-board-muted">{direction === "sent" ? "Record a message you already sent outside Lookout." : "Paste a reply you received, or summarize it."}</p>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Channel"><select aria-label="Channel" name="channel" className={control} defaultValue={messages.at(-1)?.channel || "LinkedIn"}><option>LinkedIn</option><option>Email</option></select></Field><Field label="Message date"><input name="date" type="date" className={control} defaultValue={localDate()} required/></Field></div>
      <Field label="Message or summary"><textarea aria-label="Message or summary" className={control} name="body" rows={4} maxLength={4000} defaultValue={direction === "sent" && !messages.length ? contact.message : ""} required/></Field>
      <Field label="Conversation link (optional)"><input name="url" type="url" className={control} defaultValue={data.url} placeholder="https://www.linkedin.com/messaging/thread/…" maxLength={2000}/></Field>
      <div className="flex flex-wrap gap-2"><button type="submit" className={primary}>Save logged message</button><button type="button" className={secondary} onClick={()=>setOpen(false)}>Cancel</button></div>
    </form>}
    <Notice>{feedback}</Notice>
  </section>;
}
