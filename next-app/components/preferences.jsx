"use client";
import { useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { Section, Field, control, primary, Notice } from "./ui";
export default function Preferences() {
  const w = useWorkspace(),
    p = w.state.workflow.searchPreferences || {};
  const [feedback, setFeedback] = useState("");
  function patch(fields) {
    w.store.set("workflow.searchPreferences", { ...p, ...fields });
    setFeedback(
      w.user
        ? "Preference saved. Syncing for Muse."
        : "Preference saved in this browser. Sign in to share it with Muse.",
    );
  }
  function policy(key, fields) {
    patch({
      reviewPolicy: {
        ...p.reviewPolicy,
        [key]: { ...p.reviewPolicy?.[key], ...fields },
      },
    });
  }
  function save(e) {
    e.preventDefault();
    const f = e.currentTarget;
    const types = ["FT", "Internship"].filter(
      (_, i) => f.elements[i ? "internship" : "fullTime"].checked,
    );
    if (!types.length) {
      setFeedback("Choose at least one role type.");
      return;
    }
    const fields = {
      employmentTypes: types,
      targetYear: f.elements.targetYear.value
        ? Number(f.elements.targetYear.value)
        : null,
    };
    for (const key of ["locations", "categories", "excludedCompanies"])
      fields[key] = [
        ...new Set(
          f.elements[key].value
            .split("\n")
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      ];
    patch(fields);
  }
  return (
    <>
      <Section title="Application automation">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 accent-board-accent"
            checked={p.autoSubmitApproved === true}
            onChange={(e) => patch({ autoSubmitApproved: e.target.checked })}
          />
          Auto-apply routine matches
        </label>
        <p className="mt-3 text-sm text-board-muted">
          Important matches, missing facts, unfamiliar answers, and uncertain
          outcomes require review. Submission needs a connected supported
          runner.
        </p>
        <div className="mt-5 space-y-5">
          {[
            ["fullTime", "FT", "Full-time"],
            ["internship", "Internship", "Internships"],
          ].map(([key, type, label]) => (
            <div key={key} className="grid gap-3 sm:grid-cols-2">
              <Field label={`${label} company list`}>
                <select
                  className={control}
                  value={p.reviewPolicy?.[key]?.tierListId || ""}
                  onChange={(e) =>
                    policy(key, { tierListId: e.target.value || null })
                  }
                >
                  <option value="">Automatic (one matching list)</option>
                  {w.state.workflow.tierLists
                    .filter(
                      (l) => !l.employmentType || l.employmentType === type,
                    )
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label={`${label} review threshold`}>
                <select
                  className={control}
                  value={p.reviewPolicy?.[key]?.threshold || "A"}
                  onChange={(e) => policy(key, { threshold: e.target.value })}
                >
                  {["S", "A", "B", "C", "D", "all"].map((t) => (
                    <option value={t} key={t}>
                      {t === "all"
                        ? "Review every match"
                        : `${t} tier and above`}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ))}
          <Field label="Default private PDF resume">
            <select
              className={control}
              value={p.defaultResumeId || ""}
              onChange={(e) =>
                patch({ defaultResumeId: e.target.value || null })
              }
            >
              <option value="">Choose a private uploaded PDF</option>
              {w.state.workflow.resumes
                .filter(
                  (r) => /\.pdf$/i.test(r.objectPath || "") && r.contentHash,
                )
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>
      </Section>
      <Section title="Search preferences">
        <form
          key={JSON.stringify(p) + w.user?.id}
          onSubmit={save}
          className="space-y-4"
        >
          <div className="flex flex-wrap gap-5 text-sm">
            <label>
              <input
                className="mr-2"
                type="checkbox"
                name="fullTime"
                defaultChecked={
                  !p.employmentTypes || p.employmentTypes.includes("FT")
                }
              />
              Full-time
            </label>
            <label>
              <input
                className="mr-2"
                type="checkbox"
                name="internship"
                defaultChecked={
                  !p.employmentTypes || p.employmentTypes.includes("Internship")
                }
              />
              Internships
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["locations", "Locations"],
              ["categories", "Focus areas"],
              ["excludedCompanies", "Excluded companies"],
            ].map(([key, label]) => (
              <Field label={`${label} (one per line)`} key={key}>
                <textarea
                  name={key}
                  className={control}
                  defaultValue={(Array.isArray(p[key]) ? p[key] : []).join(
                    "\n",
                  )}
                />
              </Field>
            ))}
            <Field label="Target year">
              <input
                className={control}
                name="targetYear"
                type="number"
                min="2020"
                max="2100"
                defaultValue={p.targetYear || ""}
              />
            </Field>
          </div>
          <button className={primary}>Save search preferences</button>
        </form>
        <Notice>{feedback}</Notice>
      </Section>
    </>
  );
}
