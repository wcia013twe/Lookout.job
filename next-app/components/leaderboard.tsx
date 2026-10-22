"use client";
import SurfacePanel from "./surface-panel";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { Section, Field, control, primary, secondary, Notice } from "./ui";
import type { FormEvent } from "react";
import type { LeaderboardEntry } from "./workflow-types";
export default function Leaderboard() {
  const w = useWorkspace();
  const [own, setOwn] = useState<(LeaderboardEntry & { opted_in: boolean; user_id: string }) | null>(null),
    [entries, setEntries] = useState<LeaderboardEntry[]>([]),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const gen = useRef(0);
  async function refresh() {
    const epoch = ++gen.current,
      owner = w.user?.id;
    if (!owner) {
      setOwn(null);
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await w.client.rpc("refresh_leaderboard");
      if (response.error) throw response.error;
      const current = Array.isArray(response.data)
        ? response.data[0]
        : response.data;
      if (!current || current.user_id !== owner)
        throw Error("Account changed.");
      const list = await w.client
        .from("leaderboard_entries")
        .select("alias,xp,streak,applications_count")
        .eq("opted_in", true)
        .order("xp", { ascending: false })
        .order("alias")
        .limit(50);
      if (list.error) throw list.error;
      if (epoch !== gen.current || window.JB.auth.userId !== owner) return;
      setOwn(current);
      setEntries(list.data || []);
      setFeedback("");
    } catch {
      if (epoch === gen.current)
        setFeedback("Account progress is unavailable. Retry when connected.");
    } finally {
      if (epoch === gen.current) setLoading(false);
    }
  }
  useEffect(() => {
    setOwn(null);
    setEntries([]);
    refresh();
    return () => {
      gen.current++;
    };
  }, [w.user?.id]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      owner = w.user?.id;
    setBusy(true);
    try {
      const formData = new FormData(form);
      const { error } = await w.client.rpc("set_leaderboard_preferences", {
        alias: String(formData.get("alias") || "").trim(),
        opted_in: formData.has("optedIn"),
      });
      if (error) throw error;
      if (window.JB.auth.userId !== owner) return;
      await refresh();
    } catch {
      setFeedback(
        "Sharing settings could not save. Your change is not published.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section title="Progress & leaderboard">
      <p className="text-sm text-board-muted">
        Participation is optional. Share only an alias and aggregate metrics;
        profile, resumes, jobs, and answers stay private.
      </p>
      {!w.user ? (
        <Notice>
          Sign in to track account progress. Guest XP stays in this browser.
        </Notice>
      ) : (
        <>
          {own && (
            <>
              <Notice>
                {own.xp} account XP · {own.streak} day streak ·{" "}
                {own.applications_count} applications tracked
              </Notice>
              <SurfacePanel
                as="form"
                aria-label="Sharing and privacy"
                onSubmit={save}
                key={JSON.stringify(own)}
                className="mt-5 max-w-xl space-y-4"
              >
                <h3 className="text-base font-semibold">Sharing &amp; privacy</h3>
                <Field label="Leaderboard alias">
                  <input
                    name="alias"
                    className={control}
                    maxLength={40}
                    required
                    defaultValue={own.alias}
                  />
                </Field>
                <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed">
                  <input
                    name="optedIn"
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0 accent-board-accent"
                    defaultChecked={own.opted_in}
                  />
                  Share my alias and metrics on the leaderboard
                </label>
                <button className={primary} disabled={busy}>
                  {busy ? "Saving sharing…" : "Update sharing"}
                </button>
              </SurfacePanel>
            </>
          )}
          <button className={`${secondary} mt-4`} disabled={loading || busy} onClick={refresh}>
            {loading ? "Refreshing progress…" : "Refresh account progress"}
          </button>
          <ol className="glass-panel mt-4 divide-y divide-board-line rounded-2xl px-4 sm:px-5" aria-busy={loading}>
            {entries.map((e, i) => (
              <li
                key={i}
                className="flex flex-wrap justify-between gap-3 py-3 text-sm"
              >
                <strong className="min-w-0 break-words">{e.alias}</strong>
                <span className="tabular-nums text-board-muted">
                  {e.xp} XP · {e.streak} day streak · {e.applications_count}{" "}
                  tracked
                </span>
              </li>
            ))}
          </ol>
          {!loading && own && !entries.length && <Notice>No public entries yet. Sharing your progress is optional.</Notice>}
        </>
      )}
      <Notice>{feedback}</Notice>
    </Section>
  );
}
