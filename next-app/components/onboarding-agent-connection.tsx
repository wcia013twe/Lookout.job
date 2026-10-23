"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { createBackend } from "../../backend/client.mjs";
import { useWorkspace } from "../lib/workspace";
import { handoffOnboardingSearch } from "../lib/onboarding-search-handoff.mjs";
import { onboardingConnectionReady } from "../lib/onboarding-connection.mjs";
import { Iphone } from "./iphone";
import AgentConnections, { AgentPluginSteps } from "./agent-connections";
import { Button, Dots, Icon, Quiet, Title } from "./onboarding-ui";

type Props = { intent: string; room: ReactNode; onFinish: () => void; onLater: () => void };

export default function OnboardingAgentConnection({ intent, room, onFinish, onLater }: Props) {
  const w = useWorkspace();
  const reduced = useReducedMotion();
  const api = useMemo(() => w.demo ? w.services : w.client && w.user ? createBackend(w.client, w.user.id) : null, [w.demo, w.services, w.client, w.user?.id]);
  const checkPage = useRef<HTMLDivElement>(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [handoff,setHandoff]=useState("");
  const [retry,setRetry]=useState(0);

  useEffect(() => {
    if(checking) { checkPage.current?.focus({preventScroll:true}); window.scrollTo({top:0,behavior:"instant"}); }
  }, [checking]);

  useEffect(() => {
    if (!checking || !api) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      try {
        let state = await api.onboardingAction("onboarding.get_state");
        // Demo uses only the isolated fixture; real runtime confirmation is agent-only.
        if (w.demo && state.step === "connection_pending") {
          await api.onboardingAction("onboarding.submit_step", { expectedRevision: state.revision, eventKey: crypto.randomUUID(), event: "runtime", data: { browsing: true } });
          state = await api.onboardingAction("onboarding.get_state");
        }
        if (!alive) return;
        setError("");
        if (onboardingConnectionReady(state)) {
          setConnected(true);
          try {
            const result=await handoffOnboardingSearch(api,intent,()=>alive);
            if(alive)setHandoff(result.status);
          } catch {
            if(alive){setHandoff("error");setError("Your agent is connected, but your search wasn’t handed off. Retry below.");}
          }
          return;
        }
      } catch {
        if (alive) setError("We couldn’t check yet. We’ll try again shortly.");
      }
      if (alive) timer = setTimeout(check, 2500);
    }
    timer = setTimeout(check, w.demo ? 1200 : 0);
    return () => { alive = false; clearTimeout(timer); };
  }, [checking, api, w.demo, intent, retry]);

  async function copyDemo() {
    try {
      await navigator.clipboard.writeText("Lookout demo setup — fictional preview, no credentials or live connection.");
      setCopied(true); setError("");
    } catch { setError("Copy didn’t work. Please try again."); }
  }

  if (checking) return <div className="connection-check" ref={checkPage} tabIndex={-1} style={{outline:"none"}}>
    <Dots />
    <Title>{connected ? "You’re connected." : "Let’s check your connection."}</Title>
    <p className="lead">{connected ? "Your agent has checked in with Lookout." : "Paste the setup into your agent and ask it to connect."}</p>
    <Iphone className="connection-device"><div className="connection-phone" role="status" aria-live="polite">
      <div className="connection-phone-brand"><Dots /><strong>lookout</strong></div>
      <motion.div className={"connection-phone-indicator" + (connected ? " is-connected" : "")} animate={connected || reduced ? { scale: 1, opacity: 1 } : { scale: [1, 1.06, 1], opacity: [.55, 1, .55] }} transition={{ duration: 2, repeat: connected || reduced ? 0 : Infinity }}>
        {connected ? <Icon kind="check" /> : <Dots />}
      </motion.div>
      <strong>{connected ? "Your agent is here." : "Waiting for your agent…"}</strong>
      <p>{connected ? handoff==="queued"?"Your search is queued for your agent.":handoff==="result_ready"?"Your agent has a result ready.":handoff==="needs_attention"?"Your search needs a quick check in your agent’s chat.":"Your agent can read your saved search." : "This updates when your agent checks in."}</p>
      {w.demo && <span className="hint">Demo connection · simulated</span>}
    </div></Iphone>
    {error && <p className="hint" role="status">{error}</p>}
    {handoff==="error"&&<Button secondary onClick={()=>{setError("");setRetry(value=>value+1);}}>Retry search handoff</Button>}
    {connected && <div className="actions"><Button onClick={onFinish}>Continue</Button></div>}
    <Quiet onClick={onLater}>I’ll do this later</Quiet>
  </div>;

  return <>
    <Title sub="Choose who’s joining your search.">Meet your agent.</Title>
    {room}
    <div className="agent-connect-heading"><h2>Let’s get connected.</h2></div>
    {w.demo ? <div className="agent-connect">
      <AgentPluginSteps />
      <p className="hint">Demo preview · no plugin is connected.</p>
      {!copied && <Button onClick={() => void copyDemo()}>Copy demo setup</Button>}
    </div> : w.user ? <AgentConnections onboarding onSetupCopied={() => setCopied(true)} /> : <>
      <p className="hint">Sign in to connect your agent securely.</p>
      <Button disabled={!w.authReady} onClick={w.signIn}>Sign in</Button>
    </>}
    {error && <p className="error" role="alert">{error}</p>}
    {copied && <div className="actions"><Button onClick={() => setChecking(true)}>Next</Button></div>}
    <div className="mt-6"><Quiet onClick={onLater}>I’ll do this later</Quiet></div>
  </>;
}
