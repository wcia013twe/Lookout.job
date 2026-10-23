"use client";
import { useRef, useState, type ReactNode } from "react";
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
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [connections, setConnections] = useState<AgentConnection[]>();
  return <div id="pack-setup" className="scroll-mt-6">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4">
      <div className="flex items-center gap-1"><h2 className="text-xl font-semibold">My Agent</h2><InfoPopover label="My Agent">Connect your agent, define a search, and choose a pack for its results.</InfoPopover></div>
      <Link className="inline-flex min-h-11 shrink-0 items-center text-sm text-board-muted underline underline-offset-4" href={w.demo?"/discover/?demo=1":"/discover/"}>Back to Discover</Link>
    </div>
    <div role="tablist" aria-label="Agent settings" className="mb-5 flex gap-x-5 overflow-x-auto border-b border-board-line">
      {sections.map(([id,label],index)=><button key={id} ref={node=>{tabs.current[index]=node;}} id={`agent-tab-${id}`} type="button" role="tab" aria-selected={active===id} tabIndex={active===id?0:-1} aria-controls={`agent-panel-${id}`} onClick={()=>setActive(id)}
        onKeyDown={event=>{
          const next=event.key==='Home'?0:event.key==='End'?sections.length-1:event.key==='ArrowRight'?(index+1)%sections.length:event.key==='ArrowLeft'?(index+sections.length-1)%sections.length:null;
          if(next===null)return;
          event.preventDefault();setActive(sections[next][0]);tabs.current[next]?.focus();
        }}
        className={`min-h-11 shrink-0 whitespace-nowrap border-b-2 px-1 text-sm font-semibold transition-colors hover:text-board-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-board-accent ${active===id?"border-board-accent text-board-text":"border-transparent text-board-muted"}`}>{label}</button>)}
    </div>
    <div role="tabpanel" aria-labelledby="agent-tab-packs" tabIndex={0} id="agent-panel-packs" hidden={active!=="packs"}><CardPackWidgets configure connections={connections} onEditSearch={()=>setActive("search")}/></div>
    <div className="[&>.workspace-section]:mt-0 [&>.workspace-section]:border-t-0 [&>.workspace-section]:pt-0" role="tabpanel" aria-labelledby="agent-tab-search" tabIndex={0} id="agent-panel-search" hidden={active!=="search"}><DailySchedule connections={connections}/></div>
    <div className="[&>.workspace-section]:mt-0 [&>.workspace-section]:border-t-0 [&>.workspace-section]:pt-0" role="tabpanel" aria-labelledby="agent-tab-sources" tabIndex={0} id="agent-panel-sources" hidden={active!=="sources"}><SearchTargets/></div>
    <div className="[&>.workspace-section]:mt-0 [&>.workspace-section]:border-t-0 [&>.workspace-section]:pt-0" role="tabpanel" aria-labelledby="agent-tab-connections" tabIndex={0} id="agent-panel-connections" hidden={active!=="connections"}><AgentConnections onConnectionsChange={setConnections}/></div>
    <div role="tabpanel" aria-labelledby="agent-tab-other" tabIndex={0} id="agent-panel-other" hidden={active!=="other"}>{children}</div>
  </div>;
}
