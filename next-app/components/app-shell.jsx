"use client";
import Link from "next/link";
import { streak } from "../lib/progress.mjs";
import { usePathname } from "next/navigation";
import { useWorkspace } from "../lib/workspace";
import { secondary, Notice } from "./ui";
export default function AppShell({ children }) {
  const w = useWorkspace(),
    path = usePathname();
  const apps = Object.values(w.state?.workflow?.applications || {});
  const needs =
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
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-xl font-bold">
            Job signal board
          </Link>
          <p className="mt-1 text-xs text-board-muted">Last scan: {w.date}</p>
        </div>
        <details className="text-sm">
          <summary className={`${secondary} cursor-pointer`}>
            {w.state?.progress?.xp || 0} XP ·{" "}
            {streak(w.state?.progress?.streakDays)}d streak
          </summary>
          <p className="mt-3 max-w-xs text-sm text-board-muted">
            Browser progress is separate from account leaderboard metrics.
          </p>
        </details>
      </header>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-board-muted">
          {w.accountUser
            ? `Signed in as ${w.accountUser.email || "your Google account"}`
            : "Browse jobs without an account. Your workspace is saved in this browser."}
        </p>
        <button
          className={secondary}
          disabled={!w.authReady}
          onClick={w.accountUser ? w.signOut : w.signIn}
        >
          {w.accountUser ? "Sign out" : "Sign in with Google"}
        </button>
      </div>
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
        className="my-6 grid grid-cols-3 gap-1 rounded-xl bg-board-tag p-1 sm:grid-cols-5"
      >
        {[
          ["/needs-you/", "Needs you"],
          ["/", "Discover"],
          ["/applications/", "Applications"],
          ["/referrals/", "Referrals"],
          ["/profile/", "Profile"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={
              path === href || path === href.slice(0, -1) ? "page" : undefined
            }
            className={`flex min-h-11 items-center justify-center rounded-lg px-2 py-2 text-center text-sm font-bold ${path === href || path === href.slice(0, -1) ? "bg-board-panel text-board-accent" : "text-board-muted hover:text-board-text"}`}
          >
            {label}
            {href === "/needs-you/" && needs > 0 ? ` ${needs}` : ""}
          </Link>
        ))}
      </nav>
      {w.state ? (
        <div key={w.demo ? `demo-${w.demoEpoch}` : w.user?.id || "guest"} inert={w.locked || undefined}>
          {children}
        </div>
      ) : (
        <Notice>Loading your workspace…</Notice>
      )}
    </main>
  );
}
