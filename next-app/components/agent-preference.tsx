"use client";
import {useEffect} from "react";
import {useWorkspace} from "../lib/workspace";
import {agentOptions,readAgentSelection,saveAgentSelection} from "../../lib/agent-selection.mjs";
import {Section,Field,control} from "./ui";
export default function AgentPreference(){
 const w=useWorkspace();
 const selection=readAgentSelection(w.state.workflow.searchPreferences,w.state.workflow.profile);
 useEffect(()=>{const profile=w.store.get("workflow.profile");if(["setupAgent","setupAgentProvider","setupAgentName"].some(key=>key in profile)){const saved=readAgentSelection(w.store.get("workflow.searchPreferences"),profile);saveAgentSelection(w.store,saved.provider,saved.name);}},[w.store]);
 return <Section title="Your agent"><Field label="Selected agent"><select className={control} disabled={w.locked} value={selection.provider} onChange={e=>{const option=agentOptions.find(agent=>agent.id===e.target.value)!;saveAgentSelection(w.store,option.id,option.name);}}>{agentOptions.map(agent=><option key={agent.id} value={agent.id}>{agent.name}{agent.id==="platform"?" (coming soon)":""}</option>)}</select></Field>
 {selection.provider==="custom"&&<Field label="Agent name"><input className={control} maxLength={100} disabled={w.locked} value={selection.name} onChange={e=>saveAgentSelection(w.store,"custom",e.target.value)}/></Field>}
 <p className="mt-3 text-sm text-board-muted">{w.demo?"Changes stay in this fictional preview.":w.syncError?"Agent choice is saved in this browser. Account sync needs attention.":w.state.workflow.cloudDirty?"Saving your agent choice to your account…":w.user?"Your choice syncs with setup and your account.":"Saved in this browser. Sign in to sync your choice."} Choose and manage connector access below; selecting an agent does not confirm a connection.</p>
 </Section>;
}
