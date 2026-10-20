"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useSlice } from "../lib/workspace";
import { CompanyLogo } from "./role-card";
import { useOutreach } from "../lib/outreach";
import ProfileSurface, { profileStyles } from "./profile-surface";
import { motion, useReducedMotion } from "framer-motion";
import { Field, Heading, Notice, control, primary, secondary } from "./ui";
import { OUTREACH_STATUSES, contactType, groupContacts, safeUrl } from "../../lib/outreach-model.mjs";

import OutreachTemplates from "./outreach-templates";
import AnnotatedMessage from "./annotated-message";

import { errorMessage } from "./profile-types";
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
export function MessageEditor({ contact, update, remove }: { contact: ContactRecord; update: (fields: Partial<ContactRecord>) => void; remove: () => void }) {
  const [feedback, setFeedback] = useState("");
  const kind = contactType(contact);
  const ready = !!contact.message?.trim() && !/\[[^\]]+\]/.test(contact.message!);
  async function copy(value: string | undefined, label: string) {
    try { await navigator.clipboard.writeText(value!); setFeedback(`${label} copied.`); }
    catch { setFeedback("Copy failed. Select the text below and copy it manually."); }
  }
  const linkedin = safeUrl(contact.linkedin, true), link = safeUrl((contact.jobUrl as string)||contact.link);
  return <section className="min-w-0" aria-label={`Outreach for ${contact.contact || contact.name}`}>
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-board-line pb-5">
      <div className="flex min-w-0 items-center gap-3"><CompanyLogo company={contact.company || ""}/><span className="text-board-accent"><ContactIcon type={kind}/></span><div className="min-w-0"><h2 className="break-words text-xl font-bold">{contact.contact || contact.name}</h2><p className="mt-1 text-sm text-board-muted">{typeLabels[kind]} at {contact.company}</p>{(contact.title || contact.role) && <p className="mt-2 text-sm text-board-muted">For {contact.title || contact.role}</p>}</div></div>
      <div className="flex flex-wrap gap-2">{linkedin && <a className={secondary} href={linkedin} target="_blank" rel="noreferrer">Open LinkedIn</a>}{link && <a className={secondary} href={link} target="_blank" rel="noreferrer">View role</a>}</div>
    </div>
    <h3 className="mt-6 text-lg font-bold">Your message</h3>
    {contact.subject && <div className="mt-4"><Field label="Email subject"><input className={control} name="subject" value={contact.subject} onChange={e => update({ subject: e.target.value })}/></Field></div>}
    <AnnotatedMessage contact={contact} name={contact.contact || contact.name || "contact"} onChange={message => { update({ message }); setFeedback(""); }}/>
    <div className="mt-4 flex flex-wrap gap-2"><button className={primary} type="button" disabled={!ready} onClick={() => copy(contact.message, "Message")}>Copy message</button>{contact.subject && <button className={secondary} type="button" onClick={() => copy(contact.subject, "Subject")}>Copy subject</button>}</div>
    <Notice>{feedback}</Notice>
    {contact.message && !ready && <Notice>Replace the bracketed placeholders before copying.</Notice>}
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-board-line pt-5"><label className="flex flex-wrap items-center gap-2 text-sm text-board-muted">Outreach status<select className={control} value={contact.status || "Not asked"} onChange={e => update({ status: e.target.value })}>{OUTREACH_STATUSES.map(status => <option key={status}>{status}</option>)}</select></label><button className="min-h-11 px-3 text-sm text-board-muted hover:text-board-text" type="button" onClick={remove}>Remove contact</button></div>
    <p className="mt-3 text-xs text-board-muted">Update the status after you send. Copying a message doesn’t mark it sent.</p>
  </section>;
}
export default function Referrals({company,contactIds=[]}: {company?: string;contactIds?:string[]}) {
  const outreach = useOutreach();
  const reducedMotion = useReducedMotion();
  const targets: ContactRecord[] = outreach.contacts, setTargets = outreach.setContacts;
  const [people, setPeople] = useSlice("network.people") as [ContactRecord[], ContactSetter];
  const [selected, setSelected] = useState<string | null>(outreach.demo ? "target:demo-referral" : null);
  const messageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected && window.matchMedia("(max-width: 1023px)").matches) messageRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [selected]);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [museOpen, setMuseOpen] = useState(false);
  const [companyText, setCompanyText] = useState(company || "");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const allContacts: ContactRecord[] = [...(targets || []).map(r => ({ ...r, origin: "target" as const })), ...(people || []).map(r => ({ ...r, origin: "person" as const }))];
  const all = company ? allContacts.filter(r=>contactIds.includes(r.id)||(r.company||'Other contacts').trim().toLowerCase().replace(/\s+/g," ")===company.trim().toLowerCase().replace(/\s+/g," ")) : allContacts;
  const groups: ContactGroup[] = groupContacts(all.filter(r => `${r.company} ${r.contact || r.name} ${r.title || r.role || ""}`.toLowerCase().includes(query.toLowerCase())));
  const contact = all.find(r => `${r.origin}:${r.id}` === selected) || groups[0]?.contacts[0];
  function update(fields: Partial<ContactRecord>) {
    const rows = contact!.origin === "person" ? people : targets;
    const setter = contact!.origin === "person" ? setPeople : setTargets;
    setter(rows.map(r => r.id === contact!.id ? { ...r, ...fields } : r));
  }
  function remove() {
    if (contact!.origin === "person") setPeople(people.filter(r => r.id !== contact!.id));
    else setTargets(targets.filter(r => r.id !== contact!.id));
    setSelected(null);
  }
  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (!data.company.trim() || !data.contact.trim()) return;
    if (data.linkedin && !safeUrl(data.linkedin, true)) { setFeedback("Use a LinkedIn profile URL such as https://www.linkedin.com/in/name/."); return; }
    const id = crypto.randomUUID(); setTargets([...(targets || []), { ...data, id, status: "Not asked", source: "Manual" }]);
    setSelected(`target:${id}`); setAddOpen(false); setFeedback("");
  }
  async function requestOutreach(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setFeedback("");
    try { await outreach.request(companyText.split(/[,\n]/)); setMuseOpen(false); setFeedback(outreach.demo ? "Demo outreach prepared." : "Request saved. Muse will prepare your contacts and messages on its next connected run."); }
    catch(error) { setFeedback(errorMessage(error)); }
    finally { setBusy(false); }
  }
  function openMuse() { setMuseOpen(!museOpen); setCompanyText((groupContacts(all) as ContactGroup[]).map(g=>g.company).join(", ")); setAddOpen(false); setFeedback(""); }
  return <ProfileSurface>
    <div className="flex flex-wrap items-start justify-between gap-4"><Heading title={company ? "People & outreach" : "Referrals"}>Review your message, make it yours, and copy it to send.</Heading><div className="flex flex-wrap gap-2">{!!all.length && <button type="button" className={primary} aria-expanded={museOpen} onClick={openMuse}>Prepare with Muse</button>}<button type="button" className={secondary} aria-expanded={addOpen} onClick={() => { setAddOpen(!addOpen); setMuseOpen(false); setFeedback(""); }}>Add manually</button></div></div>
    {(museOpen || (!all.length && !addOpen)) && <section className="mb-6 border-y border-board-line py-5" aria-labelledby="muse-outreach-heading"><h2 id="muse-outreach-heading" className="text-lg font-bold">Prepare company outreach</h2><p className="mt-2 max-w-prose text-sm leading-relaxed text-board-muted">{outreach.demo ? "Choose companies to preview prepared contacts and messages." : "Choose companies for Muse to research. It will save contacts and personal messages here on its next connected run."}</p><form onSubmit={requestOutreach} className="mt-4"><Field label="Companies"><textarea className={control} rows={2} value={companyText} onChange={e=>setCompanyText(e.target.value)} placeholder="e.g. Robinhood, Stripe" required maxLength={10000}/></Field><button className={`${primary} mt-3`} disabled={busy || !outreach.ready}>{busy ? "Saving request…" : outreach.demo ? "Preview drafts" : "Request outreach"}</button>{!outreach.signedIn && <p className="mt-3 text-sm text-board-muted">Sign in to save a request for Muse. You can still add contacts manually.</p>}</form></section>}
    {addOpen && <section className="mb-6 border-y border-board-line py-5"><h2 className="text-lg font-bold">Add an outreach contact</h2><form onSubmit={add} className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Company"><input className={control} name="company" defaultValue={company} required/></Field><Field label="Contact name"><input className={control} name="contact" required autoComplete="name"/></Field><Field label="LinkedIn profile (optional)"><input className={control} name="linkedin" type="url"/></Field><Field label="Target role (optional)"><input className={control} name="title"/></Field><div className="sm:col-span-2"><Field label="Message (optional)"><textarea className={control} name="message" rows={4} placeholder="Paste your message here, or add it later."/></Field></div><div className="flex items-end"><button className={primary}>Add contact</button></div></form></section>}
    <Notice>{feedback}</Notice>
    {outreach.demo && <p className="mb-5 text-sm text-board-muted">Fictional contacts and drafted messages. Edits stay in this demo; you send nothing here.</p>}
    {outreach.requests.some((r: { status: string })=>r.status==='Queued') && <section className="mb-6 border-b border-board-line pb-4" aria-label="Pending outreach"><h2 className="text-sm font-semibold">Waiting for Muse</h2><ul className="mt-2 space-y-2 text-sm text-board-muted">{outreach.requests.filter((r: { status: string })=>r.status==='Queued').map((r: { id: string; companies: string[] })=><li key={r.id}>{r.companies.join(", ")} — queued for the next connected run</li>)}</ul><button type="button" className={`${secondary} mt-3`} onClick={()=>outreach.refresh().catch(()=>setFeedback("Could not refresh outreach. Try again."))}>Refresh outreach</button></section>}

    {all.length ? <div className={`${profileStyles.contactGrid} ${selected ? profileStyles.contactSelected : ""}`}>
      <aside className={`glass-inset min-w-0 ${profileStyles.contactList}`}><Field label="Find a company or contact"><input type="search" className={control} value={query} onChange={e => setQuery(e.target.value)}/></Field><div className="mt-5 overflow-y-auto pr-1 lg:max-h-[60vh]">{groups.map(group => <section className="mb-6" key={group.key}><div className="mb-2 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><CompanyLogo company={group.company}/><h2 className="break-words text-sm font-bold">{group.company}</h2></div><span className="text-xs tabular-nums text-board-muted">{group.contacts.length}</span></div><ul className="space-y-1">{group.contacts.map(r => { const active = contact?.origin === r.origin && contact?.id === r.id; return <li key={`${r.origin}:${r.id}`}><button type="button" aria-pressed={active} onClick={() => setSelected(`${r.origin}:${r.id}`)} className={`flex min-h-16 w-full items-center gap-3 rounded-lg px-3 py-3 text-left ${active ? "bg-board-tag text-board-accent" : "text-board-muted hover:bg-board-panel hover:text-board-text"}`}><ContactIcon type={contactType(r)}/><span className="min-w-0"><span className="block break-words text-sm font-semibold">{r.contact || r.name}</span><span className="mt-1 block text-xs">{typeLabels[contactType(r)]} · {r.status || "Not asked"}</span>{r.title&&<span className="mt-1 block break-words text-xs text-board-muted">{r.title}</span>}</span></button></li>; })}</ul></section>)}{!groups.length && <p className="py-6 text-sm text-board-muted">No contacts match. Try another name.</p>}</div></aside>
      {contact ? <motion.div layout={!reducedMotion} transition={{ duration: .24, ease: [0.16, 1, 0.3, 1] }} ref={messageRef} className={`glass-panel min-w-0 scroll-mt-6 ${profileStyles.message}`}><button type="button" className={profileStyles.contactBack} onClick={() => setSelected(null)} aria-label="Back to referral contacts"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m15 18-6-6 6-6"/></svg>Back to contacts</button><MessageEditor key={`${contact.origin}:${contact.id}`} contact={contact} update={update} remove={remove}/></motion.div> : <p className="text-sm text-board-muted">Select a contact to prepare their message.</p>}
    </div> : null}
    <OutreachTemplates/>
    <Notice>{outreach.status}</Notice>

    <p className="mt-8 text-xs leading-relaxed text-board-muted">You send the final message on LinkedIn or email.</p>
  </ProfileSurface>;
}
