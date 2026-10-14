"use client";
import { useState } from 'react';
import { useWorkspace } from '../lib/workspace';
import { Section, Field, control, secondary, Notice } from './ui';
import { priorities, preferenceGroups, flexibilityOptions, careerFields, initialPrompt, readField, updateField, profileFromPrompt, promptFromProfile, normalizeSearchProfile } from '../../lib/search-profile.mjs';

type SearchProfile = { id: string; name: string; active: boolean; version?: number; prompt: string; filters?: Record<string, unknown>; priorities?: Record<string, unknown>; instructions?: string };
import TierLists from "./tierlists";
import { errorMessage } from "./profile-types";
function SearchProfileEditor() {
  const w = useWorkspace(), p = w.state.workflow.searchPreferences || {};
  const [drafts, setDrafts] = useState<Record<string, SearchProfile>>({}), [busy, setBusy] = useState(false);
  const saved: Omit<SearchProfile, "prompt">[] = p.profiles?.length ? p.profiles.map(normalizeSearchProfile) : [{ ...profileFromPrompt(initialPrompt(p)), version: 0 }];
  const profiles = [...saved.map(v => drafts[v.id] || { ...v, prompt: promptFromProfile(v) }), ...Object.values(drafts).filter(v => !saved.some(s => s.id === v.id))];
  const [selected, setSelected] = useState('general'), [feedback, setFeedback] = useState(''), [undo, setUndo] = useState<{ id: string; prompt: string } | null>(null), [newName, setNewName] = useState('');
  const profile = profiles.find(v => v.id === selected) || profiles[0];
  function patch(fields: Partial<SearchProfile>) { setDrafts(prev => ({ ...prev, [profile.id]: { ...profile, ...fields } })); setFeedback('Unsaved changes. Save this profile to share with Muse.'); }
  async function saveProfile() {
    const owner = (w.demo ? null : w.user?.id);
    setBusy(true);
    try {
      const next = profileFromPrompt(profile.prompt, profile);
      let stored;
      if (owner) {
        const { data, error } = await w.client.rpc('save_search_profile', { expected_version: profile.version || 0, next_profile: next });
        if (error) {
          if (error.code === '40001') throw Error('Muse or another tab changed this profile. Reload the saved profile before retrying; your draft is kept.');
          throw Error('Could not save this profile. Your draft is kept; retry when connected.');
        }
        if (window.JB.auth.userId !== owner) throw Error('Account changed. Reload preferences.');
        stored = data;
      } else stored = { ...next, version: profile.version || 0 };
      const current = w.store.get('workflow.searchPreferences') || {};
      const existing: Omit<SearchProfile, "prompt">[] = current.profiles || [];
      w.store.set('workflow.searchPreferences', { ...current, profiles: existing.some(v => v.id === stored.id) ? existing.map(v => v.id === stored.id ? stored : v) : [...existing, stored] });
      setDrafts(prev => { const copy = { ...prev }; delete copy[stored.id]; return copy; });
      setFeedback(owner ? 'Profile saved for Muse.' : 'Saved in this browser. Sign in to share with Muse.');
    } catch (error) { setFeedback(errorMessage(error)); }
    finally { setBusy(false); }
  }
  function change(heading: string, key: string, value: string) {
    try {
      const prompt = updateField(profile.prompt, heading, key, value);
      setUndo({ id: profile.id, prompt: profile.prompt });
      patch({ prompt });
      setFeedback(`${key} updated in your prompt.`);
    } catch (error) { setFeedback(errorMessage(error)); }
  }
  function textField(heading: string, key: string, placeholder: string, multiline = false) {
    const field = readField(profile.prompt, heading, key);
    return <Field label={key} key={key}>
      {multiline
        ? <textarea className={control} rows={3} value={field.value} disabled={field.conflict || busy} placeholder={placeholder} onChange={e => change(heading, key, e.target.value)} />
        : <input className={control} value={field.value} disabled={field.conflict || busy} placeholder={placeholder} onChange={e => change(heading, key, e.target.value)} />}
      {field.conflict && <span className="text-sm text-board-muted">Resolve duplicate {key} lines in Advanced instructions.</span>}
    </Field>;
  }
  function selectTierList(id: string) {
    try {
      const list = w.state.workflow.tierLists.find((item: {id: string}) => item.id === id);
      let prompt = updateField(profile.prompt, 'Company priorities', 'Tier list ID', id);
      prompt = updateField(prompt, 'Company priorities', 'Tier list name', list?.name || '');
      setUndo({ id: profile.id, prompt: profile.prompt });
      patch({ prompt });
    } catch (error) { setFeedback(errorMessage(error)); }
  }
  const tierField = readField(profile.prompt, 'Company priorities', 'Tier list ID');
  const tierExists = w.state.workflow.tierLists.some((list: {id: string}) => list.id === tierField.value);
  return <Section title="Job preferences">
    <p className="mb-5 max-w-prose text-sm text-board-muted">Give each search its own criteria, career goals, and company priorities. Your experience and employment information stay shared across profiles.</p>
    <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Preference profiles">{profiles.map(v => <button type="button" key={v.id} disabled={busy} aria-pressed={v.id === profile.id} className={v.id === profile.id ? `${secondary} border-board-accent` : secondary} onClick={() => { setSelected(v.id); setUndo(null); }}>{v.name}{v.active ? '' : ' (paused)'}</button>)}</div>
    <form className="mb-6 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); if (!newName.trim()) return; const id = crypto.randomUUID(); setDrafts(prev => ({ ...prev, [id]: { id, name: newName.trim(), active: true, version: 0, prompt: initialPrompt() } })); setSelected(id); setNewName(''); setUndo(null); }}>
      <Field label="New profile name"><input className={control} value={newName} disabled={busy} onChange={e => setNewName(e.target.value)} placeholder="Full-time backend, summer internships…" maxLength={80} /></Field><button className={secondary} disabled={busy || !newName.trim()}>Add profile</button>
    </form>
    <div className="mb-6 grid items-end gap-4 sm:grid-cols-2">
      <Field label="Profile name"><input className={control} maxLength={80} value={profile.name} disabled={busy} onChange={e => patch({ name: e.target.value })} /></Field>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" disabled={busy} checked={profile.active} onChange={e => patch({ active: e.target.checked })} />Search with this profile</label>
    </div>
    <section aria-labelledby="preference-priority-heading" className="mb-7 border-t border-board-line pt-5">
      <h3 id="preference-priority-heading" className="text-lg font-semibold">Priority &amp; flexibility</h3>
      <p className="mt-2 max-w-prose text-sm text-board-muted">Set a priority beside each criterion. Required means a must-have; Preferred favors a match; Flexible allows a tradeoff. Blank means you have not specified a priority. Missing evidence in a listing still needs verification.</p>
    </section>
    <div className="space-y-7">
      {preferenceGroups.map(group => <section key={group.title} aria-label={group.title} className="border-t border-board-line pt-5">
        <h3 className="mb-4 text-lg font-semibold">{group.title}</h3>
        <p className="mb-4 text-xs text-board-muted">List multiple choices separated by commas, or describe your preference.</p>
        <div className="space-y-5">{group.fields.map(([key, placeholder, heading]) => {
          const strength = readField(profile.prompt, 'Priority & flexibility', key);
          return <div key={key} className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
            {textField(heading || group.heading, key, placeholder)}
            <Field label={`${key} priority`}><select className={control} disabled={strength.conflict || busy} value={strength.value} onChange={e => change('Priority & flexibility', key, e.target.value)}>
              <option value="">Not specified</option>{flexibilityOptions.map(option => <option key={option}>{option}</option>)}
            </select>{strength.conflict && <span className="text-sm text-board-muted">Resolve duplicate priority lines in Advanced instructions.</span>}</Field>
          </div>;
        })}</div>
      </section>)}
      <section aria-label="What you value" className="border-t border-board-line pt-5">
        <h3 className="mb-4 text-lg font-semibold">What you value</h3>
        <p className="mb-4 max-w-prose text-sm text-board-muted">These guide how your agent weighs opportunities.</p>
        <div className="grid gap-4 sm:grid-cols-2">{priorities.map(key => {
          const field = readField(profile.prompt, 'How to Evaluate Opportunities', key);
          return <Field label={key} key={key}><select className={control} value={field.value} disabled={field.conflict || busy} onChange={e => change('How to Evaluate Opportunities', key, e.target.value)}>
            <option value="">No preference</option><option>Important</option><option>Very important</option>
          </select>{field.conflict && <span className="text-sm text-board-muted">Resolve duplicate lines in Advanced instructions.</span>}</Field>;
        })}</div>
      </section>
      <section aria-label="Career goals and tradeoffs" className="border-t border-board-line pt-5">
        <h3 className="mb-4 text-lg font-semibold">Career goals &amp; tradeoffs</h3>
        <p className="mb-4 max-w-prose text-sm text-board-muted">Explain why a role is worth pursuing and what upside would justify a compromise.</p>
        <div className="space-y-4">{careerFields.map(key => textField('Career goals & tradeoffs', key, key === 'Career goals' ? 'What do you want this next role to help you achieve?' : 'What would justify lower pay, relocation, or a change in timing?', true))}</div>
      </section>
      <section aria-label="Company priorities" className="border-t border-board-line pt-5">
        <h3 className="mb-4 text-lg font-semibold">Company priorities</h3>
        <p className="mb-4 max-w-prose text-sm text-board-muted">Associate a tier list with this search profile. Tiers guide company priority; the specific role and team still determine fit. Editing a list affects every profile that uses it.</p>
        <Field label="Tier list for this profile"><select className={control} disabled={busy || tierField.conflict} value={tierField.value} onChange={e => selectTierList(e.target.value)}>
          <option value="">No tier list selected</option>
          {tierField.value && !tierExists && <option value={tierField.value}>Previously selected list unavailable</option>}
          {w.state.workflow.tierLists.map((list: {id: string; name: string}) => <option key={list.id} value={list.id}>{list.name}</option>)}
        </select>{tierField.conflict && <span className="text-sm text-board-muted">Resolve duplicate tier-list lines in Advanced instructions.</span>}</Field>
        <details className="mt-4"><summary className="min-h-11 py-3 font-semibold">Maintain company tier lists</summary><TierLists selectedListId={tierExists ? tierField.value : undefined} onSelectList={selectTierList} /></details>
      </section>
      <details className="border-t border-board-line pt-5">
        <summary className="min-h-11 text-base font-semibold">Advanced instructions</summary>
        <p className="mb-3 mt-3 max-w-prose text-sm text-board-muted">These fields edit the same instructions your agent reads. Additional prose and existing preferences are preserved. Submission permission is managed in My agent.</p>
        <textarea aria-label={`${profile.name} preference prompt`} spellCheck className={`${control} min-h-[22rem] resize-y leading-relaxed`} disabled={busy} value={profile.prompt} onChange={e => { setUndo(null); patch({ prompt: e.target.value }); }} />
      </details>
    </div>
    <div className="mt-7 border-t border-board-line pt-5">
      {undo?.id === profile.id && <button type="button" className={`${secondary} mb-3`} disabled={busy} onClick={() => { patch({ prompt: undo.prompt }); setUndo(null); }}>Undo last adjustment</button>}
      <div className="flex flex-wrap gap-3"><button type="button" className={secondary} disabled={busy || w.locked || !profile.name.trim()} onClick={saveProfile}>{busy ? 'Saving…' : 'Save profile'}</button>
      <button type="button" className={secondary} disabled={busy} onClick={async () => {
        if (!w.demo && w.user) {
          const owner = w.user.id;
          const { data, error } = await w.client.from('preferences').select('search').eq('user_id', owner).maybeSingle();
          if (error || window.JB.auth.userId !== owner) { setFeedback('Could not reload saved preferences.'); return; }
          const current = w.store.get('workflow.searchPreferences') || {};
          w.store.set('workflow.searchPreferences', { ...current, profiles: data?.search?.profiles || [] });
        }
        setDrafts(prev => { const copy = { ...prev }; delete copy[profile.id]; return copy; }); setUndo(null); setFeedback('Loaded the saved profile.');
      }}>Reload saved profile</button></div><Notice>{feedback}</Notice>
    </div>
  </Section>;
}

export default function SearchProfiles() { const w = useWorkspace(); return <SearchProfileEditor key={w.demo ? `demo-${w.demoEpoch}` : w.user?.id || "guest"} />; }
