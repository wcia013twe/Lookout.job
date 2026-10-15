"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { MotionConfig, motion } from "framer-motion";
import { streak } from "../lib/progress.mjs";
import { usePathname } from "next/navigation";
import { useWorkspace } from "../lib/workspace";
import { secondary, Notice } from "./ui";
import ColorModeControl from "./color-mode";
import ProfileMenu from "./profile-menu";
import { demoNeedsYouTasks } from "../lib/demo.mjs";

const navigation = [
  ["/needs-you/", "Needs you", "needs"],
  ["/", "Discover", "discover"],
  ["/applications/", "Applications", "applications"],
  ["/referrals/", "Referrals", "referrals"],
] as const;

function NavIcon({ name }: { name: (typeof navigation)[number][2] }) {
  const paths = {
    needs: <><path d="M12 3a7 7 0 0 0-7 7c0 5-2 6-2 6h18s-2-1-2-6a7 7 0 0 0-7-7Z"/><path d="M10 20h4"/></>,
    discover: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4M11 8v6M8 11h6"/></>,
    applications: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    referrals: <><circle cx="8" cy="8" r="3"/><circle cx="17" cy="16" r="3"/><path d="M10.5 9.5 14.5 14M5 20c0-3 2-5 5-5"/></>,
  };
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
export default function AppShell({ children }: { children: ReactNode }) {
  const w = useWorkspace(),
    path = usePathname();
  const isCurrent = (href: string) => path === href || path === href.slice(0, -1) || (href === "/" && /^\/discover\/?$/.test(path));
  const apps = Object.values(w.state?.workflow?.applications || {}) as Array<{ status: string; submissionAttempts?: Array<{ state: string; startedAt: string }> }>;
  const needs = w.demo ? demoNeedsYouTasks.length :
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
      : 0);
  if (/\/onboarding\/?$/.test(path)) {
    return <main className="min-h-dvh bg-board-bg">{w.state ? <div key={w.user?.id || "guest"} inert={w.locked || undefined}>{children}</div> : <div className="grid min-h-dvh place-items-center"><Notice>Loading your workspace…</Notice></div>}</main>;
  }
  return (
    <MotionConfig reducedMotion="user"><main className={`workspace-shell ${/^\/applications\/?$/.test(path) ? "tracker-workspace" : ""} mx-auto min-h-dvh max-w-6xl px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-4 md:px-6 md:py-8`} onClickCapture={event=>{
        if(!w.demo)return;
        const target = event.target as HTMLElement;
        if(target instanceof HTMLInputElement && target.type==='file'){event.preventDefault();return;}
        const anchor=target.closest<HTMLAnchorElement>('a');
        if(anchor && new URL(anchor.href,location.href).origin!==location.origin)event.preventDefault();
      }}>
      <header className="workspace-header flex items-start justify-between gap-3 md:flex-wrap md:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <ProfileMenu />
          <div className="min-w-0">
          <Link href="/" className="workspace-brand inline-flex min-h-11 items-center gap-2 text-lg font-bold md:gap-2.5 md:text-xl">
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 3 24 9v10l-10 6-10-6V9L14 3Z" stroke="currentColor" strokeWidth="1.5"/><path d="m9 16 5-8 5 8H9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M14 16v5" stroke="currentColor" strokeWidth="1.5"/></svg>Lookout
          </Link>
          <p className="mt-1 hidden max-w-sm text-sm text-board-muted md:block">Your personal job hunter. Your crew for what’s next.</p>
          <p className="text-xs text-board-muted md:mt-1">Last scan: {w.date}</p>
          </div>
        </div>
        <div className="hidden flex-wrap items-start gap-2 md:flex"><ColorModeControl /><details className="text-sm">
          <summary className={`${secondary} cursor-pointer`}>
            {w.state?.progress?.xp || 0} XP ·{" "}
            {streak(w.state?.progress?.streakDays)}d streak
          </summary>
          <p className="mt-3 max-w-xs text-sm text-board-muted">
            Browser progress is separate from account leaderboard metrics.
          </p>
          <Link href="/progress/" className="mt-2 inline-flex min-h-11 items-center text-board-accent">View progress &amp; leaderboard</Link>
        </details></div>
      </header>
      {w.canDemo && <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" className={secondary} aria-pressed={w.demo} onClick={w.toggleDemo}>{w.demo ? "Exit demo mode" : "Demo mode"}</button>{w.demo && <><p className="text-sm text-board-accent">Demo mode · mocked data · account records stay untouched</p><button type="button" className={secondary} onClick={w.resetDemo}>Reset demo</button></>}</div>}
      {w.status && (
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
      <nav
        aria-label="Workspace pages"
        className="workspace-nav glass-toolbar my-7 hidden grid-cols-4 gap-1 rounded-xl bg-board-tag p-1.5 md:grid"
      >
        {navigation.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={
              isCurrent(href) ? "page" : undefined
            }
            className={`relative isolate flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 py-2 text-center text-sm font-semibold ${isCurrent(href) ? "bg-board-panel text-board-accent" : "text-board-muted hover:text-board-text"}`}
          >
            {isCurrent(href) && <motion.span layoutId="workspace-active-tab" className="workspace-active-tab absolute inset-0 -z-10 rounded-lg" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
            {label}
            {href === "/needs-you/" && needs > 0 && <span className="workspace-count grid min-h-5 min-w-5 place-items-center rounded-md px-1 text-[11px] tabular-nums">{needs}</span>}
          </Link>
        ))}
      </nav>
      <nav aria-label="Workspace pages" className="workspace-mobile-nav glass-toolbar fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-board-line px-1 pt-1 md:hidden">
        {navigation.map(([href, label, icon]) => (
          <Link key={href} href={href} aria-current={isCurrent(href) ? "page" : undefined}
            className={`relative isolate flex min-h-14 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-center text-[11px] font-semibold ${isCurrent(href) ? "text-board-accent" : "text-board-muted"}`}>
            {isCurrent(href) && <motion.span layoutId="workspace-active-tab-mobile" className="workspace-active-tab absolute inset-0 -z-10 rounded-lg" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
            <span className="relative"><NavIcon name={icon} />{href === "/needs-you/" && needs > 0 && <span className="workspace-count absolute -right-3 -top-2 grid min-h-4 min-w-4 place-items-center rounded-md px-1 text-[10px] tabular-nums">{needs}</span>}</span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      {w.state ? (
        <div key={w.demo ? `demo-${w.demoEpoch}` : w.user?.id || "guest"} inert={w.locked || undefined}>
          {children}
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-6" role="status"><p className="text-sm text-board-muted">Loading your workspace…</p><div aria-hidden="true" className="mt-5 grid gap-3 sm:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="h-28 rounded-xl bg-board-tag" />)}</div></div>
      )}
    </main></MotionConfig>
  );
}
