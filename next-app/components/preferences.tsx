"use client";
import type { ResumeRecord } from "./profile-types";
import SearchProfiles from "./search-profiles";
import ProfileAutomation from "./profile-automation";
import { useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { Section, Field, control, Notice } from "./ui";
export default function Preferences({
  showDefaultResume = true,
  mode = "all",
}: {
  showDefaultResume?: boolean;
  mode?: "all" | "search" | "agent";
}) {
  const w = useWorkspace(),
    p = w.state.workflow.searchPreferences || {};
  const [feedback, setFeedback] = useState("");
  function patch(fields: Record<string, unknown>) {
    w.store.set("workflow.searchPreferences", { ...p, ...fields });
    setFeedback(
      w.user
        ? "Preference saved. Syncing for Muse."
        : "Preference saved in this browser. Sign in to share it with Muse.",
    );
  }
  return (
    <>
      {mode !== "search" && (
        <>
          <ProfileAutomation />
          <Notice>{feedback}</Notice>
          {showDefaultResume && <Section title="Default submission resume">
            <Field label="Default private PDF resume"><select className={control} value={p.defaultResumeId||""} onChange={e=>patch({defaultResumeId:e.target.value||null})}><option value="">Choose a private uploaded PDF</option>{w.state.workflow.resumes.filter((r:ResumeRecord)=>/\.pdf$/i.test(r.objectPath||"")&&r.contentHash).map((r:ResumeRecord)=><option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
          </Section>}

        </>
      )}
      {mode !== "agent" && (
        <>
          <SearchProfiles />
        </>
      )}
    </>
  );
}
