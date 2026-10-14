"use client";
import { useState } from "react";
import { secondary } from "./ui";
const characters = [
  { id: "dot", name: "Dot", company: "OpenAI", image: "dot.png" },
  { id: "grok", name: "Grok Bot", company: "xAI", image: "grok.png" },
  { id: "muse", name: "Muse", company: "Meta", image: "muse.png" },
];
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
export default function AgentSelector({ agent, provider, onSelect }) {
  const [moving, setMoving] = useState(true);
  const selected = agent === "platform" ? "platform" : provider;
  const character = characters.find((c) => c.id === selected);
  return (
    <fieldset className="mb-5">
      <legend className="sr-only">Choose your companion</legend>
      <div className="grid items-center gap-5 md:grid-cols-[1.4fr_1fr] md:gap-10">
        <div className="setup-stage relative grid min-h-56 place-items-center overflow-hidden rounded-2xl bg-black sm:min-h-72 md:min-h-96">
          {character ? <img key={character.id} src={`${base}/agents/${character.image}`} alt={`${character.name} character reference`} width="640" height="360" className={`setup-portrait h-56 w-full object-contain sm:h-72 md:h-96 ${moving ? "agent-idle" : ""}`} /> :
            <div className="px-8 py-12 text-center"><p className="text-3xl font-semibold tracking-tight sm:text-5xl">{selected === "custom" ? "Your own assistant." : "A little help.\nA better search."}</p><p className="mx-auto mt-5 max-w-xs text-sm leading-relaxed text-board-muted">{selected === "custom" ? "Give your agent a name below." : "Choose a familiar companion, or start with the platform’s suggestions."}</p></div>}
          {character && <span className="absolute bottom-3 left-4 text-xs text-board-muted">{character.company} · {character.name}</span>}
        </div>
        <div>
          <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-board-muted">Who’s joining your search?</p><button type="button" className={secondary} aria-pressed={!moving} onClick={() => setMoving(!moving)}>{moving ? "Pause motion" : "Resume motion"}</button></div>
          <div className="grid grid-cols-3 gap-2">
            {characters.map((c) => <label key={c.id} className={`cursor-pointer rounded-xl border p-3 text-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-board-accent ${selected === c.id ? "border-board-accent bg-board-tag" : "border-board-line hover:border-board-muted"}`}>
              <input aria-label={c.name} type="radio" name="agent-character" value={c.id} checked={selected === c.id} onChange={() => onSelect(c.id,c.name)} className="sr-only" />
              <img src={`${base}/agents/${c.image}`} alt="" width="128" height="80" className="mb-3 h-16 w-full object-contain" />
              <strong className="block text-sm">{c.name}</strong><span className="mt-1 block text-xs text-board-muted">{selected === c.id ? "Selected" : c.company}</span>
            </label>)}
          </div>
          <div className="mt-3 space-y-2">
            {[["platform","Use platform suggestions","Start with guided recommendations."],["custom","Another agent","Bring an assistant you already use."]].map(([id,title,description]) => <label key={id} className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border p-4 ${selected === id ? "border-board-accent bg-board-tag" : "border-board-line"}`}><input type="radio" name="agent-character" value={id} checked={selected === id} onChange={() => onSelect(id,"")} className="h-4 w-4 shrink-0 accent-board-accent" /><span><strong className="block text-sm">{title}</strong><span className="mt-1 block text-xs text-board-muted">{description}</span></span></label>)}
          </div>
        </div>
      </div>
    </fieldset>
  );
}
