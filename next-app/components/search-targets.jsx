"use client";
import { useState } from 'react';
import { useWorkspace } from '../lib/workspace';
import { Section, Field, control, primary, secondary, Notice } from './ui';
import { targetKinds, validateTargets, scanningStatus } from '../../search-targets.mjs';
const blank = { name: '', kind: 'board', address: '' };
function Editor() {
  const w = useWorkspace(), prefs = w.state.workflow.searchPreferences || {};
  const targets = prefs.targets || [];
  const [draft, setDraft] = useState(null), [busy, setBusy] = useState(false), [feedback, setFeedback] = useState('');
  async function persist(next) {
    setBusy(true);
    try {
      validateTargets(next);
      const owner = w.demo ? null : w.user?.id;
      let result = { targets: next, version: (prefs.targetsVersion || 0) + 1 };
      if (owner) {
        const { data, error } = await w.client.rpc('save_search_targets', { expected_version: prefs.targetsVersion || 0, next_targets: next });
        if (error) throw Error(error.code === '40001' ? 'Your target list changed in another session. Reload the saved list, then retry; your draft is kept.' : 'Could not save targets. Your draft is kept; retry when connected.');
        if (window.JB.auth.userId !== owner) throw Error('Account changed. Reload your profile.');
        result = data;
      }
      w.store.update('workflow.searchPreferences', previous => ({ ...previous, targets: result.targets, targetsVersion: result.version }));
      setDraft(null); setFeedback(w.demo ? 'Demo target list updated. Changes stay in this preview.' : owner ? 'Search targets saved for Muse.' : 'Saved in this browser. Sign in to share your targets with Muse.');
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(false); }
  }
  async function reload() {
    setBusy(true);
    const owner = w.user.id;
    try {
      const { data, error } = await w.client.from('preferences').select('search').eq('user_id', owner).maybeSingle();
      if (error || window.JB.auth.userId !== owner) throw Error('Could not reload targets. Retry when connected.');
      w.store.update('workflow.searchPreferences', previous => ({ ...previous, targets: data?.search?.targets || [], targetsVersion: data?.search?.targetsVersion || 0 }));
      setFeedback('Saved target list reloaded.');
    } catch (error) { setFeedback(error.message); }
    finally { setBusy(false); }
  }
  return <Section title="Search targets">
    <p className="mb-5 max-w-prose text-sm leading-relaxed text-board-muted">Choose where Muse looks. Job preferences define which opportunities fit. Your target list is private.</p>
    {!targets.length && <p className="mb-5 text-sm text-board-muted">No search targets yet. Add a job board, company careers page, or social account.</p>}
    <ul className="divide-y divide-board-line">{targets.map(target => { const status = scanningStatus(target); return <li key={target.id} className="flex flex-col items-start justify-between gap-4 py-5 sm:flex-row">
      <div className="min-w-0 flex-1"><h3 className="[overflow-wrap:anywhere] font-semibold">{target.name}</h3><p className="mt-1 text-sm text-board-muted">{targetKinds[target.kind]}</p><p className="mt-2 break-all text-sm">{target.address}</p><p className="mt-3 text-sm font-medium">{status.label}</p><p className="mt-1 max-w-prose text-sm text-board-muted">{status.detail}</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" className={secondary} disabled={busy || w.locked} onClick={() => { setDraft({ ...target }); setFeedback(''); }} aria-label={`Edit ${target.name}`}>Edit</button><button type="button" className={secondary} disabled={busy || w.locked} onClick={() => persist(targets.filter(t => t.id !== target.id))} aria-label={`Remove ${target.name}`}>Remove</button></div>
    </li>; })}</ul>
    {draft ? <form className="mt-5 space-y-4 border-t border-board-line pt-5" onSubmit={e => { e.preventDefault(); const target = { ...draft, id: draft.id || crypto.randomUUID(), name: draft.name.trim(), address: draft.address.trim() }; persist(draft.id ? targets.map(t => t.id === draft.id ? target : t) : [...targets,target]); }}>
      <h3 className="font-semibold">{draft.id ? 'Edit target' : 'Add target'}</h3>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Name"><input autoFocus required maxLength={120} className={control} value={draft.name} placeholder="HiringCafe, company name, or account name" onChange={e => setDraft({ ...draft,name:e.target.value })} /></Field><Field label="Source type"><select className={control} value={draft.kind} onChange={e => setDraft({ ...draft,kind:e.target.value })}>{Object.entries(targetKinds).map(([kind,label]) => <option key={kind} value={kind}>{label}</option>)}</select></Field></div>
      <Field label={draft.kind === 'social' ? 'Profile URL or @handle' : 'Source URL'}><input required maxLength={2048} className={control} value={draft.address} placeholder={draft.kind === 'social' ? '@zero2sudo' : 'https://…'} onChange={e => setDraft({ ...draft,address:e.target.value })} /></Field>
      <div className="flex flex-wrap gap-2"><button className={primary} disabled={busy || w.locked}>{busy ? 'Saving…' : 'Save target'}</button><button type="button" className={secondary} disabled={busy} onClick={() => setDraft(null)}>Cancel</button></div>
    </form> : <button type="button" className={`${primary} mt-5`} disabled={busy || w.locked || targets.length >= 100} onClick={() => { setDraft({ ...blank }); setFeedback(''); }}>Add target</button>}
    {w.user && !w.demo && <button type="button" className={`${secondary} ml-2 mt-5`} disabled={busy} onClick={reload}>Reload saved list</button>}
    <Notice>{feedback}</Notice>
  </Section>;
}
export default function SearchTargets() { const w = useWorkspace(); return <Editor key={w.demo ? `demo-${w.demoEpoch}` : w.user?.id || 'guest'} />; }
