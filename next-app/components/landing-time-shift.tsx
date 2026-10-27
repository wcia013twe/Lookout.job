"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import styles from "./landing-time-shift.module.css";

const finalAngle = 9;

export default function LandingTimeShift() {
  const section = useRef<HTMLElement>(null);
  const visible = useInView(section, { once: true, amount: 0.35 });
  const reduced = useReducedMotion();
  const angle = useMotionValue(-finalAngle);
  const upright = useTransform(angle, value => -value);
  const [phase, setPhase] = useState<"initial" | "animating" | "complete">("initial");
  const active = visible || Boolean(reduced);

  useEffect(() => {
    if (reduced) {
      angle.set(finalAngle);
      setPhase("complete");
      return;
    }
    if (!visible) return;
    setPhase("animating");
    let cancelled = false;
    const animation = animate(angle, finalAngle, { type: "spring", duration: 1.15, bounce: 0.12, delay: 0.95 });
    animation.then(() => { if (!cancelled) setPhase("complete"); });
    return () => { cancelled = true; animation.stop(); };
  }, [angle, reduced, visible]);

  return (
    <section ref={section} className={styles.section} aria-labelledby="time-shift-heading" data-shift-state={phase}>
      <header className={styles.heading}>
        <h2 id="time-shift-heading">Less time applying.<br />More time preparing.</h2>
        <p>Put your time where it counts.</p>
      </header>
      <div className={styles.visual}>
        <svg className={styles.scale} viewBox="0 0 960 310" fill="none" aria-hidden="true" focusable="false">
          <path className={styles.base} d="M480 108V284M423 284H537" strokeWidth="7" strokeLinecap="round" />
          <path className={styles.fulcrum} d="m480 87 24 35h-48l24-35Z" />
          <g transform="translate(480 108)">
            <motion.g className={styles.beam} style={{ rotate: angle, transformOrigin: "0px 0px" }}>
              <path d="M-300 0H300" className={styles.rail} strokeWidth="7" strokeLinecap="round" />
              {[-300, 300].map((x, index) => (
                <g key={x} transform={`translate(${x} 0)`}>
                  <motion.g className={styles.pan} style={{ rotate: upright, transformOrigin: "0px 0px" }}>
                    <path className={styles.strings} d="M0 0V18M-72 18H72M-72 18V108M72 18V108" strokeWidth="2" strokeLinecap="round" />
                    <motion.g
                      className={index === 0 ? styles.applyingWeight : styles.preparingWeight}
                      initial={false}
                      animate={{ opacity: index === 0 ? (active ? 0 : 1) : (active ? 1 : 0) }}
                      transition={{ duration: reduced ? 0 : 0.25, delay: reduced ? 0 : index === 0 ? 0.2 : 0.95 }}
                    >
                      {[59, 76, 93].map((y, i) => <rect key={y} x={-48 + i * -5} y={y} width={96 + i * 10} height="12" rx="4" className={styles.weight} />)}
                    </motion.g>
                    <path className={styles.tray} d="M-92 108H92C78 136-78 136-92 108Z" strokeWidth="2" strokeLinejoin="round" />
                  </motion.g>
                </g>
              ))}
            </motion.g>
          </g>
          <circle cx="480" cy="108" r="11" className={styles.pivot} />
          <motion.g
            className={styles.transfer}
            initial={{ x: 184, y: 212, opacity: 0 }}
            animate={active && !reduced ? { x: [184, 320, 640, 776], y: [212, 28, 28, 142], opacity: [0, 1, 1, 0] } : { opacity: 0 }}
            transition={{ duration: 1.05, delay: 0.15, times: [0, 0.25, 0.7, 1], ease: "easeInOut" }}
          >
            <rect x="-40" y="-6" width="80" height="12" rx="4" className={styles.weight} />
          </motion.g>
        </svg>
        <div className={styles.labels}>
          <div><span>Applying</span><h3>Less busywork</h3><p>Repetitive search &amp; admin</p></div>
          <div><span>Preparing</span><h3>More time to grow</h3><p>Interviews, networking, skills</p></div>
        </div>
      </div>
      <p className={styles.caption}>Conceptual illustration, not measured time savings.</p>
    </section>
  );
}
