"use client";
import { useEffect, useRef, useState } from "react";
// Add an animation URL to a character when its final media is supplied.
// Existing static references remain the poster/fallback; no motion is enabled yet.
const characters = [
  { id: "dot", name: "Dot", company: "OpenAI", image: "dot.png", animation: null },
  { id: "grok", name: "Grok Bot", company: "xAI", image: "grok.png", animation: null },
  { id: "muse", name: "Muse", company: "Meta", image: "muse.png", animation: null },
  { id: "platform", name: "Cappy", company: "Platform agent", image: null, animation: null },
];
const invitedAgents = [{ id: "hermes", name: "Hermes", company: "Your own agent" }, { id: "openclaw", name: "OpenClaw", company: "Your own agent" }];
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
export default function AgentSelector({ agent, provider, onSelect, joinedOnce }) {
  const selected = agent === "platform" ? "platform" : provider;
  const character = [...characters, ...invitedAgents].find((c) => c.id === selected);
  const waitingRoom = useRef(null);
  const hasJoined = joinedOnce;
  const joiningTimer = useRef(null);
  const [joining, setJoining] = useState(null);
  useEffect(() => () => clearTimeout(joiningTimer.current), []);
  function choose(c) {
    clearTimeout(joiningTimer.current);
    if (!hasJoined.current) {
      hasJoined.current = true;
      setJoining(c.name);
      onSelect(c.id, c.name);
      joiningTimer.current = setTimeout(() => {
        setJoining(null);
      }, 450);
    } else {
      setJoining(null);
      onSelect(c.id, c.name);
    }
  }
  return (
    <fieldset className="mb-5">
      <legend className="sr-only">Choose your companion</legend>
      <div className="call-room">
        <div className="call-room-bar"><span>Your search, with company</span><span className="text-board-muted">Setup room</span></div>
        <div className="call-layout"><div className="call-focus">
        <section aria-label="Selected agent preview" className="call-speaker">
          {joining ? <div className="px-6 text-center"><p className="text-2xl font-semibold">{joining} is joining…</p></div> : character?.image ? <img src={`${base}/agents/${character.image}`} alt={`${character.name} character reference`} width="640" height="360" className="call-speaker-media" /> : character ? <div className="text-center"><div className="mx-auto grid h-24 w-24 place-items-center rounded-2xl bg-board-tag text-4xl font-bold">{character.name.slice(0,1)}</div><h2 className="mt-4 text-2xl font-semibold">{character.name}</h2></div> : <div className="px-6 text-center"><h2 className="text-2xl font-semibold sm:text-4xl">{selected === "custom" ? "There’s room for your agent." : "Who’s joining you?"}</h2><p className="mt-3 text-sm text-board-muted">Pick a familiar face in the participant list, or choose Cappy.</p></div>}
          {character && <span className="agent-call-indicators" aria-label="Agent camera on, microphone muted"><svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="12" height="12" rx="2"/><path d="m15 10 6-4v12l-6-4"/></svg><svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8m-5-19 18 18"/></svg></span>}
          <div className="call-nameplate">{joining || character?.name || (selected === "custom" ? "Your agent" : "You’re here")}</div>
        </section>
        <div role="status" className="call-notice">{joining ? `${joining} is joining…` : character ? `${character.name} joined your setup room.` : "Choose a companion to join your setup."}<span className="ml-2 text-board-muted">Preview only</span></div>
        </div>
        <aside aria-label="Choose an agent" tabIndex={0} className="call-sidebar">
          <h2 className="mb-3 text-sm font-semibold">Agents <span className="text-board-muted">({characters.length + (invitedAgents.some(c => c.id === selected) ? 1 : 0)})</span></h2>
          <div className="call-participants">
          {[...characters, ...invitedAgents.filter(c => c.id === selected)].map((c) => <label key={c.id} className="call-participant cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-board-accent">
            <input aria-label={c.name} type="radio" name="agent-character" value={c.id} checked={selected === c.id} onChange={() => choose(c)} className="sr-only" />
            <span className="agent-call-indicators" aria-label="Agent camera on, microphone muted"><svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="12" height="12" rx="2"/><path d="m15 10 6-4v12l-6-4"/></svg><svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8m-5-19 18 18"/></svg></span>
            {c.image ? <img src={`${base}/agents/${c.image}`} alt="" width="200" height="112" className="call-participant-media" /> : <div className="call-participant-media grid place-items-center text-3xl font-bold">{c.name.slice(0,1)}</div>}
            <div className="flex flex-wrap items-center justify-between gap-1 px-2 py-2"><strong className="text-xs sm:text-sm">{c.name}</strong><span className="text-xs">{selected === c.id ? "Focused" : c.company}</span></div>
          </label>)}
          </div>
        </aside>
        </div>

      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button type="button" className="min-h-20 rounded-xl border border-board-line bg-board-panel p-4 text-left hover:border-board-accent" onClick={() => waitingRoom.current.showModal()}><strong className="block text-sm">Invite your own agent</strong><span className="mt-1 block text-xs text-board-muted">Open the waiting room.</span></button>
      </div>
      <dialog ref={waitingRoom} className="agent-waiting-room">
        <div className="flex items-center justify-between gap-4"><h2 className="text-2xl font-semibold">Waiting room</h2><button type="button" className="min-h-11 rounded-lg border border-board-line px-4 text-sm" onClick={() => waitingRoom.current.close()}>Close</button></div>
        <p className="mt-3 text-sm leading-relaxed text-board-muted">Choose who to invite into your setup. Connect your agent from Profile after setup.</p>
        <div className="mt-6 space-y-3">{invitedAgents.map(c => <div key={c.id} className="flex items-center gap-3 rounded-xl border border-board-line p-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-board-tag text-xl font-bold" aria-hidden="true">{c.name.slice(0,1)}</span><div className="flex-1"><h3 className="font-semibold">{c.name}</h3><p className="mt-1 text-xs text-board-muted">Your own agent</p></div><button type="button" className="min-h-11 rounded-lg bg-board-accent px-4 text-sm font-semibold text-board-ink" aria-label={`Invite ${c.name}`} onClick={() => { choose(c); waitingRoom.current.close(); }}>Invite</button></div>)}</div>
        <button type="button" className="mt-5 min-h-11 text-sm underline underline-offset-4" onClick={() => { clearTimeout(joiningTimer.current); setJoining(null); onSelect("custom", ""); waitingRoom.current.close(); }}>Use a different agent</button>
        <p className="mt-3 text-xs text-board-muted">Setup preview · inviting does not create an agent connection.</p>
      </dialog>
    </fieldset>
  );
}
