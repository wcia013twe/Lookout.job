"use client";
import {useState, type FormEvent} from "react";
import {Field, control, primary} from "../../../components/ui";

export default function CircleEntry({busy, demo, submit}: {
  busy: boolean; demo: boolean;
  submit: (event: FormEvent<HTMLFormElement>, join: boolean) => Promise<void>;
}) {
  const [join, setJoin] = useState(true);
  return <section aria-labelledby="circle-entry-title" className="my-4 max-w-lg rounded-2xl bg-board-panel p-5 sm:p-7">
    <h2 id="circle-entry-title" className="text-xl font-semibold tracking-tight">{join ? "Join a Circle" : "Create a Circle"}</h2>
    <p id="circle-entry-description" className="mt-2 text-sm leading-6 text-board-muted">{join ? "Enter the invite code shared with you." : "Bring your people together in a private Circle."}</p>
    <form aria-labelledby="circle-entry-title" aria-describedby="circle-entry-description" onSubmit={event => void submit(event, join)} className="mt-6 space-y-4">
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        {join ? <Field label="Invite code"><input key="invite" name="token" className={`${control} font-mono`} required maxLength={100} placeholder={demo ? "demo-invite" : "Paste your invite code"} autoCapitalize="none" autoCorrect="off" spellCheck={false}/></Field>
          : <Field label="Circle name"><input key="circle-name" name="name" className={control} required maxLength={100} placeholder="Give your Circle a name"/></Field>}
        <Field label="Your name"><input name="alias" className={control} required maxLength={80} autoComplete="nickname" placeholder="What your people call you" aria-describedby="circle-alias-help"/></Field>
        <p id="circle-alias-help" className="text-xs leading-5 text-board-muted">This is how you’ll appear in this Circle.</p>
        <button className={`${primary} w-full gap-2`} disabled={busy}>
          {busy ? (join ? "Joining…" : "Creating…") : (join ? "Join Circle" : "Create private Circle")}
          {!busy && <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>}
        </button>
      </fieldset>
    </form>
    <div className="mt-5 flex flex-wrap items-center gap-x-1 border-t border-board-line pt-3 text-sm">
      <span className="text-board-muted">{join ? "Starting your own?" : "Already have an invite?"}</span>
      <button type="button" disabled={busy} onClick={() => setJoin(value => !value)} className="min-h-11 rounded-md px-1 font-semibold text-board-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-board-accent disabled:opacity-50">{join ? "Create a Circle" : "Join a Circle"}</button>
    </div>
  </section>;
}
