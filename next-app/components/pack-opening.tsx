"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion, useMotionValue, useSpring, type MotionStyle } from "framer-motion";
import { asset, useWorkspace } from "../lib/workspace";
import { claimPack, dayStamp } from "../lib/progress.mjs";
import { advanceStage, canClaimPack, dropKey, groupPack, packComplete, tierOf, tierOrder, type Drop, type Stage, type Tier } from "../lib/drop-pack";
import { RARITY_LABEL, TIER_HEX } from "../lib/role-display";
import { resolvePackStyle, resolvePackTexture, selectPackStyle, type PackStyleId, type PackStyleTemplate } from "../styles/templates/pack-styles";
import { CompanyLogo } from "./role-card";
import PackEffects from "./pack-effects";
import styles from "../styles/templates/pack-opening.module.css";

type Props = { drops: Drop[]; day: string; onClose: () => void; styleId?: PackStyleId };

function pulse(tier?: Tier) {
  if (typeof navigator.vibrate === "function") navigator.vibrate(tier && tierOrder.indexOf(tier) >= 3 ? [18, 30, 28] : 12);
}

export default function PackOpening({ drops, day, onClose, styleId }: Props) {
  const w = useWorkspace();
  const reduced = useReducedMotion();
  const root = useRef<HTMLDialogElement>(null);
  const tearStart = useRef<number | null>(null);
  const tearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opening = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const groups = useMemo(() => groupPack(drops), [drops]);
  const template = useMemo(() => resolvePackStyle(styleId || selectPackStyle(drops.map(tierOf))), [drops, styleId]);
  const texture = resolvePackTexture(w.state.workflow.theme?.pack);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"sealed" | "tearing" | "open">("sealed");
  const [tearProgress, setTearProgress] = useState(0);
  const [index, setIndex] = useState(0);
  const [split, setSplit] = useState<Record<string, boolean>>({});
  const [stages, setStages] = useState<Record<string, Stage>>(() => Object.fromEntries(drops.map(drop => [dropKey(drop), w.state.drops.seenDropIds?.includes(dropKey(drop)) ? "back" : "mystery"])));
  const [feedback, setFeedback] = useState("");
  const [claimed, setClaimed] = useState(false);
  const [summary, setSummary] = useState(false);
  const complete = packComplete(drops, stages);
  const revealed = drops.filter(drop => stages[dropKey(drop)] === tierOf(drop)).length;
  const rewarded = Boolean(w.state.drops.packRewards?.[day]);
  const historical = day !== dayStamp();
  const active = groups[index];
  const activeComplete = Boolean(active?.drops.every(drop => stages[dropKey(drop)] === tierOf(drop)));

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted || !root.current) return;
    const dialog = root.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    w.store.set("ui.packOpen", true);
    return () => {
      if (tearTimer.current) clearTimeout(tearTimer.current);
      dialog.close();
      document.body.style.overflow = overflow;
      w.store.set("ui.packOpen", false);
      previous?.isConnected && previous.focus({ preventScroll: true });
    };
  }, [mounted, w.store]);
  useEffect(() => {
    if (phase !== "open" || summary || !activeComplete) return;
    const timer = window.setTimeout(() => {
      const restoreFocus = Boolean(root.current?.contains(document.activeElement));
      if (complete) {
        setSummary(true);
        if (restoreFocus) requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(".pack-summary h3")?.focus({ preventScroll: true }));
        return;
      }
      setIndex(value => Math.min(value + 1, groups.length - 1));
      if (restoreFocus) requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(".pack-row button")?.focus({ preventScroll: true }));
    }, reduced ? 0 : template.motion.finalHoldMs);
    return () => window.clearTimeout(timer);
  }, [active?.key, activeComplete, complete, groups.length, index, phase, reduced, summary, template.motion.finalHoldMs]);

  function emit(name: string) { root.current?.dispatchEvent(new CustomEvent(name, { bubbles: true })); }
  function seen(items: Drop[]) {
    w.store.update("drops.seenDropIds", (ids: string[]) => [...new Set([...(ids || []), ...items.map(dropKey)])]);
  }
  function close() {
    w.store.set(`drops.packStamps.${day}`, true);
    onCloseRef.current();
  }
  function openSeal() {
    if (opening.current) return;
    opening.current = true;
    setPhase(reduced ? "open" : "tearing");
    pulse();
    emit("pack:tear");
    const finish = () => {
      setPhase("open");
      requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(".pack-row button")?.focus({ preventScroll: true }));
    };
    if (reduced) finish(); else tearTimer.current = setTimeout(finish, 650);
  }
  function dragTear(event: PointerEvent<HTMLButtonElement>) {
    if (tearStart.current === null || opening.current) return;
    const amount = Math.min(1, Math.abs(event.clientX - tearStart.current) / Math.max(80, event.currentTarget.clientWidth * 0.65));
    setTearProgress(amount);
    emit("pack:charge");
    if (amount === 1) openSeal();
  }
  function advance(drop: Drop, card: HTMLElement) {
    const key = dropKey(drop), tier = advanceStage(stages[key], tierOf(drop));
    if (stages[key] === tier) return;
    setStages(previous => ({ ...previous, [key]: tier }));
    seen([drop]);
    card.dispatchEvent(new CustomEvent("dropcard:stage", { bubbles: true, detail: { tier, final: tier === tierOf(drop) } }));
    pulse(tier);
  }
  function revealAll() {
    setSplit(Object.fromEntries(groups.map(group => [group.key, true])));
    setStages(Object.fromEntries(drops.map(drop => [dropKey(drop), tierOf(drop)])));
    seen(drops);
    const card = root.current?.querySelector<HTMLElement>(".dropcard");
    const tier = active ? tierOf(active.drops[0]) : "rare";
    card?.dispatchEvent(new CustomEvent("dropcard:stage", { bubbles: true, detail: { tier, final: true } }));
    pulse(tier);
  }
  function claim() {
    if (!canClaimPack(drops, stages, day, dayStamp()) || claimed) return;
    const added = claimPack(w.store);
    setClaimed(true);
    setFeedback(added ? "+25 XP claimed" : "Today’s pack XP was already claimed.");
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(".pack-close")?.focus({ preventScroll: true }));
    pulse();
  }


  if (!mounted) return null;
  const sealMotion = { duration: reduced ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] as const };
  const experienceStyle = {
    ...template.variables,
    "--pack-canvas-opacity": texture.id === "base" ? template.variables["--pack-canvas-opacity"] : ".2",
    "--pack-texture-image": texture.image ? `url("${asset(texture.image)}")` : "none",
  } as CSSProperties;
  return createPortal(
    <dialog ref={root} className={styles.experience} style={experienceStyle} data-pack-style={template.id} data-pack-texture={texture.id} data-sealed={phase !== "open"} data-phase={phase} aria-labelledby="drop-pack-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === root.current) close(); }}>
      <div className="pack-modal">
        <header className="pack-head">
          <div><h2 id="drop-pack-title">Daily drop pack</h2><p>{day} · {drops.length} opportunities{w.demo ? " · Fictional demo" : ""}</p></div>
          <button type="button" className="pack-close" aria-label="Close pack" onClick={close}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
        </header>
        {phase !== "open" ? <section className="pack-seal" aria-label="Sealed opportunity pack">
          <div className="pack-seal-art" style={{ "--tear-progress": tearProgress } as CSSProperties}>
            <motion.div aria-hidden="true" className="seal-shard seal-shard-top" animate={phase === "tearing" ? { x: -35, y: -140, rotate: -12, opacity: 0 } : { x: 0, y: 0, opacity: 1 }} transition={sealMotion} />
            <motion.div aria-hidden="true" className="seal-shard seal-shard-bottom" animate={phase === "tearing" ? { x: 35, y: 140, rotate: 12, opacity: 0 } : { x: 0, y: 0, opacity: 1 }} transition={sealMotion} />
            <div className="seal-copy"><span className="seal-edition">ZERO2SUDO · DAILY EDITION</span><strong>Your next<br />big move.</strong><span>{drops.length} opportunities inside</span></div>
            <button type="button" className="pack-tear-button" disabled={phase === "tearing"} onClick={openSeal} onPointerDown={event => { tearStart.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={dragTear} onPointerUp={() => { tearStart.current = null; if (!opening.current) setTearProgress(0); }} onPointerCancel={() => { tearStart.current = null; setTearProgress(0); }}>
              <span className="tear-grip" aria-hidden="true"><svg viewBox="0 0 18 18" fill="none"><path d="m3.5 5.5 3.5 3.5-3.5 3.5M9 5.5l3.5 3.5L9 12.5" /></svg></span>
              <span className="tear-copy"><strong>Slide to tear</strong><small>or tap to open</small></span>
            </button>
          </div>
          <p className="seal-instruction" role="status">{phase === "tearing" ? "Opening your pack…" : "Break the seal. See what’s inside."}</p>
          {historical && <p className="pack-history">Replay of {day} · daily XP is awarded only for today’s pack.</p>}
        </section> : <>
          {!summary ? <>
            <div className="pack-tools"><p role="status">{revealed} / {drops.length} revealed · Drop {index + 1} of {groups.length}</p><button type="button" onClick={revealAll} disabled={complete}>Reveal all</button></div>
            <div className="pack-row">
              <AnimatePresence initial={false} mode="wait">
                <motion.div key={active?.key} className="pack-group" initial={reduced ? false : { opacity: 0.55, x: template.motion.forwardDistance, filter: "blur(8px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} exit={reduced ? undefined : { opacity: 0, x: -template.motion.forwardDistance, scale: 0.96, filter: "blur(8px)" }} transition={{ duration: reduced ? 0 : template.motion.forwardDuration, ease: [0.16, 1, 0.3, 1] }}>
                  <motion.div layout={!reduced} className={active && split[active.key] && active.drops.length > 1 ? "mega-split" : "single-drop"}>
                    {active && split[active.key] && active.drops.length > 1 && <p className="mega-message" role="status">Mega drop · {active.drops.length} cards from {active.drops[0].company}</p>}
                    {active?.drops.slice(0, split[active.key] ? active.drops.length : 1).map((drop, cardIndex) => <motion.div layout={!reduced} className="mega-card" key={dropKey(drop)} initial={reduced || cardIndex === 0 ? false : { opacity: 0, x: -100, rotateY: -180, y: -24 }} animate={{ opacity: 1, x: 0, rotateY: 0, y: 0 }} transition={{ duration: reduced ? 0 : 0.7, delay: reduced ? 0 : Math.max(0, cardIndex - 1) * 0.12, ease: [0.16, 1, 0.3, 1] }}>
                      <RevealCard drop={drop} stage={stages[dropKey(drop)]} reduced={Boolean(reduced)} demo={w.demo} template={template} onAdvance={(item, element) => {
                        if (active.drops.length > 1 && !split[active.key]) {
                          setSplit(previous => ({ ...previous, [active.key]: true }));
                          emit("pack:charge");
                        }
                        advance(item, element);
                      }} />
                    </motion.div>)}
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </div>
          </> : <motion.section className="pack-summary" aria-labelledby="pack-summary-title" initial={reduced ? false : { opacity: 0.5, scale: 0.97, filter: "blur(8px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} transition={{ duration: reduced ? 0 : template.motion.forwardDuration, ease: [0.16, 1, 0.3, 1] }}>
            <h3 id="pack-summary-title" tabIndex={-1}>Your revealed drops</h3>
            <div className="summary-grid">{drops.map(drop => <SummaryCard key={dropKey(drop)} drop={drop} demo={w.demo} />)}</div>
          </motion.section>}
          {summary && complete && <footer className="pack-foot"><p role="status">{drops.length} drops fully revealed{historical ? " · Historical replay" : ""}</p>{historical ? <button type="button" onClick={close}>Done</button> : <button type="button" onClick={claim} disabled={claimed}>{claimed ? rewarded ? "Pack complete" : "+25 XP collected" : rewarded ? "Done · XP already claimed" : "Claim +25 XP"}</button>}{feedback && <p role="status">{feedback}</p>}</footer>}
        </>}
      </div>
      <PackEffects rootRef={root} reducedMotion={Boolean(reduced)} template={template.effects} />
    </dialog>, document.body,
  );
}

function RevealCard({ drop, stage, reduced, demo, template, onAdvance }: { drop: Drop; stage: Stage; reduced: boolean; demo: boolean; template: PackStyleTemplate; onAdvance: (drop: Drop, element: HTMLElement) => void }) {
  const element = useRef<HTMLElement>(null);
  const swipe = useRef<number | null>(null);
  const swiped = useRef(false);
  const restoreFocus = useRef(false);
  const tier = stage === "back" || stage === "mystery" ? "epic" : stage;
  const complete = stage === tierOf(drop);
  const tiltX = useMotionValue(0), tiltY = useMotionValue(0);
  const springX = useSpring(tiltX, { stiffness: 260, damping: 24 });
  const springY = useSpring(tiltY, { stiffness: 260, damping: 24 });
  useEffect(() => {
    if (!restoreFocus.current || !element.current) return;
    restoreFocus.current = false;
    (element.current.querySelector<HTMLElement>("button, a, summary") || element.current).focus({ preventScroll: true });
  }, [stage]);
  const doAdvance = () => {
    if (!element.current) return;
    restoreFocus.current = element.current.contains(document.activeElement);
    onAdvance(drop, element.current);
  };
  return <motion.article ref={element} tabIndex={-1} className={`dropcard t-${tier} ${stage === "back" || stage === "mystery" ? "unrevealed" : ""}`} data-revealed={complete} data-tier={tier} style={{ "--tier": TIER_HEX[tier], "--tier-ink": tier === "mythic" ? "#fff" : "#08101e", rotateX: reduced ? 0 : springX, rotateY: reduced ? 0 : springY } as MotionStyle} onPointerMove={event => { if (reduced || event.pointerType !== "mouse") return; const r = event.currentTarget.getBoundingClientRect(); tiltX.set(((event.clientY - r.top) / r.height - 0.5) * -8); tiltY.set(((event.clientX - r.left) / r.width - 0.5) * 10); }} onPointerLeave={() => { tiltX.set(0); tiltY.set(0); }}>
    <motion.div key={stage} className="dropcard-stage" initial={reduced ? false : { opacity: 0.45, scale: complete ? 0.7 : 0.9, filter: `brightness(${complete ? 3.2 : 1.9}) saturate(${complete ? 2.2 : 1.8}) blur(${complete ? 14 : 5}px)` }} animate={{ opacity: 1, scale: 1, filter: "brightness(1) saturate(1) blur(0px)" }} transition={{ duration: reduced ? 0 : complete ? template.motion.finalRevealDuration : template.motion.stageDuration, ease: [0.16, 1, 0.3, 1] }}>
      {stage === "back" || stage === "mystery" ? <button type="button" className="card-mystery" onClick={() => { if (swiped.current) { swiped.current = false; return; } doAdvance(); }} onPointerDown={event => { swipe.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerCancel={() => { swipe.current = null; swiped.current = false; }} onPointerUp={event => { if (swipe.current !== null && Math.abs(event.clientX - swipe.current) > 60) { swiped.current = true; doAdvance(); } swipe.current = null; }}><span>{stage === "mystery" ? "A new opportunity awaits" : "Your next drop"}</span><strong aria-hidden="true">?</strong><span className="dropcard-hint">Tap or swipe to reveal</span></button> : <>
        {complete ? <div className="card-revealed">
          {!reduced && <motion.span aria-hidden="true" className="reveal-flash" initial={{ opacity: 0, scale: 0.16, rotate: -3 }} animate={{ opacity: [0, 1, 1, 0.72, 0], scale: [0.16, 0.34, 0.92, 1.72, template.motion.flareScale], rotate: [-3, 0, 2, 5, 8] }} transition={{ duration: template.motion.flareDuration, times: [0, 0.12, 0.34, 0.7, 1], ease: [0.16, 1, 0.3, 1] }} />}
          <span className="drop-tier">{RARITY_LABEL[tier]}</span>
          <motion.div className="reveal-logo" initial={reduced ? false : { scale: 0.3, filter: "brightness(3) blur(6px)" }} animate={{ scale: 1, filter: "brightness(1) blur(0px)" }} transition={{ duration: reduced ? 0 : template.motion.finalRevealDuration, ease: [0.16, 1, 0.3, 1] }}><CompanyLogo company={drop.company} /></motion.div>
          <div className="reveal-copy"><p>{drop.company}</p><h3>{drop.title}</h3></div>
          <p className="reveal-meta">{[drop.type === "FT" ? "Full-time" : drop.type, drop.location, drop.comp].filter(Boolean).join(" · ")}</p>
          <div className="reveal-actions"><span className="drop-status">{drop.status}</span>{drop.url && !demo && <a className="dropcard-link" href={drop.url} target="_blank" rel="noopener noreferrer">Open posting</a>}</div>
          {(drop.skipReason || drop.note) && <details className="drop-note"><summary>Details</summary>{drop.skipReason && <p>Skipped: {drop.skipReason}</p>}{drop.note && <p>{drop.note}</p>}</details>}
        </div> : <button type="button" className="card-upgrade" onClick={doAdvance}>
          <span className="drop-tier">{RARITY_LABEL[tier]}</span>
          <strong aria-hidden="true">?</strong>
          <span>Tap to upgrade</span>
          <span className="sr-only">Current reveal tier: {RARITY_LABEL[tier]}</span>
        </button>}
      </>}
    </motion.div>
  </motion.article>;
}

function SummaryCard({ drop, demo }: { drop: Drop; demo: boolean }) {
  const tier = tierOf(drop);
  return <article className={`summary-card t-${tier}`} style={{ "--tier": TIER_HEX[tier] } as CSSProperties}>
    <div className="summary-card-head"><CompanyLogo company={drop.company} /><div className="summary-card-title"><p>{drop.company} · {RARITY_LABEL[tier]}</p><h4>{drop.title}</h4></div></div>
    <p className="summary-meta">{[drop.type === "FT" ? "Full-time" : drop.type, drop.location].filter(Boolean).join(" · ")}</p>
    <div className="summary-actions"><span className="drop-status">{drop.status}</span>{drop.url && !demo && <a className="dropcard-link" href={drop.url} target="_blank" rel="noopener noreferrer">Open posting</a>}</div>
  </article>;
}
