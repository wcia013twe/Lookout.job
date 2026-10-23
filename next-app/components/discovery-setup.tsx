"use client";
import { useState } from "react";
import AgentConnections, { type AgentConnection } from "./agent-connections";
import SearchTargets from "./search-targets";
import DailySchedule from "./daily-schedule";
import CardPackWidgets from "./card-pack-widgets";
import Link from "next/link";
import { useWorkspace } from "../lib/workspace";

export default function DiscoverySetup() {
  const w = useWorkspace();
  const [connections, setConnections] = useState<AgentConnection[]>();
  const steps = [
    ["discovery-connection", "Connect your agent", "Give your personal agent access to publish discoveries.", <AgentConnections key="connections" onConnectionsChange={setConnections}/>],
    ["discovery-sources", "Choose sources", "Add the job boards, careers pages and accounts to check.", <SearchTargets key="sources"/>],
    ["discovery-tasks", "Set the search", "Tell your agent what to find and when to look.", <DailySchedule key="tasks" connections={connections}/>],
  ] as const;
  return <div id="pack-setup" className="scroll-mt-6">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-prose">
        <h2 className="text-xl font-semibold">Your discovery setup</h2>
        <p className="mt-2 text-sm leading-relaxed text-board-muted">Connect an agent, choose its search, and collect the results in a card pack. Everything is managed here.</p>
      </div>
      <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-board-accent underline underline-offset-4" href={w.demo?"/discover/?demo=1":"/discover/"}>Back to Discover</Link>
    </div>
    <div className="divide-y divide-board-line border-y border-board-line">
      {steps.map(([id,title,description,content])=><details key={id} id={id} className="scroll-mt-6 py-2">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">
          {title}<span className="mt-1 block pl-4 text-sm font-normal leading-relaxed text-board-muted">{description}</span>
        </summary>
        <div className="pb-6">{content}</div>
      </details>)}
    </div>
    <CardPackWidgets configure/>
  </div>;
}
