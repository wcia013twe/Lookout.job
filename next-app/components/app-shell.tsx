"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { streak } from "../lib/progress.mjs";
import { usePathname } from "next/navigation";
import { useWorkspace } from "../lib/workspace";
import { secondary, Notice } from "./ui";
import ColorModeControl from "./color-mode";
import ProfileMenu from "./profile-menu";
import { demoNeedsYouTasks } from "../lib/demo.mjs";

const navigation = [
  ["/needs-you/", "Action board", "needs"],
  ["/", "Discover", "discover"],
  ["/applications/", "Applications", "applications"],
  ["/referrals/", "Referrals", "referrals"],
  ["/circles/", "Circles", "circles"],
] as const;

export default function AppShell({ children }: { children: ReactNode }) {
  const w = useWorkspace(),
    path = usePathname();
  const isCurrent = (href: string) => path === href || path === href.slice(0, -1) || (href === "/" && /^\/discover\/?$/.test(path));
  const apps = Object.values(w.state?.workflow?.applications || {}) as Array<{ status: string; submissionAttempts?: Array<{ state: string; startedAt: string }> }>;
  const needs = (w.demo ? demoNeedsYouTasks.length :
    apps.filter(
      (a) =>
        a.status === "Blocked" ||
        a.status === "Awaiting approval" ||
        (w.models?.workflowModel?.canEdit(a) &&
          (a.submissionAttempts || []).some(
            (t) =>
              t.state === "uncertain" ||
              (t.state === "started" &&
                Date.parse(t.startedAt) < Date.now() - 300000),
          )),
    ).length +
    (!w.state?.workflow?.profile?.verified ||
    !w.state?.workflow?.resumes?.length
      ? 1
      : 0));
  if (/\/onboarding\/?$/.test(path)) {
    return <main className="min-h-dvh bg-board-bg">{w.state ? <div key={w.user?.id || "guest"} inert={w.locked || undefined}>{children}</div> : <div className="grid min-h-dvh place-items-center"><Notice>Loading your workspace…</Notice></div>}</main>;
  }
  return (
    <MotionConfig reducedMotion="user"><main className={`workspace-shell min-h-dvh`} onClickCapture={event=>{
        if(!w.demo)return;
        const target = event.target as HTMLElement;
        if(target instanceof HTMLInputElement && target.type==='file'){event.preventDefault();return;}
        const anchor=target.closest<HTMLAnchorElement>('a');
        if(anchor && new URL(anchor.href,location.href).origin!==location.origin)event.preventDefault();
      }}>
      <div className="workspace-container mx-auto w-full max-w-6xl px-4 pb-8 pt-4 md:px-6">
      <header className="workspace-header workspace-topbar">
        <div className="workspace-identity min-w-0">
          <div className="min-w-0">
          <Link href="/" className="workspace-brand inline-flex min-h-11 items-center gap-2 text-lg font-bold md:gap-2.5 md:text-xl">
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 3 24 9v10l-10 6-10-6V9L14 3Z" stroke="currentColor" strokeWidth="1.5"/><path d="m9 16 5-8 5 8H9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M14 16v5" stroke="currentColor" strokeWidth="1.5"/></svg>Lookout
          </Link>
          <p className="workspace-scan text-xs text-board-muted">Last scan: {w.date}</p>
          </div>
        </div>
      <nav
        aria-label="Workspace pages"
        className="workspace-nav flex-wrap"
      >
        {navigation.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={
              isCurrent(href) ? "page" : undefined
            }
            className="workspace-nav-link"
          >
            <span>{label}</span>
            {href === "/needs-you/" && needs > 0 && <span className="workspace-count grid min-h-5 min-w-5 place-items-center rounded-md px-1 text-[11px] tabular-nums">{needs}</span>}
          </Link>
        ))}
      </nav>
        <div className="workspace-utilities"><div className="workspace-desktop-utilities"><ColorModeControl /><details className="workspace-progress text-sm">
          <summary className="workspace-progress-trigger">
            {w.state?.progress?.xp || 0} XP ·{" "}
            {streak(w.state?.progress?.streakDays)}d streak
          </summary>
          <div className="workspace-progress-menu"><p className="text-sm text-board-muted">
            Browser progress is separate from account leaderboard metrics.
          </p>
          <Link href="/progress/" className="mt-2 inline-flex min-h-11 items-center text-board-accent">View progress &amp; leaderboard</Link></div>
        </details></div><ProfileMenu /></div>
      </header>
      {w.status && !w.demo && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-board-muted">
          <span role="status">{w.status}</span>
          {w.user && (
            <>
              <button
                className={secondary}
                onClick={w.retry}
                disabled={w.locked}
              >
                Retry sync
              </button>
              <button
                className={secondary}
                onClick={w.reload}
                disabled={w.locked}
              >
                Load account
              </button>
            </>
          )}
        </div>
      )}
      {w.error && <Notice>{w.error}</Notice>}
      {w.state ? (
        <div key={w.demo ? `demo-${w.demoEpoch}` : w.user?.id || "guest"} inert={w.locked || undefined}>
          {children}
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-6" role="status"><p className="text-sm text-board-muted">Loading your workspace…</p><div aria-hidden="true" className="mt-5 grid gap-3 sm:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="h-28 rounded-xl bg-board-tag" />)}</div></div>
      )}
      </div>
    </main></MotionConfig>
  );
}
