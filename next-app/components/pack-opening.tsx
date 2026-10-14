"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion, useMotionValue, useSpring, type MotionStyle } from "framer-motion";
import { useWorkspace } from "../lib/workspace";
import { claimPack, dayStamp } from "../lib/progress.mjs";
import { advanceStage, canClaimPack, dropKey, groupPack, packComplete, tierOf, tierOrder, type Drop, type Stage, type Tier } from "../lib/drop-pack";
import { RARITY_LABEL, TIER_HEX } from "../lib/role-display";
import { CompanyLogo } from "./role-card";
import PackEffects from "./pack-effects";
import styles from "./pack-opening.module.css";

type Props = { drops: Drop[]; day: string; onClose: () => void };

function pulse(tier?: Tier) {
  if (typeof navigator.vibrate === "function") navigator.vibrate(tier && tierOrder.indexOf(tier) >= 3 ? [18, 30, 28] : 12);
}

export default function PackOpening({ drops, day, onClose }: Props) {
  const w = useWorkspace();
  const reduced = useReducedMotion();
  const root = useRef<HTMLDialogElement>(null);
  const tearStart = useRef<number | null>(null);
  const tearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opening = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const groups = useMemo(() => groupPack(drops), [drops]);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"sealed" | "tearing" | "open">("sealed");
  const [tearProgress, setTearProgress] = useState(0);
  const [index, setIndex] = useState(0);
  const [split, setSplit] = useState<Record<string, boolean>>({});
  const [stages, setStages] = useState<Record<string, Stage>>(() => Object.fromEntries(drops.map(drop => [dropKey(drop), w.state.drops.seenDropIds?.includes(dropKey(drop)) ? "back" : "mystery"])));
  const [feedback, setFeedback] = useState("");
  const [claimed, setClaimed] = useState(false);
  const complete = packComplete(drops, stages);
  const revealed = drops.filter(drop => stages[dropKey(drop)] === tierOf(drop)).length;
  const rewarded = Boolean(w.state.drops.packRewards?.[day]);
  const historical = day !== dayStamp();
  const active = groups[index];

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
    card.dispatchEvent(new CustomEvent("dropcard:stage", { bubbles: true, detail: { tier } }));
    pulse(tier);
  }
  function revealAll() {
    setSplit(Object.fromEntries(groups.map(group => [group.key, true])));
    setStages(Object.fromEntries(drops.map(drop => [dropKey(drop), tierOf(drop)])));
    seen(drops);
    const card = root.current?.querySelector<HTMLElement>(".dropcard");
    const tier = active ? tierOf(active.drops[0]) : "rare";
    card?.dispatchEvent(new CustomEvent("dropcard:stage", { bubbles: true, detail: { tier } }));
    pulse(tier);
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(".pack-foot button")?.focus({ preventScroll: true }));
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
  return createPortal(
    <dialog ref={root} className={styles.experience} data-sealed={phase !== "open"} data-phase={phase} aria-labelledby="drop-pack-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === root.current) close(); }}>
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
            <button type="button" className="pack-tear-button" disabled={phase === "tearing"} onClick={openSeal} onPointerDown={event => { tearStart.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={dragTear} onPointerUp={() => { tearStart.current = null; if (!opening.current) setTearProgress(0); }} onPointerCancel={() => { tearStart.current = null; setTearProgress(0); }}>Slide across to tear · or tap</button>
          </div>
          <p className="seal-instruction" role="status">{phase === "tearing" ? "Opening your pack…" : "Break the seal. See what’s inside."}</p>
          {historical && <p className="pack-history">Replay of {day} · daily XP is awarded only for today’s pack.</p>}
        </section> : <>
          <div className="pack-tools"><p role="status">{revealed} / {drops.length} revealed</p><button type="button" onClick={revealAll} disabled={complete}>Reveal all</button></div>
          <div className="pack-row">
            <AnimatePresence initial={false} mode="wait">
              <motion.div key={active?.key} className="pack-group" initial={reduced ? false : { opacity: 0.7, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={reduced ? undefined : { opacity: 0, x: -12 }} transition={{ duration: reduced ? 0 : 0.2 }}>
                {active?.drops.length === 2 && !split[active.key] ? <button type="button" className="double-combo" onClick={() => { setSplit(previous => ({ ...previous, [active.key]: true })); seen(active.drops); emit("pack:charge"); requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(".pack-row button")?.focus({ preventScroll: true })); }}><span className="double-badge">2-in-1 drop</span><strong aria-hidden="true">2?</strong><span>Full-time + internship</span><span className="dropcard-hint">Tap to split your two drops</span></button> : <div className={active?.drops.length === 2 ? "double-split" : "single-drop"}>
                  {active?.drops.map(drop => <RevealCard key={dropKey(drop)} drop={drop} stage={stages[dropKey(drop)]} reduced={Boolean(reduced)} demo={w.demo} onAdvance={advance} />)}
                </div>}
              </motion.div>
            </AnimatePresence>
          </div>
          <nav className="pack-nav" aria-label="Pack cards"><button type="button" disabled={index === 0} onClick={() => { setIndex(value => value - 1); emit("pack:charge"); }}>Previous</button><span>Card {index + 1} of {groups.length}</span><button type="button" disabled={index === groups.length - 1} onClick={() => { setIndex(value => value + 1); emit("pack:charge"); }}>Next</button></nav>
          {complete && <footer className="pack-foot"><p role="status">{drops.length} drops fully revealed{historical ? " · Historical replay" : ""}</p>{historical ? <button type="button" onClick={close}>Done</button> : <button type="button" onClick={claim} disabled={claimed}>{claimed ? rewarded ? "Pack complete" : "+25 XP collected" : rewarded ? "Done · XP already claimed" : "Claim +25 XP"}</button>}{feedback && <p role="status">{feedback}</p>}</footer>}
        </>}
      </div>
      <PackEffects rootRef={root} reducedMotion={Boolean(reduced)} />
    </dialog>, document.body,
  );
}

function RevealCard({ drop, stage, reduced, demo, onAdvance }: { drop: Drop; stage: Stage; reduced: boolean; demo: boolean; onAdvance: (drop: Drop, element: HTMLElement) => void }) {
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
  return <motion.article ref={element} tabIndex={-1} className={`dropcard t-${tier} ${stage === "back" || stage === "mystery" ? "unrevealed" : ""}`} data-revealed={complete} style={{ "--tier": TIER_HEX[tier], "--tier-ink": tier === "mythic" ? "#fff" : "#08101e", rotateX: reduced ? 0 : springX, rotateY: reduced ? 0 : springY } as MotionStyle} onPointerMove={event => { if (reduced || event.pointerType !== "mouse") return; const r = event.currentTarget.getBoundingClientRect(); tiltX.set(((event.clientY - r.top) / r.height - 0.5) * -8); tiltY.set(((event.clientX - r.left) / r.width - 0.5) * 10); }} onPointerLeave={() => { tiltX.set(0); tiltY.set(0); }}>
    <motion.div key={stage} className="dropcard-stage" initial={reduced ? false : { scale: 0.93, rotate: -2, filter: "brightness(1.7)" }} animate={{ scale: 1, rotate: 0, filter: "brightness(1)" }} transition={{ duration: reduced ? 0 : 0.42, ease: [0.16, 1, 0.3, 1] }}>
      {stage === "back" || stage === "mystery" ? <button type="button" className="card-mystery" onClick={() => { if (swiped.current) { swiped.current = false; return; } doAdvance(); }} onPointerDown={event => { swipe.current = event.clientX; }} onPointerUp={event => { if (swipe.current !== null && Math.abs(event.clientX - swipe.current) > 60) { swiped.current = true; doAdvance(); } swipe.current = null; }}><span>{stage === "mystery" ? "A new opportunity awaits" : "Your next drop"}</span><strong aria-hidden="true">?</strong><span className="dropcard-hint">Tap or swipe to reveal</span></button> : <>
        <div className="dropcard-top"><span className="drop-tier">{RARITY_LABEL[tier]}</span><motion.div className="dropcard-art" initial={complete && !reduced ? { scale: 0.65, filter: "brightness(2)" } : false} animate={{ scale: 1, filter: "brightness(1)" }} transition={{ duration: reduced ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}>{complete ? <CompanyLogo company={drop.company} /> : <span aria-hidden="true">?</span>}</motion.div></div>
        <div className="dropcard-sheet"><h3>{complete ? drop.company : "Power building"}</h3><h4>{complete ? drop.title : "Something stronger is inside"}</h4>
          {complete ? <><dl>{[["Location", drop.location], ["Track", drop.type === "FT" ? "Full-time" : drop.type], ["Comp", drop.comp]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="drop-status">{drop.status}</p>{drop.skipReason && <p className="drop-note">Skipped: {drop.skipReason}</p>}{drop.note && <details className="drop-note"><summary>View notes</summary><p>{drop.note}</p></details>}{drop.url && !demo && <a className="dropcard-link" href={drop.url} target="_blank" rel="noopener noreferrer">Open posting</a>}<p className="dropcard-hint done">Fully revealed</p></> : <button type="button" className="drop-power" onClick={doAdvance}>Tap to power up</button>}
        </div>
      </>}
    </motion.div>
  </motion.article>;
}
