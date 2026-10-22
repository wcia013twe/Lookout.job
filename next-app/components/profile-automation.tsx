"use client";
import { useWorkspace } from '../lib/workspace';
import { useApplicationProfile } from './application-profile-context';
import { profileAutomationSettings } from '../../lib/application-policy.mjs';
import { updateField } from '../../lib/search-profile.mjs';
import { Section, Field, control, primary, Notice } from './ui';
import TierLists from './tierlists';

export default function ProfileAutomation() {
  const w=useWorkspace(),a=useApplicationProfile();
  const settings=profileAutomationSettings(a.profile,w.state.workflow.searchPreferences||{});
  function nextPrompt(fields:Partial<typeof settings>) {
    const next={...settings,...fields};
    try {
      let prompt=updateField(a.profile.prompt,'Application automation','Auto-apply routine matches',next.enabled?'Yes':'No');
      prompt=updateField(prompt,'Application automation','Review threshold',next.threshold);
      prompt=updateField(prompt,'Company priorities','Tier list ID',next.tierListId);
      const list=w.state.workflow.tierLists.find((item:{id:string})=>item.id===next.tierListId);
      prompt=updateField(prompt,'Company priorities','Tier list name',list?.name||'');
      return prompt;
    } catch(e){a.setFeedback(e instanceof Error?e.message:'Could not update these settings.');}
  }
  function change(fields:Partial<typeof settings>){const prompt=nextPrompt(fields);if(prompt!==undefined)a.patch({prompt});}
  function save(){const prompt=nextPrompt({});if(prompt!==undefined){a.patch({prompt});void a.saveProfilePrompt(prompt);}}
  return <Section title="Application automation">
    <p className="mb-5 text-sm text-board-muted">Automation rules for {a.profile.name}. Switch profiles using the selector above.</p>
    <fieldset disabled={a.busy||w.locked||settings.conflict}>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-board-accent" checked={settings.enabled} onChange={e=>change({enabled:e.target.checked})}/>Auto-apply routine matches for this profile</label>
      <p className="mb-5 mt-2 text-sm leading-relaxed text-board-muted">Important matches, missing facts, unfamiliar answers, and uncertain outcomes require review. Submission needs a connected supported runner.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company tier list"><select className={control} value={settings.tierListId} onChange={e=>change({tierListId:e.target.value})}><option value="">Choose a company list</option>{settings.tierListId&&!w.state.workflow.tierLists.some((list:{id:string})=>list.id===settings.tierListId)&&<option value={settings.tierListId}>Previously selected list unavailable</option>}{w.state.workflow.tierLists.map((list:{id:string;name:string})=><option key={list.id} value={list.id}>{list.name}</option>)}</select></Field>
        <Field label="Review threshold"><select className={control} value={settings.threshold} onChange={e=>change({threshold:e.target.value})}>{['S','A','B','C','D','all'].map(t=><option value={t} key={t}>{t==='all'?'Review every match':`${t} tier and above`}</option>)}</select></Field>
      </div>
    </fieldset>
    {settings.conflict&&<Notice>Resolve duplicate automation or company-list fields in this profile’s Advanced instructions before editing.</Notice>}
    <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" className={primary} disabled={a.busy||w.locked||settings.conflict||!a.profile.name.trim()} onClick={save}>{a.busy?'Saving…':'Save profile rules'}</button><p className="text-xs text-board-muted">Changes save with this application profile.</p></div>
    <Notice>{a.feedback}</Notice>
    <TierLists selectedListId={settings.tierListId||undefined} onSelectList={id=>change({tierListId:id})}/>
  </Section>;
}
