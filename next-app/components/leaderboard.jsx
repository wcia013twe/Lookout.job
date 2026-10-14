"use client";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { Section, Field, control, primary, secondary, Notice } from "./ui";
export default function Leaderboard() {
  const w = useWorkspace();
  const [own, setOwn] = useState(null),
    [entries, setEntries] = useState([]),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false);
  const gen = useRef(0);
  async function refresh() {
    const epoch = ++gen.current,
      owner = w.user?.id;
    if (!owner) {
      setOwn(null);
      setEntries([]);
      return;
    }
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
  async function save(e) {
    e.preventDefault();
    const form = e.currentTarget,
      owner = w.user?.id;
    setBusy(true);
    try {
      const { error } = await w.client.rpc("set_leaderboard_preferences", {
        alias: form.elements.alias.value.trim(),
        opted_in: form.elements.optedIn.checked,
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
              <form
                onSubmit={save}
                key={JSON.stringify(own)}
                className="mt-5 space-y-4"
              >
                <Field label="Leaderboard alias">
                  <input
                    name="alias"
                    className={control}
                    maxLength={40}
                    required
                    defaultValue={own.alias}
                  />
                </Field>
                <label className="flex gap-3 text-sm">
                  <input
                    name="optedIn"
                    type="checkbox"
                    defaultChecked={own.opted_in}
                  />
                  Share my alias and metrics on the leaderboard
                </label>
                <button className={primary} disabled={busy}>
                  Update sharing
                </button>
              </form>
            </>
          )}
          <button className={`${secondary} mt-4`} onClick={refresh}>
            Refresh account progress
          </button>
          <ol className="mt-4 divide-y divide-board-line">
            {entries.map((e, i) => (
              <li
                key={i}
                className="flex flex-wrap justify-between gap-3 py-3 text-sm"
              >
                <strong>{e.alias}</strong>
                <span className="text-board-muted">
                  {e.xp} XP · {e.streak} day streak · {e.applications_count}{" "}
                  tracked
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      <Notice>{feedback}</Notice>
    </Section>
  );
}
