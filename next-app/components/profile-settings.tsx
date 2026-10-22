"use client";
import { useState } from "react";
import {
  eligibilityHeading,
  countryEligibilityFields,
  setEligibilityCountry,
} from "../../lib/profile-eligibility.mjs";
import { useApplicationProfile } from "./application-profile-context";
import { useWorkspace } from "../lib/workspace";
import { Field, control, secondary } from "./ui";
import { profileStyles as styles } from "./profile-surface";
import WritingPreview from "./writing-preview";
import SavedAnswers from "./saved-answers";
import OutreachTemplates from "./outreach-templates";
import ApplicationDocumentLibrary from "./application-document-library";
import ProfileSection, {ProfileValues} from "./profile-section";
export function ProfileSwitcher() {
  const a=useApplicationProfile();
  const [creating,setCreating]=useState(false),[name,setName]=useState("");
  return <section className={styles.profilePicker} aria-label="Application profile selection">
    <div className={styles.pickerMain}>
      <label className={styles.profileSelect}>
        <span className="sr-only">Application profile</span>
        <select className={styles.profileChoice} value={a.profile.id} disabled={a.busy} onChange={event=>a.select(event.target.value)}>
          {a.profiles.map(profile=><option key={profile.id} value={profile.id}>{profile.name}{profile.active?'':' · Paused'}</option>)}
        </select>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </label>
      <button type="button" className={styles.profileIcon} disabled={a.busy} aria-label={creating?'Cancel new profile':'New profile'} title={creating?'Cancel':'New profile'} aria-expanded={creating} aria-controls="new-application-profile" onClick={()=>setCreating(!creating)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">{creating?<path d="m6 6 12 12M6 18 18 6"/>:<path d="M12 5v14M5 12h14"/>}</svg></button>
      <button type="button" className={styles.profileIcon} disabled={a.busy} aria-label="Duplicate profile" title="Duplicate profile" onClick={()=>a.create(`${a.profile.name} copy`,true)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg></button>
    </div>
    {creating&&<form id="new-application-profile" className={styles.profileCreate} onSubmit={event=>{event.preventDefault();a.create(name);setName("");setCreating(false);}}>
      <Field label="New profile name"><input className={control} value={name} onChange={event=>setName(event.target.value)} maxLength={80} required autoFocus/></Field>
      <button type="submit" className={styles.profileIcon} disabled={a.busy||!name.trim()} aria-label="Create profile" title="Create profile"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button>
    </form>}
  </section>;
}
export function ApplicationMaterials({mode = "resume"}: {mode?: "resume" | "answers"}) {
  const a = useApplicationProfile(),
    w = useWorkspace();
  const id = a.field("Application materials", "Default resume ID").value;
  const selected = a.field("Application materials", "Saved answer IDs").value.split(",").map(value => value.trim()).filter(Boolean);
  const resume = w.state.workflow.resumes.find((r: {id:string;name:string}) => r.id === id);
  const selectedAnswers = selected.map(answerId => {
    const answer = w.state.workflow.savedAnswers.find((item:{id:string}) => item.id === answerId);
    return answer ? `${answer.question}${answer.companyScope ? ` · ${answer.companyScope}` : ""}` : "Previously selected answer unavailable";
  });
  return (
    <ProfileSection title={mode === "resume" ? "Fallback resume" : "Saved answers for this profile"} resetKey={a.profile.id} disabled={a.busy}>{editing => editing ? <>
      <p className="mb-5 text-sm text-board-muted">
        {mode === "resume" ? "Choose a fallback when no role assignment matches. Manage shared resumes in About me." : "Select shared answers for this application profile. Their individual review and reuse policies still apply."}
      </p>
      {mode === "resume" && <><Field label="Fallback resume">
        <select
          className={control}
          disabled={a.busy}
          value={id}
          onChange={(e) =>
            a.change(
              "Application materials",
              "Default resume ID",
              e.target.value,
            )
          }
        >
          <option value="">No profile resume selected</option>
          {id &&
            !w.state.workflow.resumes.some(
              (r: { id: string }) => r.id === id,
            ) && (
              <option value={id}>Previously selected resume unavailable</option>
            )}
          {w.state.workflow.resumes.filter((r:{supersededBy?:string})=>!r.supersededBy).map((r: { id: string; name: string }) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </Field>
      <p className="mt-3 text-xs text-board-muted">
        A profile selection guides preparation. Existing application review and
        submission permissions still apply.
      </p>
      </>}
      {mode === "answers" && <fieldset className="mt-6">
        <legend className="mb-3 text-sm font-semibold">
          Saved answers to use
        </legend>
        <p className="mb-3 text-xs text-board-muted">
          Select answers for this profile. Each answer retains its own review
          and reuse policy.
        </p>
        {w.state.workflow.savedAnswers.length ? (
          w.state.workflow.savedAnswers.map(
            (answer: { id: string; question: string }) => {
              const selected = a
                .field("Application materials", "Saved answer IDs")
                .value.split(",")
                .map((v) => v.trim())
                .filter(Boolean);
              return (
                <label
                  key={answer.id}
                  className="flex min-h-11 items-center gap-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(answer.id)}
                    disabled={a.busy}
                    onChange={(e) =>
                      a.change(
                        "Application materials",
                        "Saved answer IDs",
                        (e.target.checked
                          ? [...selected, answer.id]
                          : selected.filter((id) => id !== answer.id)
                        ).join(", "),
                      )
                    }
                  />
                  {answer.question}
                </label>
              );
            },
          )
        ) : (
          <p className="text-sm text-board-muted">
            Add an employer answer below to select it here.
          </p>
        )}
      </fieldset>}
    </> : <ProfileValues items={mode === "resume" ? [
      {label:"Fallback resume",value:resume?.name || (id ? "Previously selected resume unavailable" : "No profile resume selected")},
    ] : [
      {label:"Saved answers to use",value:selectedAnswers.length ? selectedAnswers.join("\n") : "No saved answers selected"},
    ]}/>}
    </ProfileSection>
  );
}
const channels = [
  {
    heading: "Employer answer writing",
    title: "Employer questions",
    description:
      "How you sound when answering an employer’s application questions.",
  },
  {
    heading: "Outreach writing",
    title: "Outreach",
    description:
      "How you introduce yourself to recruiters, referrals, and potential teammates.",
  },
];
export function WritingStyles() {
  const a = useApplicationProfile();
  const [preview, setPreview] = useState<string | null>(null);
  return <>
    <h2 className="mb-3 mt-8 text-lg font-bold">Writing style</h2>
    <p className="text-sm text-board-muted">A separate voice for each kind of writing, saved with {a.profile.name}.</p>
    {channels.map(c => <div key={c.heading} className={styles.writingLayout}><div className={styles.writingSettings}><ProfileSection key={c.heading} title={c.title} resetKey={a.profile.id} disabled={a.busy}>{editing => <>
      <p className="mb-5 text-sm text-board-muted">{c.description}</p>
      {editing ? <div className="grid gap-5 sm:grid-cols-2">
        {([
          ["Tone", ["Professional & direct", "Warm & conversational", "Confident & understated", "Formal"]],
          ["Length", ["Brief", "Balanced", "Detailed"]],
        ] as [string, string[]][]).map(([key, values]) => <Field key={key} label={`${c.title} ${key.toLowerCase()}`}>
          <select className={control} value={a.field(c.heading,key).value} disabled={a.busy || a.field(c.heading,key).conflict} onChange={e=>a.change(c.heading,key,e.target.value)}>
            <option value="">No preference</option>
            {values.map(value=><option key={value}>{value}</option>)}
          </select>
        </Field>)}
        <div className="sm:col-span-2"><Field label={`${c.title} custom guidance`}>
          <textarea rows={3} className={control} value={a.field(c.heading,"Guidance").value} disabled={a.busy || a.field(c.heading,"Guidance").conflict} onChange={e=>a.change(c.heading,"Guidance",e.target.value)} placeholder={c.heading==="Outreach writing"?"Lead with why I’m contacting them. Avoid flattery.":"Use concrete evidence. Avoid exaggerated enthusiasm."}/>
        </Field></div>
      </div> : <ProfileValues items={[
        {label:"Tone",value:a.field(c.heading,"Tone").value || "No preference"},
        {label:"Length",value:a.field(c.heading,"Length").value || "No preference"},
        {label:"Custom guidance",value:a.field(c.heading,"Guidance").value,wide:true},
      ]}/>}
      <button type="button" className={`${secondary} mt-5`} aria-expanded={preview===c.heading} onClick={()=>setPreview(preview===c.heading?null:c.heading)}>{preview===c.heading?"Hide style brief":"Preview style brief"}</button>
      {preview===c.heading && <div className="mt-4 border-t border-board-line pt-4 text-sm leading-relaxed">
        <p className="font-semibold">Instructions your agent will receive</p>
        <p className="mt-2">{a.field(c.heading,"Tone").value || "Use a natural tone"}. {a.field(c.heading,"Length").value || "Choose a suitable length"}.</p>
        <p className="mt-2 whitespace-pre-wrap break-words">{a.field(c.heading,"Guidance").value || "No additional writing guidance."}</p>
        <p className="mt-3 text-xs text-board-muted">This previews your current guidance. Save application profile to keep changes. Facts and answer-review requirements still apply.</p>
      </div>}
    </>}</ProfileSection></div>
      <section className={`${styles.writingLibrary} ${c.title === "Outreach" ? styles.writingPreviewPanel : ""}`} tabIndex={0} aria-label={`${c.title} examples and library`}>
        {c.title === "Outreach" ? <OutreachTemplates carouselOnly/> : <>
          <h3 className="text-lg font-semibold">Employer answer preview</h3>
          <p className="my-3 text-xs text-board-muted">Fictional example · Why are you interested in this role?</p>
          <WritingPreview key={a.profile.id} text="I’m interested in this role because it combines distributed systems with practical performance work. In a fictional university project, I built a query service and compared caching strategies under load. I’d like to bring that approach to your infrastructure team and learn how you handle reliability at production scale."/>
          <p className="mt-4 text-xs text-board-muted">Illustrative example. Your agent uses your saved writing settings and verified experience for real answers.</p>
        </>}
      </section>
    </div>)}
    <details className="mt-6 border-y border-board-line py-4">
      <summary className="cursor-pointer text-base font-semibold">Shared question bank</summary>
      <p className="mt-3 text-sm text-board-muted">Manage shared employer answers and choose which answers this profile can use.</p>
      <ApplicationMaterials mode="answers"/>
      <SavedAnswers/>
    </details>
    <ApplicationDocumentLibrary kind="application_template"/>
  </>;
}

export function EligibilitySettings() {
  const a = useApplicationProfile();
  const heading = eligibilityHeading;
  const hasCountry = !!a
    .field(heading, "Work authorization country")
    .value.trim();
  const yesNo = ["Yes", "No"];
  const fields: {
    key: string;
    type?: string;
    placeholder?: string;
    options?: string[];
  }[] = [
    {
      key: "Work authorization country",
      placeholder: "United States, Canada…",
    },
    { key: "Authorized to work in this country", options: yesNo },
    { key: "Sponsorship required now", options: yesNo },
    { key: "Sponsorship required in the future", options: yesNo },
    { key: "Earliest start date", type: "date" },
    {
      key: "Notice period",
      placeholder: "Available now, two weeks, one month…",
    },
    { key: "Willing to relocate", options: yesNo },
    {
      key: "Enrollment status",
      options: ["Currently enrolled", "Not currently enrolled"],
    },
    { key: "Expected graduation", type: "month" },
  ];
  return (
    <ProfileSection title="Eligibility & availability" resetKey={a.profile.id} disabled={a.busy} onFinish={a.saveProfile}>{editing=><>
      {editing?<>
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((f) => {
          const saved = a.field(heading, f.key);
          return (
            <Field key={f.key} label={f.key}>
              {f.options ? (
                <select
                  className={control}
                  value={saved.value}
                  disabled={
                    a.busy ||
                    saved.conflict ||
                    (countryEligibilityFields.includes(f.key) && !hasCountry)
                  }
                  onChange={(e) => a.change(heading, f.key, e.target.value)}
                >
                  <option value="">Ask me</option>
                  {f.options.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                  {saved.value && !f.options.includes(saved.value) && (
                    <option value={saved.value}>{saved.value}</option>
                  )}
                </select>
              ) : (
                <input
                  className={control}
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  value={saved.value}
                  disabled={a.busy || saved.conflict}
                  onChange={(e) =>
                    f.key === "Work authorization country"
                      ? a.patch({
                          prompt: setEligibilityCountry(
                            a.profile.prompt,
                            e.target.value,
                          ),
                        })
                      : a.change(heading, f.key, e.target.value)
                  }
                />
              )}
              {saved.conflict && (
                <span className="text-xs">
                  Resolve duplicate {f.key} lines in Advanced instructions.
                </span>
              )}
            </Field>
          );
        })}
      </div>
      <div className="mt-5">
        <Field label="Eligibility notes (optional)">
          <textarea
            className={control}
            rows={3}
            value={a.field(heading, "Notes").value}
            disabled={a.busy || a.field(heading, "Notes").conflict}
            onChange={(e) => a.change(heading, "Notes", e.target.value)}
            placeholder="Country-specific exceptions or details your agent should ask about."
          />
        </Field>
      </div>
      </>:<ProfileValues items={[...fields.map(f=>({label:f.key,value:a.field(heading,f.key).conflict?"Conflicting values — review in Advanced instructions":a.field(heading,f.key).value||(f.options?"Ask me":"")})),{label:"Eligibility notes",value:a.field(heading,"Notes").value,wide:true}]}/>}
      {a.feedback&&<p role="status" className="mt-3 text-sm text-board-muted">{a.feedback}</p>}
    </>}</ProfileSection>
  );
}
