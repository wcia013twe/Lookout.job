"use client";

import Link from "next/link";
import { useState } from "react";
import ProfileRuleCopy from "./profile-rule-copy";
import { useWorkspace } from "../lib/workspace";
import { useApplicationProfile } from "./application-profile-context";
import ProfileSection, { ProfileValues } from "./profile-section";
import { Field, control } from "./ui";
import { agentContextFields, agentContextHeading, legacyContextFields, readField } from "../../lib/search-profile.mjs";

export default function AgentFitContext() {
  const a = useApplicationProfile();
  const w = useWorkspace();
  const [showPrevious, setShowPrevious] = useState(false);
  const previous = legacyContextFields.filter(({ heading, key }) => {
    const field = readField(a.profile.prompt, heading, key);
    return field.value || field.conflict;
  });
  return (
    <div id="agent-context" className="scroll-mt-8">
      <ProfileSection title="What your agent knows" resetKey={a.profile.id} disabled={a.busy}>
        {editing => <>
          <p className="mb-6 max-w-prose text-sm leading-relaxed text-board-muted">
            Personal context behind your four Discover fit scores. Capture what matters, why it matters, and any tradeoffs. You or your agent can update these notes as your search changes.
          </p>
          <div className="space-y-6">
            {agentContextFields.map(({ id, label, help, placeholder }) => {
              const field = a.field(agentContextHeading, label);
              return <div key={id} id={`agent-context-${id}`} className="max-w-[75ch] scroll-mt-8">
                {editing ? <Field label={label}>
                  <span className="mb-3 block max-w-prose leading-relaxed">{help}</span>
                  <textarea className={`${control} resize-y leading-relaxed`} rows={4} value={field.value}
                    placeholder={placeholder} disabled={a.busy || field.conflict}
                    onChange={event => a.change(agentContextHeading, label, event.target.value)} />
                </Field> : <>
                  <ProfileValues items={[{label, value: field.conflict ? "Conflicting notes — review Advanced instructions." : field.value || "No context saved yet.", wide: true}]} />
                  {!field.value && !field.conflict && <p className="mt-1 max-w-prose text-sm leading-relaxed text-board-muted">{help}</p>}
                </>}
                {editing && field.conflict && <p role="alert" className="mt-2 text-sm text-board-muted">Resolve duplicate {label} notes in Advanced instructions before editing.</p>}
              </div>;
            })}
          </div>
          <Link className="mt-5 inline-flex min-h-11 items-center text-sm text-board-accent underline underline-offset-4" href={w.demo ? "/discover/?demo=1" : "/discover/"}>See fit analysis in Discover</Link>
          {editing && <p className="mt-5 max-w-prose text-xs leading-relaxed text-board-muted">All four are optional. Add only relevant facts you have shared; keep assumptions and unanswered questions explicit. Must-haves stay in your search preferences.</p>}
          {(previous.length > 0 || editing && (w.user || w.demo)) && <details className="mt-6 border-t border-board-line pt-4" onToggle={event => setShowPrevious(event.currentTarget.open)}>
            <summary className="min-h-11 cursor-pointer text-sm font-medium">Previous goals & rules</summary>
            <p className="my-3 max-w-prose text-sm text-board-muted">Your earlier notes are preserved. Review them with your agent before moving relevant details into the four categories.</p>
            <div className="space-y-4">{previous.map(({heading, key}) => {
              const field = a.field(heading, key);
              return editing ? <Field label={key} key={key}><textarea className={control} rows={3} value={field.value} disabled={a.busy || field.conflict} onChange={event => a.change(heading, key, event.target.value)} />
                {field.conflict && <span className="block text-sm">Resolve duplicates in Advanced instructions.</span>}
              </Field> : <ProfileValues key={key} items={[{label:key, value:field.conflict ? "Conflicting notes — review Advanced instructions." : field.value, wide:true}]} />;
            })}</div>
            {editing && showPrevious && (w.user || w.demo) && <ProfileRuleCopy />}
          </details>}
        </>}
      </ProfileSection>
    </div>
  );
}
