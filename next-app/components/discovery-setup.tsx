"use client";
import { useState, type ReactNode } from "react";
import AgentConnections, { type AgentConnection } from "./agent-connections";
import SearchTargets from "./search-targets";
import DailySchedule from "./daily-schedule";
import CardPackWidgets from "./card-pack-widgets";
import Link from "next/link";
import InfoPopover from "./info-popover";
import { useWorkspace } from "../lib/workspace";

export default function DiscoverySetup({children}:{children?:ReactNode}) {
  const w = useWorkspace();
  const [connections, setConnections] = useState<AgentConnection[]>();
  return <div id="pack-setup" className="agent-settings-boxes space-y-6 scroll-mt-6">
    <div className="mb-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-1"><h2 className="text-xl font-semibold">My Agent</h2><InfoPopover label="My Agent">Connect your agent, define a search, and choose a pack for its results.</InfoPopover></div>
      <Link className="inline-flex min-h-11 shrink-0 items-center text-sm text-board-muted underline underline-offset-4" href={w.demo?"/discover/?demo=1":"/discover/"}>Back to Discover</Link>
    </div>
    <div className="agent-settings-box" id="agent-panel-packs"><CardPackWidgets configure connections={connections} onEditSearch={()=>document.getElementById("agent-panel-search")?.scrollIntoView({behavior:"instant",block:"start"})}/></div>
    <div className="agent-settings-box scroll-mt-6" id="agent-panel-search"><DailySchedule connections={connections}/></div>
    <div className="agent-settings-box" id="agent-panel-sources"><SearchTargets/></div>
    <div className="agent-settings-box" id="agent-panel-connections"><AgentConnections onConnectionsChange={setConnections}/></div>
    <div className="agent-settings-other" id="agent-panel-other">{children}</div>
  </div>;
}
