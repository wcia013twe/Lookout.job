"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createBackend } from "../../backend/client.mjs";
import { useWorkspace } from "../lib/workspace";
import { control, secondary, Notice, Section } from "./ui";

type Decision = { id: string; job_id: string; reason?: unknown; preference?: unknown; evidence?: unknown; certainty?: unknown; reconsidered_at?: string; jobs?: { canonical_url?: string; employer?: string | { company?: string } } };
type Workspace = ReturnType<typeof useWorkspace>;
const preferenceLabels: Record<string, string> = { excludedCompanies: "Excluded companies", employmentTypes: "Role types", locations: "Locations", categories: "Role categories", targetYear: "Graduation year", fit: "Fit assessment" };

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join("; ");
  if (value && typeof value === "object") return Object.entries(value).map(([key, item]) => `${key}: ${text(item)}`).join("; ");
  return value == null ? "" : String(value);
}
function postingUrl(value?: string) {
  try { const url = new URL(value || ""); return ["https:", "http:"].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

function Decisions({ workspace: w }: { workspace: Workspace }) {
  const [rows, setRows] = useState<Decision[]>([]), [loading, setLoading] = useState(true),
    [error, setError] = useState(""), [attempt, setAttempt] = useState(0),
    [reason, setReason] = useState(""), [pending, setPending] = useState<string[]>([]),
    [feedback, setFeedback] = useState("");
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    let current = true;
    setLoading(true); setError("");
    (w.services || createBackend(w.client, w.user.id)).readSelectionDecisions()
      .then((result: Decision[]) => { if (current) setRows(result); })
      .catch(() => { if (current) setError("Skipped roles could not be loaded. Try again."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; alive.current = false; };
  }, [w.client, w.user?.id, w.services, attempt]);
  async function reconsider(id: string) {
    setPending((items) => [...items, id]); setFeedback("");
    try {
      const selected = rows.find((row) => row.id === id);
      const saved = await (w.services || createBackend(w.client, w.user.id)).reconsiderSelection(id, selected?.reconsidered_at || "");
      if (!alive.current) return;
      setRows((items) => items.map((row) => row.id === id ? { ...row, reconsidered_at: saved.reconsidered_at } : row));
      setFeedback(w.demo ? "Demo role marked for reconsideration. Reset the demo to try again." : "Marked for Muse to reconsider on its next run.");
    } catch {
      if (alive.current) setFeedback("Could not request reconsideration. Try again.");
    } finally {
      if (alive.current) setPending((items) => items.filter((item) => item !== id));
    }
  }
  if (loading) return <Notice>Loading skipped roles…</Notice>;
  if (error) return <div><Notice>{error}</Notice><button className={`${secondary} mt-3`} onClick={() => setAttempt((n) => n + 1)}>Retry</button></div>;
  if (!rows.length) return <Notice>Muse has not recorded any skipped roles yet.</Notice>;
  const reasons = [...new Set(rows.map((row) => text(row.reason)).filter(Boolean))];
  const groups = new Map<string, Decision[]>();
  for (const row of rows.filter((item) => !reason || text(item.reason) === reason)) {
    const label = text(row.preference) || "Other selection decisions";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(row);
  }
  return <>
    <label className="mt-4 block max-w-sm text-sm text-board-muted">
      <span className="mb-2 block">Filter by skip reason</span>
      <select className={control} value={reason} onChange={(e) => setReason(e.target.value)}>
        <option value="">All reasons</option>
        {reasons.map((item) => <option key={item}>{item}</option>)}
      </select>
    </label>
    <Notice>{feedback}</Notice>
    {[...groups].map(([preference, decisions]) => <div key={preference} className="mt-6">
      <h3 className="break-words font-semibold">{preferenceLabels[preference] || preference}</h3>
      <ul className="mt-3 divide-y divide-board-line">
        {decisions.map((row) => {
          const role = w.roles.find((item: { id: string; company: string; title: string }) => item.id === row.job_id);
          const url = postingUrl(row.jobs?.canonical_url);
          return <li key={row.id} className="py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold">{(typeof row.jobs?.employer === "string" ? row.jobs.employer : row.jobs?.employer?.company) || role?.company || "Opportunity"}{role?.title ? ` · ${role.title}` : ""}</p>
                <p className="mt-2 break-words text-sm text-board-muted">{text(row.reason)}</p>
              </div>
              <button className={secondary} disabled={Boolean(row.reconsidered_at) || pending.includes(row.id)} onClick={() => reconsider(row.id)}>
                {row.reconsidered_at ? "Reconsideration requested" : pending.includes(row.id) ? "Requesting…" : "Reconsider"}
              </button>
            </div>
            <details className="glass-inset mt-3 rounded-xl px-4 pb-4 text-sm">
              <summary className="min-h-11 cursor-pointer py-3 text-board-accent">Why Muse skipped this role</summary>
              <p className="break-words text-board-muted">{text(row.evidence) || "No additional evidence recorded."}</p>
              <p className="mt-2 text-board-muted">{row.certainty === "exclusion" ? "Matched an explicit preference exclusion." : "An uncertain fit assessment; verify the posting before excluding it."}</p>
              {url && <a className="mt-3 inline-flex min-h-11 items-center text-board-accent hover:underline" href={url} onClick={(event) => { if (w.demo) event.preventDefault(); }} target="_blank" rel="noopener noreferrer">Source posting{w.demo ? " (demo)" : ""}</a>}
            </details>
          </li>;
        })}
      </ul>
    </div>)}
  </>;
}

function SkippedPanel({ workspace: w }: { workspace: Workspace }) {
  const [open, setOpen] = useState(false);
  return <Section title="Skipped opportunities">
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-board-accent">See what Muse skipped and why</summary>
      <p className="mt-2 max-w-prose text-sm text-board-muted">Review the preferences behind these decisions. Reconsider asks Muse to review a role again under your application policy.</p>
      <Link href={w.demo ? "/profile/?demo=1" : "/profile/"} className="mt-2 inline-flex min-h-11 items-center text-sm text-board-accent hover:underline">Adjust search preferences</Link>
      {open && (w.demo || (w.user && w.client) ? <Decisions workspace={w} /> : <Notice>Sign in to review your private selection decisions.</Notice>)}
    </details>
  </Section>;
}

export default function SkippedOpportunities() {
  const w = useWorkspace();
  return <SkippedPanel key={w.demo ? "demo" : w.user?.id || "guest"} workspace={w} />;
}
