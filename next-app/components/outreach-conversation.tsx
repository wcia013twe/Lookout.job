"use client";
import { useState, type FormEvent } from "react";
import { conversationMessages, localDate, logInteraction, readConversation, validDate, waitingOn } from "../../lib/outreach-conversation.mjs";
import { Field, Notice, control, primary, secondary } from "./ui";
import type { ContactRecord } from "./referrals";

type LoggedMessage = {id:string;direction:string;channel:string;date:string;body:string};
type Props = { contact: ContactRecord; update: (fields: Partial<ContactRecord>) => void; ongoing: boolean };
export default function OutreachConversation({contact,update,ongoing}: Props) {
  const data = readConversation(contact);
  const messages = conversationMessages(contact);
  const [open,setOpen] = useState(false);
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
  return <section className="mt-6" aria-label="Conversation history">
    {ongoing && <>
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold">Conversation</h3><span className="text-sm text-board-muted">{waitingOn(contact)}</span></div>
      <p className="mt-2 text-sm text-board-muted">Manually logged history. LinkedIn and email inboxes are not connected.</p>
      {data.url && <a className={`${secondary} mt-3 inline-flex`} href={data.url} target="_blank" rel="noreferrer">Open conversation</a>}
      {messages.length ? <ol className="mt-5 space-y-5" aria-label="Logged messages">{messages.map((message: LoggedMessage)=><li key={message.id} className={`max-w-prose rounded-xl p-4 ${message.direction === "sent" ? "ml-4 bg-board-tag" : "mr-4 border border-board-line"}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><strong>{message.direction === "sent" ? "You" : contact.contact || contact.name}</strong><span className="text-board-muted">{message.channel} · <time dateTime={message.date}>{message.date}</time></span></div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
      </li>)}</ol> : <p className="my-5 text-sm text-board-muted">This contact has outreach progress recorded. Log the actual messages to build its history.</p>}
      <div className="mt-5"><Field label="Next follow-up"><input className={control} type="date" value={contact.followUpDate as string || ""} onChange={event=>{if(!event.target.value || validDate(event.target.value)) update({followUpDate:event.target.value});}}/></Field></div>
      {contact.followUpDate && <p className="mt-2 text-sm text-board-muted">{String(contact.followUpDate) < localDate() ? "Follow-up overdue" : "Follow up"} · {String(contact.followUpDate)}</p>}
    </>}
    <div className="mt-5 flex flex-wrap gap-2">
      <button type="button" className={primary} onClick={()=>{setDirection("sent");setOpen(true);setFeedback("");}}>Log sent message</button>
      {ongoing && <button type="button" className={secondary} onClick={()=>{setDirection("received");setOpen(true);setFeedback("");}}>Log reply</button>}
    </div>
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
