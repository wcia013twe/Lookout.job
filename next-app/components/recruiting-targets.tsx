"use client";
import { useWorkspace } from "../lib/workspace";
import { useApplicationProfile } from "./application-profile-context";
import {
  recruitingTargetsHeading,
  recruitingTargetsKey,
  parseRecruitingTargets,
} from "../../lib/recruiting-targets.mjs";
import { Field, control, secondary } from "./ui";
import ProfileSection, { ProfileValues } from "./profile-section";
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
    <ProfileSection title="Resume assignments & role targets" resetKey={a.profile.id} disabled={a.busy || !!error}>
      {editing => <>
      {editing && <div className="mb-5 flex justify-end">
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
          }}
        >
          Add assignment
        </button>
      </div>}
      <p className="mt-2 mb-4 max-w-prose text-sm text-board-muted">
        Connect one or more job titles and a job type to a resume for {a.profile.name}.
        A blank resume uses your fallback. If different resumes match, your agent should ask you to choose.
        Job titles match phrases, ignoring case and punctuation. Job type must also match. Additional conditions or timelines need review. These assignments guide preparation; they do not authorize submission.
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
            <div key={t.id} className="py-5 first:pt-0 last:pb-0">
              <h4 className="mb-4 text-base font-semibold">{t.name || "Unnamed target"}</h4>
              {editing ? <>
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
                      {w.state.workflow.resumes.filter((r:{supersededBy?:string})=>!r.supersededBy).map(
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
              </> : <ProfileValues items={[
                {label:"Job titles & specializations",value:t.roles},
                {label:"Job type",value:t.employment || "Use profile job types"},
                {label:"Resume",value:t.resumeId ? w.state.workflow.resumes.find((r:{id:string;name:string})=>r.id===t.resumeId)?.name || "Selected resume unavailable" : "Use profile fallback"},
                {label:"Search status",value:t.active ? "Active" : "Paused"},
                {label:"Timing",value:t.timeline},
                {label:"Additional conditions",value:t.conditions,wide:true},
              ]}/>}
            </div>
          ))}
        </div>
      )}
      </>}
    </ProfileSection>
  );
}
