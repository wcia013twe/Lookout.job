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
  return (
    <fieldset className="mb-6">
      <legend className="mb-3 text-lg font-semibold">Choose your companion</legend>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-board-muted">Already have an agent? Pick yours below.</p>
        <button type="button" className={secondary} aria-pressed={!moving} onClick={() => setMoving(!moving)}>{moving ? "Pause motion" : "Resume motion"}</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {characters.map((character) => (
          <label key={character.id} className={`group relative cursor-pointer overflow-hidden rounded-2xl border bg-board-panel transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-board-accent ${selected === character.id ? "border-board-accent" : "border-board-line hover:border-board-muted"}`}>
            <input type="radio" name="agent-character" value={character.id} checked={selected === character.id} onChange={() => onSelect(character.id, character.name)} className="absolute right-4 top-4 z-10 h-5 w-5 accent-board-accent" />
            <div className="flex items-center gap-4 p-4 sm:block sm:p-5">
              <div className="grid h-28 w-32 shrink-0 place-items-center overflow-hidden rounded-xl bg-black sm:h-44 sm:w-full">
                {/* User supplied character references; motion animates the intact image. */}
                <img src={`${base}/agents/${character.image}`} alt="" width="384" height="216" className={`h-full w-full object-contain ${moving ? "agent-idle" : ""}`} />
              </div>
              <div className="pr-4 sm:mt-5 sm:pr-0">
                <span className="text-xs tracking-wide text-board-muted">{character.company}</span>
                <strong className="mt-1 block text-xl">{character.name}</strong>
                <span className="mt-2 block text-sm text-board-muted">{selected === character.id ? "Selected companion" : "Use my own agent"}</span>
              </div>
            </div>
          </label>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[["platform", "Use platform suggestions", "Start with guided recommendations."], ["custom", "Another agent", "Bring an assistant you already use."]].map(([id, title, description]) => (
          <label key={id} className={`flex min-h-24 cursor-pointer items-center gap-3 rounded-xl border bg-board-panel p-4 ${selected === id ? "border-board-accent" : "border-board-line"}`}>
            <input type="radio" name="agent-character" value={id} checked={selected === id} onChange={() => onSelect(id, "")} className="h-5 w-5 shrink-0 accent-board-accent" />
            <span><strong className="block text-sm">{title}</strong><span className="mt-1 block text-sm text-board-muted">{description}</span></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
