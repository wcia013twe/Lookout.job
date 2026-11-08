"use client";
import {OwnedDecisionActions} from './decision-buttons';
import ApiError from './api-error';
import { useState, type ReactNode } from "react";
import { CompanyLogo } from "./role-card";
import { useOutreach } from "../lib/outreach";
import { Field, Notice, control, primary, secondary } from "./ui";
import { OUTREACH_STATUSES, contactType, safeUrl } from "../../lib/outreach-model.mjs";

import { conversationStage, waitingOn } from "../../lib/outreach-conversation.mjs";
import OutreachConversation from "./outreach-conversation";
import AnnotatedMessage from "./annotated-message";
import ProfileIcon from "./profile-icon";

export type ContactRecord = { id: string; origin?: "target" | "person"; company?: string; contact?: string; name?: string; title?: string; role?: string; contactType?: string; message?: string; subject?: string; linkedin?: string; link?: string; evidence?: string; reason?: string; connection?: string; sourceUrl?: string; followUp?: string; followup?: string; notes?: string; status?: string; _cloudId?: string; _revision?: number; collection?: string; [key: string]: unknown };
type ContactGroup = { key: string; company: string; contacts: ContactRecord[] };
type ContactSetter = (contacts: ContactRecord[]) => void;
const typeLabels: Record<string, string> = { recruiter: "Recruiter", engineer: "Engineer", senior: "Senior engineer", manager: "Hiring manager", alumni: "Alumni", other: "Other contact" };
function ContactIcon({ type }: { type: string }) {
  const paths: Record<string, ReactNode> = {
    recruiter: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 10-4"/><circle cx="17" cy="16" r="3"/><path d="m19 18 3 3"/></>,
    engineer: <><path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16"/></>,
    senior: <><path d="m3 13 9-9 9 9m-18 7 9-9 9 9"/></>,
    manager: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18m-9 0v4"/></>,
    alumni: <><path d="m2 8 10-5 10 5-10 5-10-5m4 2v7c4 4 8 4 12 0v-7m4-2v9"/></>,
    other: <><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></>,
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type] || paths.other}</svg>;
}
export function MessageEditor({ contact, update, remove, processContext = false, personContext = false }: { contact: ContactRecord; update: (fields: Partial<ContactRecord>) => void; remove: () => void; processContext?: boolean; personContext?: boolean }) {
  const [feedback, setFeedback] = useState("");
  const kind = contactType(contact);
  const ongoing = conversationStage(contact) === "ongoing";
  const ready = !!contact.message?.trim() && !/\[[^\]]+\]/.test(contact.message!);
  async function copy(value: string | undefined, label: string) {
    try { await navigator.clipboard.writeText(value!); setFeedback(`${label} copied.`); }
    catch { setFeedback("Copy failed. Select the text below and copy it manually."); }
  }
  function draftMessage() { return <>
    <h3 className="mt-6 flex items-center gap-2 text-lg font-bold">{personContext&&<ProfileIcon name="mail" width={18} height={18}/>}Draft message</h3>
    {(contact.subject || personContext) && <div className="mt-4"><Field label="Email subject"><input className={control} name="subject" value={contact.subject||''} onChange={e => update({ subject: e.target.value })}/></Field></div>}
    <AnnotatedMessage contact={contact} name={contact.contact || contact.name || "contact"} onChange={message => { update({ message }); setFeedback(""); }}/>
    <div className="mt-4 flex flex-wrap gap-2"><button className={primary} type="button" disabled={!ready} onClick={() => copy(contact.message, "Message")}>{personContext&&<ProfileIcon name="copy" width={16} height={16}/>}Copy message</button>{contact.subject && <button className="min-h-11 px-2 text-sm text-board-muted underline decoration-board-line underline-offset-4 hover:text-board-text" type="button" onClick={() => copy(contact.subject, "Subject")}>Copy subject</button>}</div>
    <Notice>{feedback}</Notice>
    {contact.message && !ready && <Notice>Replace the bracketed placeholders before copying.</Notice>}
  </>; }
  const linkedin = safeUrl(contact.linkedin, true), link = safeUrl((contact.jobUrl as string)||contact.link);
  return <section className="network-contact-editor min-w-0" aria-label={`Outreach for ${contact.contact || contact.name}`}>
    {!personContext && <div className="flex flex-wrap items-start justify-between gap-4 border-b border-board-line pb-5">
      <div className="flex min-w-0 items-center gap-3">{!processContext && <CompanyLogo company={contact.company || ""}/>}<span className="text-board-accent"><ContactIcon type={kind}/></span><div className="min-w-0"><h2 className="break-words text-lg font-semibold">{contact.contact || contact.name}</h2><p className="mt-1 text-sm text-board-muted">{typeLabels[kind]}{!processContext && ` at ${contact.company}`}</p>{!processContext && (contact.title || contact.role) && <p className="mt-2 text-sm text-board-muted">For {contact.title || contact.role}</p>}</div><span className="network-status-badge">{contact.status || "Not asked"}</span></div>
      <div className="flex flex-wrap gap-2">{linkedin && <a className={secondary} href={linkedin} target="_blank" rel="noreferrer">Open LinkedIn</a>}{link && <a className={secondary} href={link} target="_blank" rel="noreferrer">View role</a>}</div>
    </div>}
    {!personContext && ongoing && <OutreachConversation contact={contact} update={update} ongoing/>}
    {!personContext && ongoing ? <details className="mt-7 border-t border-board-line pt-5"><summary className="cursor-pointer text-sm font-semibold">Prepare another message</summary>{draftMessage()}</details> : draftMessage()}
    {!personContext && !ongoing && <OutreachConversation contact={contact} update={update} ongoing={false}/>}
    {personContext&&<OwnedDecisionActions kind="review_outreach" sourceId={String(contact._cloudId||contact.id)} body={contact.message||''} subject={contact.subject||''} recipient={contact.contact||contact.name||''} destination={String(contact.email||contact.linkedin||'')}/>}
    {!personContext && <details className="network-contact-management"><summary>Manage contact</summary><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><label className="flex flex-wrap items-center gap-2 text-sm text-board-muted">Outreach status<select className={control} value={contact.status || "Not asked"} onChange={e => update({ status: e.target.value })}>{OUTREACH_STATUSES.map(status => <option key={status}>{status}</option>)}</select></label><button className="min-h-11 px-3 text-sm text-board-muted hover:text-board-text" type="button" onClick={remove}>Remove contact</button></div>
    <OwnedDecisionActions kind="review_outreach" sourceId={String(contact._cloudId||contact.id)} body={contact.message||''} subject={contact.subject||''} recipient={contact.contact||contact.name||''} destination={String(contact.email||contact.linkedin||'')}/><p className="mt-3 text-xs text-board-muted">Update the status after you send. Copying a message doesn’t mark it sent.</p></details>}
  </section>;
}
export default function Referrals({company,contactIds=[]}: {company?: string;contactIds?:string[]}) {
 const outreach=useOutreach();
 const contacts:ContactRecord[]=outreach.contacts.filter((p:ContactRecord)=>contactIds.includes(p.id)||(p.company||'').trim().toLowerCase()===(company||'').trim().toLowerCase());
 return <section className="company-contact-panel"><h2 className="text-lg font-semibold">People at {company}</h2><ApiError message={outreach.error} cached={contacts.length>0} onRetry={()=>void outreach.refresh().catch(()=>{})}/><ul className="mt-4 divide-y divide-board-line">{contacts.map(person=><li key={person.id} className="py-4"><a className="font-semibold text-board-accent underline underline-offset-4" href={`?person=${encodeURIComponent(person.id)}`}>{person.contact||person.name}</a><p className="mt-1 text-sm text-board-muted">{String(person.professionalTitle||person.title||'')}</p></li>)}</ul>{!contacts.length&&<p className="py-5 text-sm text-board-muted">No saved people linked to this company.</p>}</section>;
}
