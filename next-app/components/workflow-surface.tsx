"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

// Preparation expands in place so the role and its controls remain in view.
export function PreparationDisclosure({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={reducedMotion ? false : { height: 0, filter: "blur(2px)" }}
      animate={{ height: "auto", filter: "blur(0px)" }}
      exit={{ height: 0, filter: reducedMotion ? "blur(0px)" : "blur(2px)" }}
      transition={{ duration: reducedMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      {children}
    </motion.div>
  );
}

export function ApplicationStatus({ status, children }: { status: string; children?: ReactNode }) {
  const tone = status === "Blocked" || status === "Awaiting approval"
    ? "text-amber-200 bg-amber-200/8"
    : status === "Offer" || status === "Submitted"
      ? "text-emerald-200 bg-emerald-200/8"
      : "text-board-accent bg-board-accent/8";
  return <span className={`inline-flex max-w-full flex-wrap items-center gap-x-1 rounded-md px-2 py-1 text-xs leading-relaxed ${tone}`}>{status}{children}</span>;
}
