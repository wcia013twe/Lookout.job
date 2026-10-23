"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { streak } from "../lib/progress.mjs";
import ColorModeControl from "./color-mode";
import GoogleSignInButton from "./google-sign-in-button";

export default function ProfileMenu() {
  const w = useWorkspace();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const name = w.state?.workflow?.profile?.name || w.accountUser?.email || "Your profile";
  const initials = name.split(/[\s@]+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase();
  const item = "flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-board-tag focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-board-accent";

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={container} className="relative z-40 shrink-0" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button ref={trigger} type="button" aria-label="Open profile navigation" aria-expanded={open}
        aria-controls="profile-navigation" onClick={() => setOpen(!open)}
        className="grid size-11 place-items-center rounded-full border border-board-line bg-board-panel text-sm font-semibold text-board-accent hover:bg-board-tag focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-board-accent">
        {w.state?.workflow?.profile?.name || w.accountUser ? initials : <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>}
      </button>
      {open && <nav id="profile-navigation" aria-label="Profile navigation"
        className="absolute right-0 top-full mt-3 w-64 max-w-[calc(100vw-2rem)] rounded-xl bg-board-panel p-2 text-board-text shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
        <div className="px-3 py-3">
          <p className="break-words text-sm font-semibold">{name}</p>
          <p className="mt-1 break-words text-xs text-board-muted">{w.demo ? "Fictional demo profile" : w.accountUser?.email || "Saved in this browser"}</p>
        </div>
        {(w.demo || (w.user && !w.user.is_anonymous)) && <Link className={item} href="/profile/" onClick={() => setOpen(false)}>My Profile</Link>}
        <Link className={item} href="/progress/#sharing-privacy" onClick={() => setOpen(false)}>Sharing &amp; privacy</Link>
        {w.demo && <div className="mt-2 border-t border-board-line pt-2">
          <button type="button" className={item} aria-pressed={w.demo}
            onClick={() => { setOpen(false); w.toggleDemo(); }}>
            Exit demo mode
          </button>
          {w.demo && <>
            <p className="px-3 pb-1 text-xs leading-5 text-board-muted">Fictional data. Changes stay in memory.</p>
            <button type="button" className={item} onClick={() => { setOpen(false); w.resetDemo(); }}>
              Reset demo data
            </button>
          </>}
        </div>}
        <div className="mt-2 space-y-2 border-t border-board-line pt-2 md:hidden">
          <ColorModeControl compact />
          <Link className={item} href="/progress/" onClick={() => setOpen(false)}>
            Progress · {w.state?.progress?.xp || 0} XP · {streak(w.state?.progress?.streakDays)}d streak
          </Link>
        </div>
        {!w.demo && <div className="mt-2 border-t border-board-line pt-2">
          {w.accountUser ? <button type="button" className={item} disabled={!w.authReady} onClick={()=>{setOpen(false);w.signOut();}}>Sign out</button> : <GoogleSignInButton className="w-full" disabled={!w.authReady} onClick={()=>{setOpen(false);w.signIn();}}/>}
        </div>}
      </nav>}
    </div>
  );
}
