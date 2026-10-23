"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CompanyLogo, type Role } from "./role-card";
import RoleMatchPreview from "./role-match-preview";
import { useWorkspace } from "../lib/workspace";
import { recordRoleOpened } from "../lib/progress.mjs";
import { Button, Dots, Quiet, Title } from "./onboarding-ui";

const ease = [0.16, 1, 0.3, 1] as const;

function TypedAnalysis({ active, text }: { active: boolean; text: string }) {
  const reduced = useReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    if (!active) return;
    if (reduced) {
      setCount(text.length);
      return;
    }
    const timer = window.setInterval(() => {
      setCount(current => {
        if (current + 3 >= text.length) window.clearInterval(timer);
        return Math.min(current + 3, text.length);
      });
    }, 24);
    return () => window.clearInterval(timer);
  }, [active, reduced, text]);

  return <p className="typed-analysis">
    <span className="sr-only">{text}</span>
    <span aria-hidden="true">
      {text.slice(0, count)}
      {active && count < text.length && <span className="typing-caret">▍</span>}
    </span>
  </p>;
}

type OnboardingRoleRevealProps = {
  role: Role | null;
  demo: boolean;
  onPrepare: () => void;
  onLater: () => void;
};

export default function OnboardingRoleReveal({ role, demo, onPrepare, onLater }: OnboardingRoleRevealProps) {
  const w=useWorkspace();
  const pending=!role;
  const illustrative = demo;
  const reduced = useReducedMotion();
  const [opened, setOpened] = useState(false);
  const [spread, setSpread] = useState(false);
  const [analysis, setAnalysis] = useState(false);
  const swipe = useRef<number | null>(null);
  const analysisHeading = useRef<HTMLHeadingElement>(null);
  const text = pending
    ? "Your preferences are saved. Connect your agent to find a current employer posting and compare it with your saved profile and résumé. Your first result will appear in your workspace."
    : illustrative
      ? role.whyItFits || "This fictional example demonstrates the reveal. Sample fit scores are illustrative."
      : "This catalog role matches the work type and location you chose. Your agent will check that the posting is still open and compare it with your saved profile and résumé before recommending a next step.";

  useEffect(() => {
    setSpread(false);
    setAnalysis(false);
    if (!opened) return;
    if (reduced) {
      setSpread(true);
      setAnalysis(true);
      return;
    }
    const move = window.setTimeout(() => setSpread(true), 850);
    const type = window.setTimeout(() => setAnalysis(true), 1700);
    return () => {
      window.clearTimeout(move);
      window.clearTimeout(type);
    };
  }, [opened, reduced]);

  useEffect(() => {
    if (spread) analysisHeading.current?.focus({ preventScroll: true });
  }, [spread]);

  return <div className={`role-reveal${spread ? " spread" : ""}`}>
    <motion.div layout transition={{ layout: { duration: reduced ? 0 : 0.75, ease } }} className="gold-position">
      <motion.div className="card-flipper" initial={false} animate={{ rotateY: opened ? -180 : 0 }} transition={{ duration: reduced ? 0 : 0.8, ease }}>
        <button
          type="button"
          className="purple-card-back"
          aria-label="Reveal your first role"
          aria-hidden={opened}
          tabIndex={opened ? -1 : 0}
          onClick={() => setOpened(true)}
          onPointerDown={event => { swipe.current = event.clientX; }}
          onPointerUp={event => {
            if (swipe.current !== null && Math.abs(event.clientX - swipe.current) > 50) setOpened(true);
            swipe.current = null;
          }}
          onPointerCancel={() => { swipe.current = null; }}
        >
          <strong>Your next drop</strong>
          <svg className="reveal-star" viewBox="0 0 120 140" fill="none" aria-hidden="true">
            <path d="M60 5C49 46 43 53 5 69C43 81 49 92 60 135C70 92 78 81 115 69C78 55 70 46 60 5Z" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
          </svg>
          <strong>Tap or swipe to reveal</strong>
        </button>
        <article className="gold-card card-front" aria-hidden={!opened} inert={!opened}>
          <div className="gold-banner"><Dots /><span className="gold-tier">{pending ? "Your first search" : illustrative ? "Sample opportunity" : "A role to explore"}</span></div>
          <div className="gold-body">
            {role ? <>
              <div className="gold-company"><CompanyLogo company={role.company} /><span>{role.company}</span></div>
              <h2>{role.title}</h2>
              <p className="meta">{role.employmentType==="FT"?"Full-time":role.employmentType} · {role.location || "Location not recorded"}</p>
              {illustrative ? <RoleMatchPreview sample={role.matchPreview} demo animate active={spread}/> : <div className="onboarding-role-check"><h3>Agent review comes next.</h3><p>Availability and résumé fit haven’t been checked yet.</p>{role.compensation&&<p>{role.compensation}</p>}<a href={role.applicationUrl} target="_blank" rel="noreferrer" onClick={()=>recordRoleOpened(w.store,role.id)}>View employer posting ↗</a></div>}
              <p className="hint">{illustrative ? "Fictional role · illustrative fit preview" : "Catalog shortlist · no personalized assessment yet"}</p>
            </> : <div className="onboarding-first-find"><Dots/><h2>Your first find is on its way.</h2><p>Connect your agent to look beyond the catalog.</p></div>}
          </div>
        </article>
      </motion.div>
    </motion.div>
    {spread && <motion.div className="reveal-copy" initial={reduced ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduced ? 0 : 0.6, ease }}>
      <Dots />
      <Title>{pending ? "Let’s find your first role." : illustrative ? "A glimpse of what’s next." : "A role to explore."}</Title>
      <h3 ref={analysisHeading} tabIndex={-1}>{pending ? "Your search, ready to go" : illustrative ? "Illustrative fit analysis" : "Why it’s here"}</h3>
      <TypedAnalysis active={analysis} text={text} />
      <p className="hint">{illustrative ? "Fictional example. This is not live résumé analysis." : pending ? "Your agent runs the search after connecting." : "Shortlisted from your preferences. The agent review is still to come."}</p>
      <div className="actions">
        <Button onClick={onPrepare}>{pending ? "Connect my agent" : illustrative ? "Meet my agent" : "Check this with my agent"}</Button>
        <Quiet onClick={onLater}>I’ll do this later</Quiet>
      </div>
    </motion.div>}
    {!spread && <div className="reveal-later"><Quiet onClick={onLater}>I’ll do this later</Quiet></div>}
  </div>;
}
