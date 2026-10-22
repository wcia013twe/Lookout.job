"use client";
import { useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { useApplicationProfile } from "./application-profile-context";
import {
  recruitingTargetsHeading,
  recruitingTargetsKey,
  parseRecruitingTargets,
} from "../../lib/recruiting-targets.mjs";
import { Field, control, secondary } from "./ui";
type Target = {
  id: string;
  name: string;
  active: boolean;
  roles: string;
  timeline: string;
  employment?: string;
  resumeId: string;
  conditions: string;
};
export default function RecruitingTargets() {
  const w = useWorkspace(),
    a = useApplicationProfile();
  const [opened, setOpened] = useState<string | null>(null);
  const field = a.field(recruitingTargetsHeading, recruitingTargetsKey);
  let targets: Target[] = [],
    error = "";
  try {
    if (field.conflict)
      throw Error("Resolve duplicate Targets fields in Advanced instructions.");
    targets = parseRecruitingTargets(field.value);
  } catch (e) {
    error =
      e instanceof Error ? e.message : "Could not read recruiting targets.";
  }
  function save(next: Target[]) {
    a.change(
      recruitingTargetsHeading,
      recruitingTargetsKey,
      next.length ? JSON.stringify(next) : "",
    );
  }
  function patch(id: string, fields: Partial<Target>) {
    save(targets.map((t) => (t.id === id ? { ...t, ...fields } : t)));
  }
  return (
    <section
      className="mt-7 border-t border-board-line pt-6"
      aria-labelledby="recruiting-targets-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="recruiting-targets-heading" className="text-lg font-semibold">
          Resume assignments &amp; role targets
        </h3>
        <button
          type="button"
          className={secondary}
          disabled={!!error || a.busy || targets.length >= 30}
          onClick={() => {
            const id = crypto.randomUUID();
            save([
              ...targets,
              {
                id,
                name: "New target",
                active: true,
                roles: "",
                timeline: "",
                employment: "",
                resumeId: "",
                conditions: "",
              },
            ]);
            setOpened(id);
          }}
        >
          Add assignment
        </button>
      </div>
      <p className="mt-2 mb-4 max-w-prose text-sm text-board-muted">
        Connect one or more job titles and a job type to a resume for {a.profile.name}.
        A blank resume uses your fallback. If different resumes match, your agent should ask you to choose.
        These assignments guide preparation; they do not authorize submission.
      </p>
      {error ? (
        <p role="alert" className="text-sm">
          {error}
        </p>
      ) : !targets.length ? (
        <p className="text-sm text-board-muted">
          No role-specific resumes yet. Your fallback applies until you add an assignment.
        </p>
      ) : (
        <div className="divide-y divide-board-line">
          {targets.map((t) => (
            <details
              key={t.id}
              open={opened === t.id}
              onToggle={(e) => {
                if (e.currentTarget.open) setOpened(t.id);
                else if (opened === t.id) setOpened(null);
              }}
              className="py-3"
            >
              <summary className="font-semibold">
                {t.name || "Unnamed target"}
                <span className="ml-3 text-xs font-normal text-board-muted">
                  {[
                    t.active ? "Active" : "Paused",
                    t.roles,
                    t.employment || "Any job type",
                    t.timeline,
                    w.state.workflow.resumes.find(
                      (r: { id: string; name: string }) => r.id === t.resumeId,
                    )?.name,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </summary>
              <div className="mt-3 grid gap-5 sm:grid-cols-2">
                <Field label="Target name">
                  <input
                    className={control}
                    value={t.name}
                    maxLength={80}
                    disabled={a.busy}
                    onChange={(e) => patch(t.id, { name: e.target.value })}
                  />
                </Field>
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={t.active}
                    disabled={a.busy}
                    onChange={(e) => patch(t.id, { active: e.target.checked })}
                  />
                  Include this target in searches
                </label>
                <Field label="Job titles & specializations">
                  <input
                    className={control}
                    value={t.roles}
                    disabled={a.busy}
                    placeholder="Backend SWE, ML infrastructure…"
                    onChange={(e) => patch(t.id, { roles: e.target.value })}
                  />
                </Field>
                <Field label="Job type">
                  <select className={control} value={t.employment || ""} disabled={a.busy} onChange={e => patch(t.id, {employment:e.target.value})}>
                    <option value="">Use profile job types</option>
                    {["Full-time", "Internship", "Part-time", "Contract", "Temporary"].map(type => <option key={type}>{type}</option>)}
                  </select>
                </Field>
                <Field label="Target timing">
                  <input
                    className={control}
                    value={t.timeline}
                    disabled={a.busy}
                    placeholder="After graduation, Summer 2027…"
                    onChange={(e) => patch(t.id, { timeline: e.target.value })}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Resume for these roles">
                    <select
                      className={control}
                      value={t.resumeId}
                      disabled={a.busy}
                      onChange={(e) =>
                        patch(t.id, { resumeId: e.target.value })
                      }
                    >
                      <option value="">
                        Use this profile’s preferred resume
                      </option>
                      {t.resumeId &&
                        !w.state.workflow.resumes.some(
                          (r: { id: string }) => r.id === t.resumeId,
                        ) && (
                          <option value={t.resumeId}>
                            Selected resume unavailable
                          </option>
                        )}
                      {w.state.workflow.resumes.map(
                        (r: { id: string; name: string }) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Additional conditions">
                    <textarea
                      rows={3}
                      className={control}
                      value={t.conditions}
                      disabled={a.busy}
                      placeholder="Team scope, locations, compensation, or tradeoffs specific to this target."
                      onChange={(e) =>
                        patch(t.id, { conditions: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </div>
              <button
                type="button"
                className={`${secondary} mt-4`}
                disabled={a.busy}
                onClick={() => save(targets.filter((v) => v.id !== t.id))}
              >
                Remove assignment
              </button>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
