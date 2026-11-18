"use client";
import {useState, type FormEvent} from "react";
import {Field, control, primary} from "../../../components/ui";

export default function CircleEntry({busy, demo, invite, submit}: {
  busy: boolean; demo: boolean; invite: string;
  submit: (event: FormEvent<HTMLFormElement>, join: boolean) => Promise<void>;
}) {
  const [join, setJoin] = useState(true);
  return <section aria-labelledby="circle-entry-title" className="my-4 max-w-xl overflow-hidden rounded-2xl bg-board-panel">
    <div className="px-5 pt-6 sm:px-8 sm:pt-8">
      <div aria-hidden="true" className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-board-tag text-board-accent">
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3.5 19v-1.2a5.5 5.5 0 0 1 11 0V19M17 7v6m-3-3h6"/></svg>
      </div>
      <h2 id="circle-entry-title" className="text-2xl font-semibold tracking-tight">{join ? "Join a Circle" : "Create a Circle"}</h2>
      <form aria-labelledby="circle-entry-title" onSubmit={event => void submit(event, join)} className="mt-7">
        <fieldset disabled={busy} className="min-w-0 space-y-5">
          {join ? <Field label="Invite code"><input key={`invite-${invite}`} name="token" defaultValue={invite} className={`${control} font-mono tracking-wide`} required maxLength={100} placeholder={demo ? "demo-invite" : "Paste your invite code"} autoCapitalize="none" autoCorrect="off" spellCheck={false}/></Field>
            : <Field label="Circle name"><input key="circle-name" name="name" className={control} required maxLength={100} placeholder="Give your Circle a name"/></Field>}
          <div><Field label="Your name"><input name="alias" className={control} required maxLength={80} autoComplete="nickname" placeholder="What your people call you" aria-describedby="circle-alias-help"/></Field>
          <p id="circle-alias-help" className="mt-2 text-xs leading-5 text-board-muted">This is how you’ll appear in this Circle.</p></div>
          <button className={`${primary} w-full gap-2`} disabled={busy}>
            {busy ? (join ? "Joining…" : "Creating…") : (join ? "Join Circle" : "Create private Circle")}
            {!busy && <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>}
          </button>
        </fieldset>
      </form>
    </div>
    <div className="mt-7 flex flex-wrap items-center gap-x-2 border-t border-board-line px-5 py-3 text-sm sm:px-8">
      <span className="text-board-muted">{join ? "Starting your own?" : "Already have an invite?"}</span>
      <button type="button" disabled={busy} onClick={() => setJoin(value => !value)} className="min-h-11 rounded-md font-semibold text-board-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-board-accent disabled:opacity-50">{join ? "Create a Circle" : "Join a Circle"}</button>
    </div>
  </section>;
}
