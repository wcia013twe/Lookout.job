"use client";
import { useEffect, useRef, useState } from "react";
import { createBackend } from "../../backend/client.mjs";
import { useWorkspace } from "../lib/workspace";
import InterviewBrief from "./interview-brief";
import { subscribePreparationRefresh } from "../lib/action-board.mjs";
import { Notice, secondary } from "./ui";
import type { Application, PreparationPlan } from "./workflow-types";
export default function ApplicationPreparation({ application, onRounds }: { application: Application; onRounds: () => void }) {
  const w = useWorkspace(), owner = w.demo ? "demo" : w.user?.id || null;
  const [row, setRow] = useState<{ plan: PreparationPlan } | null>(null);
  const [loading, setLoading] = useState(Boolean(owner)), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  const ownerRef = useRef(owner); ownerRef.current = owner;
  useEffect(() => {
    let active = true;
    const stillOwner = () => active && ownerRef.current === owner && (w.demo || window.JB?.auth?.userId === owner);
    setRow(null); setError("");
    if (!owner || !application.backendId) { setLoading(false); return; }
    let generation=0;
    const load=()=>{
      const ticket=++generation;
      const current=()=>stillOwner()&&ticket===generation;
      (w.services || createBackend(w.client, owner)).readPreparation(application.backendId)
        .then((value: { plan: PreparationPlan } | null) => { if(current()){setRow(value);setError("");} })
        .catch(() => { if(current()) setError("The interview brief could not load."); })
        .finally(() => { if(current()) setLoading(false); });
    };
    setLoading(true);load();
    const stop=w.demo?()=>{}:subscribePreparationRefresh(document,window,owner,load);
    return () => { active = false; ++generation; stop(); };
  }, [owner, application.backendId, retry, w.client, w.services]);
  const plan = owner ? row?.plan : w.state.workflow.preparationPlans?.[application.id];
  return <div className="min-w-0" aria-busy={loading}>{loading ? <Notice>Loading interview brief…</Notice> : error ? <div><Notice>{error}</Notice><button className={`${secondary} mt-3`} onClick={() => setRetry(value => value + 1)}>Retry brief</button></div> : <InterviewBrief application={application} plan={plan} demo={w.demo} timeZone={w.state.workflow.searchPreferences?.quietMode?.timezone} onRounds={onRounds}/>}</div>;
}
