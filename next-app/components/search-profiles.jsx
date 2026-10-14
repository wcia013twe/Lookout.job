"use client";
import { useState } from 'react';
import { useWorkspace } from '../lib/workspace';
import { Section, Field, control, secondary, Notice } from './ui';
import { filterFields, priorities, initialPrompt, readField, updateField, profileFromPrompt, promptFromProfile, normalizeSearchProfile } from '../../search-profile.mjs';

function SearchProfileEditor() {
  const w = useWorkspace(), p = w.state.workflow.searchPreferences || {};
  const [drafts, setDrafts] = useState({}), [busy, setBusy] = useState(false);
  const saved = p.profiles?.length ? p.profiles.map(normalizeSearchProfile) : [{ ...profileFromPrompt(initialPrompt(p)), version: 0 }];
  const profiles = [...saved.map(v => drafts[v.id] || { ...v, prompt: promptFromProfile(v) }), ...Object.values(drafts).filter(v => !saved.some(s => s.id === v.id))];
  const [selected, setSelected] = useState('general'), [feedback, setFeedback] = useState(''), [undo, setUndo] = useState(null), [newName, setNewName] = useState('');
  const profile = profiles.find(v => v.id === selected) || profiles[0];
  function patch(fields) { setDrafts(prev => ({ ...prev, [profile.id]: { ...profile, ...fields } })); setFeedback('Unsaved changes. Save this profile to share with Muse.'); }
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
      const existing = current.profiles || [];
      w.store.set('workflow.searchPreferences', { ...current, profiles: existing.some(v => v.id === stored.id) ? existing.map(v => v.id === stored.id ? stored : v) : [...existing, stored] });
      setDrafts(prev => { const copy = { ...prev }; delete copy[stored.id]; return copy; });
      setFeedback(owner ? 'Profile saved for Muse.' : 'Saved in this browser. Sign in to share with Muse.');
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(false); }
  }
  function change(heading, key, value) {
    try {
      const prompt = updateField(profile.prompt, heading, key, value);
      setUndo({ id: profile.id, prompt: profile.prompt });
      patch({ prompt });
      setFeedback(`${key} updated in your prompt.`);
    } catch (error) { setFeedback(error.message); }
  }
  function pills(heading, key, options) {
    const field = readField(profile.prompt, heading, key);
    return <fieldset key={key} className="space-y-2"><legend className="mb-2 text-sm font-medium">{key}</legend>
      <div className="flex flex-wrap gap-2">{['', ...options].map(option => <button type="button" key={option} disabled={field.conflict} aria-pressed={field.value === option} onClick={() => change(heading, key, option)} className={`min-h-11 rounded-full border px-3 py-2 text-sm transition-colors disabled:opacity-50 ${field.value === option ? 'border-board-accent bg-board-accent text-board-ink' : 'border-board-line bg-board-tag text-board-text hover:border-board-accent'}`}>{option || 'No preference'}</button>)}</div>
      {field.conflict && <p className="text-sm text-board-muted">Resolve duplicate {key} lines in the prompt.</p>}
      {field.value && !options.includes(field.value) && <p className="text-sm text-board-muted">Custom: {field.value}</p>}
    </fieldset>;
  }
  return <Section title="Preferences">
    <p className="mb-5 max-w-prose text-sm text-board-muted">Describe your search here or talk to Muse. Quick adjustments edit the same prompt. Filters narrow the search; priorities guide how Muse evaluates opportunities.</p>
    <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Preference profiles">{profiles.map(v => <button type="button" key={v.id} aria-pressed={v.id === profile.id} className={v.id === profile.id ? `${secondary} border-board-accent` : secondary} onClick={() => { setSelected(v.id); setUndo(null); }}>{v.name}{v.active ? '' : ' (paused)'}</button>)}</div>
    <form className="mb-6 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); if (!newName.trim()) return; const id = crypto.randomUUID(); setDrafts(prev => ({ ...prev, [id]: { id, name: newName.trim(), active: true, version: 0, prompt: initialPrompt() } })); setSelected(id); setNewName(''); setUndo(null); }}>
      <Field label="New profile name"><input className={control} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Part-time, internships…" maxLength={80} /></Field><button className={secondary} disabled={!newName.trim()}>Add profile</button>
    </form>
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-4 lg:sticky lg:top-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Your instructions</h3><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={profile.active} onChange={e => patch({ active: e.target.checked })} />Search with this profile</label></div>
        <textarea aria-label={`${profile.name} preference prompt`} spellCheck className={`${control} min-h-[32rem] resize-y leading-relaxed`} value={profile.prompt} onChange={e => { setUndo(null); patch({ prompt: e.target.value }); }} />
        <p className="text-xs leading-relaxed text-board-muted">Edit any wording. Quick adjustments recognize the labeled lines inside Search Filters and How to Evaluate Opportunities. Other text stays exactly as you wrote it. Submission permission is set separately below.</p>
        {undo?.id === profile.id && <button className={secondary} onClick={() => { patch({ prompt: undo.prompt }); setUndo(null); }}>Undo last adjustment</button>}
        <div className="flex flex-wrap gap-3"><button type="button" className={secondary} disabled={busy || w.locked} onClick={saveProfile}>{busy ? 'Saving…' : 'Save profile'}</button>
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
      <aside aria-label="Quick adjustments" className="min-w-0 space-y-8">
        <div className="space-y-5"><h3 className="text-base font-semibold">Search filters</h3>{Object.entries(filterFields).map(([key, options]) => options ? pills('Search Filters', key, options) : <Field key={key} label={key}><input className={control} value={readField(profile.prompt, 'Search Filters', key).value} disabled={readField(profile.prompt, 'Search Filters', key).conflict} placeholder={key === 'Location' ? 'US only; Boston within 20 miles' : 'USD 60,000/year required'} onChange={e => change('Search Filters', key, e.target.value)} />{readField(profile.prompt, 'Search Filters', key).conflict && <span className="text-xs">Resolve duplicate lines in the prompt.</span>}</Field>)}</div>
        <div className="space-y-5 border-t border-board-line pt-6"><h3 className="text-base font-semibold">Evaluation priorities</h3><p className="text-sm text-board-muted">These guide judgment, not eligibility. Describe tradeoffs in your prompt.</p>{priorities.map(key => pills('How to Evaluate Opportunities', key, ['Important', 'Very important']))}</div>
      </aside>
    </div>
  </Section>;
}

export default function SearchProfiles() { const w = useWorkspace(); return <SearchProfileEditor key={w.demo ? `demo-${w.demoEpoch}` : w.user?.id || "guest"} />; }
