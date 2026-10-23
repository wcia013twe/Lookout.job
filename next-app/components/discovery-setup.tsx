"use client";
import { useState, type ReactNode } from "react";
import AgentConnections, { type AgentConnection } from "./agent-connections";
import SearchTargets from "./search-targets";
import DailySchedule from "./daily-schedule";
import CardPackWidgets from "./card-pack-widgets";
import Link from "next/link";
import InfoPopover from "./info-popover";
import { useWorkspace } from "../lib/workspace";

const sections = [["packs","Packs"],["search","Search"],["sources","Sources"],["connections","Connections"],["other","Other settings"]] as const;
type SetupSection = typeof sections[number][0];

export default function DiscoverySetup({children}:{children?:ReactNode}) {
  const w = useWorkspace();
  const [active,setActive]=useState<SetupSection>("packs");
  const [connections, setConnections] = useState<AgentConnection[]>();
  return <div id="pack-setup" className="agent-settings-boxes scroll-mt-6">
    <div className="mb-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-1"><h2 className="text-xl font-semibold">My Agent</h2><InfoPopover label="My Agent">Connect your agent, define a search, and choose a pack for its results.</InfoPopover></div>
      <Link className="inline-flex min-h-11 shrink-0 items-center text-sm text-board-muted underline underline-offset-4" href={w.demo?"/discover/?demo=1":"/discover/"}>Back to Discover</Link>
    </div>
    <nav aria-label="Agent settings" className="mb-5 flex flex-wrap gap-x-5 border-b border-board-line">
      {sections.map(([id,label])=><button key={id} type="button" aria-pressed={active===id} aria-controls={`agent-panel-${id}`} onClick={()=>setActive(id)}
        className={`min-h-11 border-b-2 px-1 text-sm font-semibold transition-colors hover:text-board-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-board-accent ${active===id?"border-board-accent text-board-text":"border-transparent text-board-muted"}`}>{label}</button>)}
    </nav>
    <div className="agent-settings-box" id="agent-panel-packs" hidden={active!=="packs"}><CardPackWidgets configure connections={connections} onEditSearch={()=>setActive("search")}/></div>
    <div className="agent-settings-box" id="agent-panel-search" hidden={active!=="search"}><DailySchedule connections={connections}/></div>
    <div className="agent-settings-box" id="agent-panel-sources" hidden={active!=="sources"}><SearchTargets/></div>
    <div className="agent-settings-box" id="agent-panel-connections" hidden={active!=="connections"}><AgentConnections onConnectionsChange={setConnections}/></div>
    <div className="agent-settings-other" id="agent-panel-other" hidden={active!=="other"}>{children}</div>
  </div>;
}
