"use client";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createProfileReview } from "../../lib/profile-review.mjs";
import rawSchema from "../../lib/profile-schema.js";
import { useWorkspace } from "../lib/workspace";
import { Field, control, primary, secondary, Notice } from "./ui";
import ProfileSection, {ProfileValues,profileSectionStyles as styles} from "./profile-section";
const labels: Record<string, string> = {
  name: "Full name",
  firstName: "First name",
  lastName: "Last name",
  preferredName: "Preferred name",
  suffix: "Suffix name",
  birthday: "Birthday",
  address: "Address",
  address2: "Address 2",
  address3: "Address 3",
  postalCode: "Postal code",
  email: "Email address",
  phone: "Phone number",
  location: "Location",
  linkedin: "LinkedIn URL",
  github: "GitHub URL",
  portfolio: "Portfolio URL",
  otherUrl: "Other URL",
  authorization: "Shared authorization notes",
  headline: "Current title",
  currentEmployer: "Current employer",
  jobSearchStatus: "Job search status",
  skills: "Skills",
  preferredSkills: "Skills you prefer to use",
  languages: "Languages",
};
const pillFields = ["skills", "preferredSkills", "languages"];
function pills(value: unknown): string[] {
  const entries = (Array.isArray(value) ? value : [value]).flatMap((item) =>
    typeof item === "string" ? item.split(/[,;\n]+/) : [],
  );
  const seen = new Set<string>();
  return entries.map((item) => item.trim()).filter((item) => {
    const key = item.toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function ProfilePills({ name, value, draft, onDraft, onChange }: {
  name: string; value: unknown; draft: string;
  onDraft: (value: string) => void; onChange: (value: string) => void;
}) {
  const items = pills(value);
  function add(text = draft) {
    onChange(pills([...items, text]).join("\n"));
    onDraft("");
  }
  return (
    <div className="min-w-0">
      <label htmlFor={`profile-${name}`} className="mb-2 block text-sm text-board-muted">{labels[name]}</label>
      {items.length > 0 && <ul aria-label={`${labels[name]} added`} className="mb-3 flex flex-wrap gap-2">
        {items.map((item) => <li key={item} className="inline-flex max-w-full items-center rounded-full border border-board-line bg-board-tag pl-3 text-sm text-board-text">
          <span className="min-w-0 break-words py-1">{item}</span>
          <button type="button" aria-label={`Remove ${item} from ${labels[name]}`} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-board-muted hover:text-board-text focus-visible:outline-2 focus-visible:outline-board-accent" onClick={() => onChange(items.filter((entry) => entry !== item).join("\n"))}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
          </button>
        </li>)}
      </ul>}
      <div className="flex items-start gap-2">
        <input id={`profile-${name}`} className={control} value={draft} autoComplete="off" title="Press Enter or comma to add, or paste a list" placeholder={name === "languages" ? "Add a language" : "Add a skill"}
          onChange={(event) => onDraft(event.target.value)}
          onBlur={() => { if (draft.trim()) add(); }}
          onKeyDown={(event) => {
            if (!event.nativeEvent.isComposing && ["Enter", ",", ";"].includes(event.key)) { event.preventDefault(); if (draft.trim()) add(); }
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text");
            if (/[,;\n]/.test(text)) {
              event.preventDefault();
              const input = event.currentTarget;
              add(draft.slice(0, input.selectionStart ?? draft.length) + text + draft.slice(input.selectionEnd ?? draft.length));
            }
          }}
        />
        <button type="button" className={secondary} aria-label={`Add to ${labels[name]}`} disabled={!draft.trim()} onClick={() => add()}>Add</button>
      </div>
    </div>
  );
}
type EntryKind = "workExperience" | "education" | "projects";
type ProfileEntry = Record<string, string | boolean | undefined>;
type ProfileFacts = Record<string, unknown> & { verified?: boolean } & Partial<
    Record<EntryKind, ProfileEntry[]>
  >;
type ProfileSchema = {
  scalarFields: string[];
  schemas: Record<EntryKind, [string, string, string?, string?][]>;
};
const schema = rawSchema as ProfileSchema;
const sections: Record<string, string> = {
  workExperience: "Work experience",
  education: "Education",
  projects: "Projects & outside experience",
};
export default function ProfileEditor({children}:{children?:ReactNode}) {
  const w = useWorkspace();
  const formId = useId();
  const profile: ProfileFacts = w.state.workflow.profile;
  const [facts, setFacts] = useState(profile),
    [checked, setChecked] = useState(false),
    [feedback, setFeedback] = useState("");
  const [pillDrafts, setPillDrafts] = useState<Record<string, string>>({});
  const review = useRef(createProfileReview());
  useEffect(() => {
    review.current.reset(profile, profile.verified);
    setFacts(profile);
    setPillDrafts({});
    setChecked(profile.verified === true);
  }, [JSON.stringify(profile), w.user?.id]);
  function update(key: string, value: unknown) {
    review.current.invalidate();
    const next = { ...facts, [key]: value };
    if(key==="firstName"||key==="lastName")next.name=[next.firstName,next.lastName].filter(Boolean).join(" ");
    setFacts(next);
    setChecked(false);
  }
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = { ...facts };
    for (const key of pillFields) values[key] = pills([...(pills(facts[key])), pillDrafts[key] || ""]).join("\n");
    for (const key of schema.scalarFields) {
      const element = form.elements.namedItem(key) as
        HTMLInputElement | HTMLTextAreaElement | null;
      if (element) {
        const value = element.value.trim();
        values[key] = value;
      }
    }
    const changed = schema.scalarFields.some((key) => {
      const current = pillFields.includes(key) ? pills(facts[key]).join("\n") : Array.isArray(facts[key])
        ? (facts[key] as string[]).join("\n")
        : facts[key] || "";
      return values[key] !== String(current).trim();
    });
    const verified = checked && !changed && review.current.isReviewed(facts);
    w.store.set("workflow.profile", {
      ...values,
      verified,
    });
    setFeedback(
      verified
        ? "Profile saved and checked by you."
        : "Profile saved as unverified. Review changed facts before checking them.",
    );
  }
  const groups = [
    {title:"Personal Info",keys:["firstName","lastName","preferredName","suffix","email","phone","birthday","location","address","address2","address3","postalCode",...(!facts.firstName&&!facts.lastName?["name"]:[])]},
    {title:"Professional summary",keys:["headline","currentEmployer","jobSearchStatus"]},
    {title:"Professional links",keys:["linkedin","github","portfolio","otherUrl"]},
    {title:"Shared authorization notes",keys:["authorization"]},
  ];
  const renderGroup=(group:typeof groups[number])=>(<ProfileSection key={group.title} title={group.title} resetKey={profile}>{editing=>editing?<fieldset><legend className="sr-only">{group.title}</legend><div className="grid gap-5 sm:grid-cols-2">{group.keys.map(key=><Field label={labels[key]} key={key}><input form={formId} id={`profile-${key}`} name={key} className={control} value={(facts[key] as string)||""} type={key==='email'?'email':key==='phone'?'tel':key==='birthday'?'date':['linkedin','github','portfolio','otherUrl'].includes(key)?'url':'text'} autoComplete={({name:'name',firstName:'given-name',lastName:'family-name',preferredName:'nickname',suffix:'honorific-suffix',email:'email',phone:'tel',birthday:'bday',location:'address-level2',address:'address-line1',address2:'address-line2',address3:'address-line3',postalCode:'postal-code'} as Record<string,string>)[key]||'off'} onChange={e=>update(key,e.target.value)}/></Field>)}</div></fieldset>:<ProfileValues items={group.keys.map(key=>({label:labels[key],value:facts[key],wide:key==='authorization'}))}/>}</ProfileSection>);
  return <>
    {renderGroup(groups[0])}
    {children}
    <h2 className="mb-3 mt-8 text-lg font-bold">Career background</h2>
    <form id={formId} autoComplete="on" onSubmit={save}>
      {groups.slice(1).map(renderGroup)}
      {(Object.entries(schema.schemas) as [EntryKind,ProfileSchema["schemas"][EntryKind]][]).map(([kind,fields])=><ProfileSection key={kind} title={sections[kind]} resetKey={profile}>{editing=><>
        {(facts[kind]||[]).map((entry,index)=><div className={styles.entry} key={index}>
          <div className={styles.entryHeading}><img className={styles.entryLogo} src={`/profile-icons/${kind==='workExperience'?'work':kind==='education'?'education':'project'}.svg`} alt="" width="48" height="48"/><h4>{entry.title||entry.degree||entry.name||"New entry"}{(entry.company||entry.school)&&<> · {entry.company||entry.school}</>}</h4></div>
          {editing?<><div className="grid gap-4 sm:grid-cols-2">{fields.map(([key,label,type='text',autocomplete='off'])=><div className={type==='textarea'?'sm:col-span-2':undefined} key={key}><Field label={label}>{type==='textarea'?<textarea className={control} value={(entry[key] as string)||""} onChange={e=>update(kind,facts[kind]!.map((v,i)=>i===index?{...v,[key]:e.target.value}:v))}/>:<input className={type==='checkbox'?'h-5 w-5 accent-board-accent':control} type={type} autoComplete={autocomplete} checked={type==='checkbox'?entry[key]===true:undefined} value={type==='checkbox'?undefined:(entry[key] as string)||""} onChange={e=>update(kind,facts[kind]!.map((v,i)=>i===index?{...v,[key]:type==='checkbox'?e.target.checked:e.target.value}:v))}/>}</Field></div>)}</div><button type="button" className={`${secondary} mt-4`} onClick={()=>update(kind,facts[kind]!.filter((_,i)=>i!==index))}>Remove entry</button></>:<ProfileValues items={fields.map(([key,label,type])=>({label,value:type==='checkbox'?entry[key]===true:entry[key],wide:type==='textarea'}))}/>}
        </div>)}
        {!facts[kind]?.length&&<p className="text-sm text-board-muted">No entries added yet.</p>}
        {editing&&<button type="button" className={`${secondary} mt-5`} onClick={()=>update(kind,[...(facts[kind]||[]),{}])}>Add {sections[kind].toLowerCase()}</button>}
      </>}</ProfileSection>)}
      <ProfileSection title="Skills & languages" resetKey={profile}>{editing=>editing?<div className="grid gap-5 sm:grid-cols-2">{pillFields.map(key=><ProfilePills key={key} name={key} value={facts[key]} draft={pillDrafts[key]||""} onDraft={value=>{review.current.invalidate();setChecked(false);setPillDrafts(current=>({...current,[key]:value}));}} onChange={value=>update(key,value)}/>)}</div>:<>{pillFields.map(key=><div key={key} className={styles.skillGroup}><h4>{labels[key]}</h4>{pills([...(pills(facts[key])),pillDrafts[key]||""]).length?<ul className={styles.tags} aria-label={labels[key]}>{pills([...(pills(facts[key])),pillDrafts[key]||""]).map(item=><li key={item}>{item}</li>)}</ul>:<p className="text-sm text-board-muted">Not provided</p>}</div>)}</>}</ProfileSection>
      <div className="mt-7 space-y-3 border-t border-board-line py-5">
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={checked} onChange={e=>{review.current.check(facts,e.target.checked,e.nativeEvent.isTrusted);setChecked(e.target.checked&&e.nativeEvent.isTrusted);}} className="h-5 w-5 accent-board-accent"/>I have checked these facts.</label>
        <button className={primary}>Save shared background</button><Notice>{feedback}</Notice>
      </div>
    </form>
  </>;
}
