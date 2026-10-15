"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import AgentSelector from "./agent-selector";
import AgentFirstSetup from "./agent-first-setup";
import { useWorkspace } from "../lib/workspace";
import { Heading, primary, secondary, control, Field, Notice } from "./ui";
export default function Onboarding() {
 const w=useWorkspace(),profile=w.state.workflow.profile;
 const joinedOnce=useRef(false);
 const [started,setStarted]=useState(false),[agent,setAgent]=useState(profile.setupAgent||"platform"),[provider,setProvider]=useState(profile.setupAgentProvider||"platform"),[agentName,setAgentName]=useState(profile.setupAgentName||"Cappy"),[feedback,setFeedback]=useState("");
 function start(e){e.preventDefault();if(agent==="own"&&!agentName.trim()){setFeedback("Enter your agent’s name.");return;}w.store.set("workflow.profile",{...w.store.get("workflow.profile"),setupAgent:agent,setupAgentProvider:provider,setupAgentName:agentName.trim()});setStarted(true);}
 return <div className="setup-experience setup-mobile-safe flex min-h-dvh flex-col px-5 py-4 md:px-10 md:py-7"><header className="flex items-center justify-between gap-4"><Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold">Job signal board</Link><Link href="/profile/" className={secondary}>Exit setup</Link></header><div className={`mx-auto flex w-full flex-1 flex-col justify-center py-5 md:py-10 ${started?"max-w-2xl":"max-w-4xl"}`}>{started?<AgentFirstSetup/>:<form onSubmit={start}><Heading title="Meet your search companion.">Choose your agent. Find one relevant opportunity before a lengthy setup.</Heading><AgentSelector joinedOnce={joinedOnce} agent={agent} provider={provider} onSelect={(value,label)=>{setAgent(value==="platform"?"platform":"own");setProvider(value);setAgentName(label);}}/>{agent==="own"&&provider==="custom"&&<Field label="Agent name"><input className={control} value={agentName} onChange={e=>setAgentName(e.target.value)} maxLength={100}/></Field>}<Notice>Selection is a preference. The next step checks the real connection and tools; Cappy hosting is not connected yet.</Notice><Notice>{feedback}</Notice><button className={`${primary} mt-6 w-full`} type="submit">Let’s get started</button></form>}</div></div>;
}
