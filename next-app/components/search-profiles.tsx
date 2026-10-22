"use client";
import { useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { Field, control, secondary } from "./ui";
import {
  priorities,
  preferenceGroups,
  flexibilityOptions,
  careerFields,
  readField,
  updateField,
} from "../../lib/search-profile.mjs";

import TierLists from "./tierlists";
import ProfileSection, { ProfileValues } from "./profile-section";
import RecruitingTargets from "./recruiting-targets";
import { ApplicationMaterials } from "./profile-settings";
import ProfileRuleCopy from "./profile-rule-copy";
import { errorMessage } from "./profile-types";
import { useApplicationProfile } from "./application-profile-context";
function SearchProfileEditor() {
  const w = useWorkspace();
  const { profile, patch, busy, setFeedback } = useApplicationProfile();
  const [showLegacy, setShowLegacy] = useState(false);
  const [undo, setUndo] = useState<{
    id: string;
    prompt: string;
    after: string;
  } | null>(null);
  function change(heading: string, key: string, value: string) {
    try {
      const prompt = updateField(profile.prompt, heading, key, value);
      setUndo({ id: profile.id, prompt: profile.prompt, after: prompt });
      patch({ prompt });
      setFeedback(`${key} updated. Save the application profile when ready.`);
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }
  function textField(
    heading: string,
    key: string,
    placeholder: string,
    multiline = false,
  ) {
    const field = readField(profile.prompt, heading, key);
    return (
      <Field
        label={
          heading === "Profile evaluation" ? "Rules for this profile" : key
        }
        key={key}
      >
        {multiline ? (
          <textarea
            className={control}
            rows={3}
            value={field.value}
            disabled={field.conflict || busy}
            placeholder={placeholder}
            onChange={(e) => change(heading, key, e.target.value)}
          />
        ) : (
          <input
            className={control}
            value={field.value}
            disabled={field.conflict || busy}
            placeholder={placeholder}
            onChange={(e) => change(heading, key, e.target.value)}
          />
        )}
        {field.conflict && (
          <span className="text-sm text-board-muted">
            Resolve duplicate {key} lines in Advanced instructions.
          </span>
        )}
      </Field>
    );
  }
  function selectTierList(id: string) {
    try {
      const list = w.state.workflow.tierLists.find(
        (item: { id: string }) => item.id === id,
      );
      let prompt = updateField(
        profile.prompt,
        "Company priorities",
        "Tier list ID",
        id,
      );
      prompt = updateField(
        prompt,
        "Company priorities",
        "Tier list name",
        list?.name || "",
      );
      setUndo({ id: profile.id, prompt: profile.prompt, after: prompt });
      patch({ prompt });
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }
  const tierField = readField(
    profile.prompt,
    "Company priorities",
    "Tier list ID",
  );
  const tierExists = w.state.workflow.tierLists.some(
    (list: { id: string }) => list.id === tierField.value,
  );
  function value(heading: string, key: string) {
    const field = readField(profile.prompt, heading, key);
    return field.conflict ? "Conflicting values — review Advanced instructions" : field.value;
  }
  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold">Job preferences</h2>
        <p className="mt-2 text-sm text-board-muted">What makes a role right for {profile.name}.</p>
      </div>
      <ProfileSection title="Search status" resetKey={profile.id} disabled={busy}>
        {editing => editing ? <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" checked={profile.active} disabled={busy} onChange={e => patch({active:e.target.checked})}/>
          Include this profile in job searches
        </label> : <ProfileValues items={[{label:"Status",value:profile.active ? "Actively looking" : "Paused"}]}/>}
      </ProfileSection>
      <ApplicationMaterials />
      <RecruitingTargets />
      {preferenceGroups.map(group => <ProfileSection key={group.title} title={group.title} resetKey={profile.id} disabled={busy}>
        {editing => editing ? <>
          <p className="mb-5 text-sm text-board-muted">Separate choices with commas. Required is a must-have; Preferred favors a match; Flexible allows a tradeoff. Missing evidence needs verification.</p>
          <div className="space-y-5">
            {group.fields.map(([key, placeholder, heading]) => {
              const strength = readField(profile.prompt, "Priority & flexibility", key);
              return <div key={key} className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
                {textField(heading || group.heading, key, placeholder)}
                <Field label={`${key} priority`}>
                  <select className={control} disabled={strength.conflict || busy} value={strength.value} onChange={e => change("Priority & flexibility",key,e.target.value)}>
                    <option value="">Not specified</option>
                    {flexibilityOptions.map(option => <option key={option}>{option}</option>)}
                  </select>
                  {strength.conflict && <span className="text-xs text-board-muted">Resolve duplicate priority lines in Advanced instructions.</span>}
                </Field>
              </div>;
            })}
          </div>
        </> : <ProfileValues items={group.fields.map(([key,,heading]) => {
          const preference=value(heading || group.heading,key);
          const priority=value("Priority & flexibility",key);
          return {label:key,value:preference ? [preference,priority].filter(Boolean).join(" · ") : priority ? `Not specified · ${priority}` : "Not specified"};
        })}/>}
      </ProfileSection>)}
      <ProfileSection title="What you value" resetKey={profile.id} disabled={busy}>
        {editing => editing ? <div className="grid gap-5 sm:grid-cols-2">{priorities.map(key => {
          const field=readField(profile.prompt,"How to Evaluate Opportunities",key);
          return <Field label={key} key={key}><select className={control} disabled={busy || field.conflict} value={field.value} onChange={e => change("How to Evaluate Opportunities",key,e.target.value)}>
            <option value="">No preference</option><option>Important</option><option>Very important</option>
          </select>{field.conflict && <span className="text-xs text-board-muted">Resolve duplicate lines in Advanced instructions.</span>}</Field>;
        })}</div> : <ProfileValues items={priorities.map(key => ({label:key,value:value("How to Evaluate Opportunities",key) || "No preference"}))}/>}
      </ProfileSection>
      <ProfileSection title="Company priorities" resetKey={profile.id} disabled={busy}>
        {editing => <>
          <p className="mb-5 text-sm text-board-muted">Tiers guide company priority; the role and team still determine fit.</p>
          {editing ? <>
            <Field label="Tier list for this profile"><select className={control} disabled={busy || tierField.conflict} value={tierField.value} onChange={e => selectTierList(e.target.value)}>
              <option value="">No tier list selected</option>
              {tierField.value && !tierExists && <option value={tierField.value}>Previously selected list unavailable</option>}
              {w.state.workflow.tierLists.map((list:{id:string;name:string}) => <option key={list.id} value={list.id}>{list.name}</option>)}
            </select>{tierField.conflict && <span className="text-xs text-board-muted">Resolve duplicate tier-list lines in Advanced instructions.</span>}</Field>
            <div className="mt-5"><TierLists selectedListId={tierExists ? tierField.value : undefined} onSelectList={selectTierList}/></div>
          </> : <ProfileValues items={[{label:"Company tier list",value:tierField.conflict ? "Conflicting selections — review Advanced instructions" : tierField.value ? w.state.workflow.tierLists.find((list:{id:string}) => list.id === tierField.value)?.name || "Previously selected list unavailable" : "No tier list selected"}]}/>}
        </>}
      </ProfileSection>
      <ProfileSection title="Career goals & tradeoffs" resetKey={profile.id} disabled={busy}>
        {editing => editing ? <div className="space-y-5">{careerFields.map(key => textField("Career goals & tradeoffs",key,key === "Career goals" ? "What should your next role help you achieve?" : "What would justify lower pay, relocation, or a change in timing?",true))}</div> : <ProfileValues items={careerFields.map(key => ({label:key,value:value("Career goals & tradeoffs",key),wide:true}))}/>}
      </ProfileSection>
      <ProfileSection title="Profile rules" resetKey={profile.id} disabled={busy}>
        {editing => editing ? <>
          {textField("Profile evaluation","Rules","How should your agent evaluate opportunities for this profile?",true)}
          {(w.user || w.demo) && <details className="mt-4" onToggle={e=>setShowLegacy(e.currentTarget.open)}><summary className="text-sm font-medium">Copy previous rules</summary>{showLegacy && <ProfileRuleCopy/>}</details>}
        </> : <ProfileValues items={[{label:"Rules for this profile",value:value("Profile evaluation","Rules"),wide:true}]}/>}
      </ProfileSection>
      <ProfileSection title="Advanced instructions" resetKey={profile.id} disabled={busy}>
        {editing => editing ? <>
          <p className="mb-4 text-sm text-board-muted">These are the same instructions your agent reads. Existing prose is preserved. Submission permissions live in My Agent.</p>
          <textarea aria-label={`${profile.name} preference prompt`} spellCheck className={`${control} min-h-[22rem] resize-y leading-relaxed`} disabled={busy} value={profile.prompt} onChange={e=>{setUndo(null);patch({prompt:e.target.value});}}/>
        </> : <p className="text-sm text-board-muted">Edit the full instructions for {profile.name}. Your selections above are included.</p>}
      </ProfileSection>
      {undo?.id === profile.id && undo.after === profile.prompt && (
        <button
          type="button"
          className={`${secondary} mt-4`}
          disabled={busy}
          onClick={() => {
            patch({ prompt: undo.prompt });
            setUndo(null);
          }}
        >
          Undo last adjustment
        </button>
      )}
    </>
  );
}
export default function SearchProfiles() {
  const { profile } = useApplicationProfile();
  return <SearchProfileEditor key={profile.id} />;
}
