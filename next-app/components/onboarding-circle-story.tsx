"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Dots, Icon, Quiet, Title } from "./onboarding-ui";

const ease = [0.16, 1, 0.3, 1] as const;

function CirclePeople() {
  return <span className="circle-people" aria-hidden="true"><i>A</i><i>J</i><i>M</i></span>;
}

export default function OnboardingCircleStory({ onLater }: { onLater: () => void }) {
  const reduced = useReducedMotion();
  const [beat, setBeat] = useState(0);
  const thread = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) {
      setBeat(2);
      return;
    }
    setBeat(0);
    const timers = [150, 1200].map((delay, index) =>
      window.setTimeout(() => setBeat(index + 1), delay)
    );
    return () => timers.forEach(window.clearTimeout);
  }, [reduced]);

  useEffect(() => {
    if (!reduced && thread.current) {
      thread.current.scrollTo({ top: thread.current.scrollHeight, behavior: "smooth" });
    }
  }, [beat, reduced]);

  const enter = {
    initial: reduced ? false as const : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.45, ease },
  };

  return <>
    <Dots />
    <Title>An edge, from your people.</Title>
    <div className="circle-story">
      <div className="circle-story-header">
        <CirclePeople />
        <div><strong>The next chapter</strong><span>Example conversation · fictional</span></div>
      </div>
      <div ref={thread} tabIndex={0} className="circle-thread" role="region" aria-label="Fictional example Circle conversation" aria-live="polite" aria-relevant="additions">
        {beat >= 1 && <motion.div {...enter} className="circle-message">
          <span className="message-author">Maya · shared with your Circle</span>
          <p>Just interviewed at ExampleCo. They asked: “How would you debug a service that gets slower as traffic grows?”</p>
        </motion.div>}
        {beat >= 2 && <motion.div {...enter} className="circle-message from-agent">
          <span className="message-author">Your agent</span>
          <p>Maya’s tip could help with your interview. Want to practice that question together?</p>
        </motion.div>}
      </div>
    </div>
    <div className="circle-story-end">
      <motion.div {...enter}>
        <Link href="/circles/" className="circle-invitation">
          <CirclePeople />
          <span><strong>Better with company.</strong><span>Find your Circle</span></span>
          <Icon />
        </Link>
      </motion.div>
    </div>
    <Quiet onClick={onLater}>I’ll do this later</Quiet>
  </>;
}
