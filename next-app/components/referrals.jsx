"use client";
import { useEffect, useRef, useState } from "react";
import { useSlice } from "../lib/workspace";
import { Field, Heading, Notice, control, primary, secondary } from "./ui";
import { CONTACT_TYPES, OUTREACH_STATUSES, contactType, draftOutreach, groupContacts, importOutreach, museRequest, safeUrl } from "../../outreach-model.mjs";

const typeLabels = { recruiter: "Recruiter", engineer: "Engineer", senior: "Senior engineer", manager: "Hiring manager", alumni: "Alumni", other: "Other contact" };
function ContactIcon({ type }) {
  const paths = {
    recruiter: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 10-4"/><circle cx="17" cy="16" r="3"/><path d="m19 18 3 3"/></>,
    engineer: <><path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16"/></>,
    senior: <><path d="m3 13 9-9 9 9m-18 7 9-9 9 9"/></>,
    manager: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18m-9 0v4"/></>,
    alumni: <><path d="m2 8 10-5 10 5-10 5-10-5m4 2v7c4 4 8 4 12 0v-7m4-2v9"/></>,
    other: <><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></>,
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type] || paths.other}</svg>;
}
function MessageEditor({ contact, profile, update, remove }) {
  const [feedback, setFeedback] = useState("");
  const [editing, setEditing] = useState(!contact.message);
  const [channel, setChannel] = useState("linkedin");
  const kind = contactType(contact);
  const ready = !!contact.message?.trim() && !/\[[^\]]+\]/.test(contact.message);
  async function copy(value, label) {
    try { await navigator.clipboard.writeText(value); setFeedback(`${label} copied.`); }
    catch { setFeedback("Copy failed. Select the text below and copy it manually."); }
  }
  function generate() {
    const result = draftOutreach(contact, profile);
    if (result.missing.length) { setFeedback(`Add ${result.missing.join(", ").toLowerCase()} to prepare a complete message.`); setEditing(true); return; }
    update({ subject: result.subject, message: result.message });
    setFeedback("Draft prepared from your details. Review it before copying.");
  }
  const linkedin = safeUrl(contact.linkedin, true), link = safeUrl(contact.link);
  return <section className="min-w-0" aria-label={`Outreach for ${contact.contact || contact.name}`}>
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-board-line pb-5">
      <div className="flex min-w-0 items-center gap-3"><span className="text-board-accent"><ContactIcon type={kind}/></span><div className="min-w-0"><h2 className="break-words text-xl font-bold">{contact.contact || contact.name}</h2><p className="mt-1 text-sm text-board-muted">{typeLabels[kind]} at {contact.company}</p>{(contact.title || contact.role) && <p className="mt-2 text-sm text-board-muted">For {contact.title || contact.role}</p>}</div></div>
      <div className="flex flex-wrap gap-2">{linkedin && <a className={secondary} href={linkedin} target="_blank" rel="noreferrer">Open LinkedIn</a>}{link && <a className={secondary} href={link} target="_blank" rel="noreferrer">View role</a>}</div>
    </div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold">Your message</h3><label className="flex items-center gap-2 text-sm text-board-muted">Format<select className={control} value={channel} onChange={e => setChannel(e.target.value)}><option value="linkedin">LinkedIn</option><option value="email">Email</option></select></label></div>
    <p className="mt-2 text-sm text-board-muted">{ready ? "Ready to copy. Make any final edits here." : "Add your fit details or paste a finished draft from Muse."}</p>
    {channel === "email" && <div className="mt-4"><Field label="Subject"><input className={control} name="subject" value={contact.subject || ""} onChange={e => update({ subject: e.target.value })}/></Field></div>}
    <label className="mt-4 block"><span className="sr-only">Message for {contact.contact || contact.name}</span><textarea name="message" className={`${control} min-h-64 resize-y bg-board-panel leading-relaxed`} value={contact.message || ""} onChange={e => { update({ message: e.target.value }); setFeedback(""); }} placeholder="Your personalized message appears here."/></label>
    <div className="mt-4 flex flex-wrap gap-2"><button className={primary} type="button" disabled={!ready} onClick={() => copy(contact.message, "Message")}>Copy message</button>{channel === "email" && <button className={secondary} type="button" disabled={!contact.subject?.trim()} onClick={() => copy(contact.subject, "Subject")}>Copy subject</button>}<button className={secondary} type="button" onClick={generate}>{contact.message ? "Regenerate from details" : "Draft from details"}</button></div>
    <Notice>{feedback}</Notice>
    {contact.message && !ready && <Notice>Replace the bracketed placeholders before copying.</Notice>}
    <details className="mt-7 border-t border-board-line pt-5" open={editing} onToggle={e => setEditing(e.currentTarget.open)}><summary className="text-sm font-semibold">Contact &amp; fit details</summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Contact name"><input className={control} name="contact" autoComplete="name" value={contact.contact || contact.name || ""} onChange={e => update({ contact: e.target.value })}/></Field>
        <Field label="Company"><input className={control} name="company" value={contact.company || ""} onChange={e => update({ company: e.target.value })}/></Field>
        <Field label="Contact type"><select name="contactType" className={control} value={kind} onChange={e => update({ contactType: e.target.value })}>{CONTACT_TYPES.map(type => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></Field>
        <Field label="Target role"><input className={control} name="title" value={contact.title || contact.role || ""} onChange={e => update({ title: e.target.value })}/></Field>
        <Field label="LinkedIn profile"><input className={control} type="url" name="linkedin" value={contact.linkedin || ""} onChange={e => update({ linkedin: e.target.value })}/></Field>
        <Field label="Job link"><input className={control} type="url" name="link" value={contact.link || ""} onChange={e => update({ link: e.target.value })}/></Field>
        <Field label="Your relevant experience"><textarea className={control} rows={3} name="evidence" value={contact.evidence || ""} onChange={e => update({ evidence: e.target.value })} placeholder="One concrete achievement relevant to this role."/></Field>
        <Field label="Why this company or team"><textarea className={control} rows={3} name="reason" value={contact.reason || ""} onChange={e => update({ reason: e.target.value })} placeholder="The specific work that interests you."/></Field>
        <Field label="Shared connection (optional)"><input className={control} name="connection" value={contact.connection || ""} onChange={e => update({ connection: e.target.value })}/></Field>
        <Field label="Contact source (optional)"><input className={control} type="url" name="sourceUrl" value={contact.sourceUrl || ""} onChange={e => update({ sourceUrl: e.target.value })}/></Field>
        <Field label="Follow-up date"><input className={control} type="date" name="followUp" value={contact.followUp || contact.followup || ""} onChange={e => update({ followUp: e.target.value })}/></Field>
        <Field label="Notes"><input className={control} name="notes" value={contact.notes || ""} onChange={e => update({ notes: e.target.value })}/></Field>
      </div>
    </details>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-board-line pt-5"><label className="flex flex-wrap items-center gap-2 text-sm text-board-muted">Outreach status<select className={control} value={contact.status || "Not asked"} onChange={e => update({ status: e.target.value })}>{OUTREACH_STATUSES.map(status => <option key={status}>{status}</option>)}</select></label><button className="min-h-11 px-3 text-sm text-board-muted hover:text-board-text" type="button" onClick={remove}>Remove contact</button></div>
    <p className="mt-3 text-xs text-board-muted">Update the status after you send. Copying a message doesn’t mark it sent.</p>
  </section>;
}
export default function Referrals() {
  const [targets, setTargets] = useSlice("network.referrals");
  const [people, setPeople] = useSlice("network.people");
  const [profile] = useSlice("workflow.profile");
  const [selected, setSelected] = useState(null);
  const messageRef = useRef(null);
  useEffect(() => {
    if (selected && window.matchMedia("(max-width: 1023px)").matches) messageRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [selected]);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [museOpen, setMuseOpen] = useState(false);
  const [json, setJson] = useState("");
  const [feedback, setFeedback] = useState("");
  const all = [...(targets || []).map(r => ({ ...r, origin: "target" })), ...(people || []).map(r => ({ ...r, origin: "person" }))];
  const groups = groupContacts(all.filter(r => `${r.company} ${r.contact || r.name} ${r.title || r.role || ""}`.toLowerCase().includes(query.toLowerCase())));
  const contact = all.find(r => `${r.origin}:${r.id}` === selected) || groups[0]?.contacts[0];
  function update(fields) {
    const rows = contact.origin === "person" ? people : targets;
    const setter = contact.origin === "person" ? setPeople : setTargets;
    setter(rows.map(r => r.id === contact.id ? { ...r, ...fields } : r));
  }
  function remove() {
    if (contact.origin === "person") setPeople(people.filter(r => r.id !== contact.id));
    else setTargets(targets.filter(r => r.id !== contact.id));
    setSelected(null);
  }
  function add(e) {
    e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget));
    if (!data.company.trim() || !data.contact.trim()) return;
    if (data.linkedin && !safeUrl(data.linkedin, true)) { setFeedback("Use a LinkedIn profile URL such as https://www.linkedin.com/in/name/."); return; }
    const id = crypto.randomUUID(); setTargets([...(targets || []), { ...data, id, status: "Not asked", source: "Manual" }]);
    setSelected(`target:${id}`); setAddOpen(false); setFeedback("");
  }
  async function copyRequest() {
    try { await navigator.clipboard.writeText(museRequest(groupContacts(all).map(g => g.company), profile)); setFeedback("Request copied. Paste it into Muse, then import the contacts it prepares."); }
    catch { setFeedback("Copy failed. Select the request below and copy it manually."); }
  }
  function importContacts(e) {
    e.preventDefault();
    try { const next = importOutreach(json, targets || [], () => crypto.randomUUID()); setTargets(next); setJson(""); setFeedback("Muse contacts imported. Select a contact to review and copy their message."); }
    catch (error) { setFeedback(error.message); }
  }
  return <>
    <div className="flex flex-wrap items-start justify-between gap-4"><Heading title="Referrals">Find the right person. Give them a reason to reply. Keep each company’s contacts and messages together.</Heading><div className="flex flex-wrap gap-2"><button type="button" className={primary} aria-expanded={museOpen} onClick={() => { setMuseOpen(!museOpen); setAddOpen(false); setFeedback(""); }}>Prepare with Muse</button><button type="button" className={secondary} aria-expanded={addOpen} onClick={() => { setAddOpen(!addOpen); setMuseOpen(false); setFeedback(""); }}>Add manually</button></div></div>
    {museOpen && <section className="mb-6 border-y border-board-line py-5" aria-labelledby="muse-outreach-heading"><h2 id="muse-outreach-heading" className="text-lg font-bold">Let Muse prepare your outreach</h2><p className="mt-2 max-w-prose text-sm leading-relaxed text-board-muted">Ask Muse to research contacts and write each message. It can fill this page through browser access, or return contacts for import below.</p><label className="mt-4 block"><span className="mb-2 block text-sm text-board-muted">Request for Muse</span><textarea readOnly className={`${control} min-h-32`} value={museRequest(groupContacts(all).map(g => g.company), profile)}/></label><button type="button" className={`${secondary} mt-3`} onClick={copyRequest}>Copy request for Muse</button><form className="mt-5" onSubmit={importContacts}><Field label="Contacts prepared by Muse"><textarea className={`${control} min-h-28`} value={json} onChange={e => setJson(e.target.value)} placeholder="Paste Muse’s JSON response here." required/></Field><button className={`${primary} mt-3`}>Import contacts &amp; messages</button></form></section>}
    {addOpen && <section className="mb-6 border-y border-board-line py-5"><h2 className="text-lg font-bold">Add an outreach contact</h2><form onSubmit={add} className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Company"><input className={control} name="company" required/></Field><Field label="Contact name"><input className={control} name="contact" required autoComplete="name"/></Field><Field label="Contact type"><select className={control} name="contactType">{CONTACT_TYPES.map(type => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></Field><Field label="Target role"><input className={control} name="title"/></Field><Field label="LinkedIn profile"><input className={control} name="linkedin" type="url"/></Field><div className="flex items-end"><button className={primary}>Add contact</button></div></form></section>}
    <Notice>{feedback}</Notice>
    {all.length ? <div className="mt-5 grid gap-7 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="min-w-0 lg:border-r lg:border-board-line lg:pr-6"><Field label="Find a company or contact"><input type="search" className={control} value={query} onChange={e => setQuery(e.target.value)}/></Field><div className="mt-5 max-h-[60vh] overflow-y-auto pr-1">{groups.map(group => <section className="mb-6" key={group.key}><div className="mb-2 flex items-center justify-between gap-3"><h2 className="break-words text-sm font-bold">{group.company}</h2><span className="text-xs tabular-nums text-board-muted">{group.contacts.length}</span></div><ul className="space-y-1">{group.contacts.map(r => { const active = contact?.origin === r.origin && contact?.id === r.id; return <li key={`${r.origin}:${r.id}`}><button type="button" aria-pressed={active} onClick={() => setSelected(`${r.origin}:${r.id}`)} className={`flex min-h-16 w-full items-center gap-3 rounded-lg px-3 py-3 text-left ${active ? "bg-board-tag text-board-accent" : "text-board-muted hover:bg-board-panel hover:text-board-text"}`}><ContactIcon type={contactType(r)}/><span className="min-w-0"><span className="block break-words text-sm font-semibold">{r.contact || r.name}</span><span className="mt-1 block text-xs">{typeLabels[contactType(r)]} · {r.status || "Not asked"}</span></span></button></li>; })}</ul></section>)}{!groups.length && <p className="py-6 text-sm text-board-muted">No contacts match. Try another name.</p>}</div></aside>
      {contact ? <div ref={messageRef} className="min-w-0 scroll-mt-6"><MessageEditor key={`${contact.origin}:${contact.id}`} contact={contact} profile={profile} update={update} remove={remove}/></div> : <p className="text-sm text-board-muted">Select a contact to prepare their message.</p>}
    </div> : <section className="mt-6 border-y border-board-line py-12"><h2 className="text-xl font-bold">Start with a company you want to join</h2><p className="mt-3 max-w-lg text-sm leading-relaxed text-board-muted">Let Muse find the right contacts and draft a personal message, or add someone you already know. Each contact gets their own LinkedIn link and message.</p><div className="mt-6 flex flex-wrap gap-3"><button type="button" className={primary} onClick={() => { setMuseOpen(true); setAddOpen(false); }}>Prepare with Muse</button><button type="button" className={secondary} onClick={() => { setAddOpen(true); setMuseOpen(false); }}>Add manually</button></div></section>}
    <p className="mt-8 text-xs leading-relaxed text-board-muted">Contacts and drafts are saved in this browser. Messages are sent by you on LinkedIn or email.</p>
  </>;
}
