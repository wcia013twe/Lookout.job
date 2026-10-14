"use client";

import type { ReactNode } from "react";
import styles from "./profile-surface.module.css";

/** Shared profile and outreach frame; deliberately excludes the setup experience. */
export default function ProfileSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.surface} ${className}`}>{children}</div>;
}

export function ProfilePanel({ children, panelKey }: { children: ReactNode; panelKey: string }) {
  return <div key={panelKey} className={styles.panel}>{children}</div>;
}

export { styles as profileStyles };
