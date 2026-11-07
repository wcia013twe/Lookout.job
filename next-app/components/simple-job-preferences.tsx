"use client";
import {useApplicationProfile} from "./application-profile-context";
import {Field,control} from "./ui";
import ProfileSection,{ProfileValues} from "./profile-section";

const fields = [
  {heading:"Role preferences",key:"Roles",label:"Roles",placeholder:"Backend Engineer, Software Engineer"},
  {heading:"Search Filters",key:"Employment",label:"Job type",options:["Full-time","Internship","Full-time, Internship","Contract"]},
  {heading:"Search Filters",key:"Location",label:"Locations",placeholder:"United States, New York, remote"},
  {heading:"Search Filters",key:"Work arrangement",label:"Work arrangement",options:["Any","Remote preferred","Remote required","Hybrid","On-site"]},
  {heading:"Search Filters",key:"Minimum base pay",label:"Minimum base pay",placeholder:"USD 100,000/year, or leave blank"},
  {heading:"Avoid",key:"Companies to avoid",label:"Companies to avoid",placeholder:"Company names, separated by commas"},
  {heading:"Profile evaluation",key:"Rules",label:"Additional preferences",placeholder:"Anything else your agent should consider."},
];

export default function SimpleJobPreferences(){
  const a=useApplicationProfile();
  return <>
    <div className="mb-6"><h2 className="text-xl font-bold">Job preferences</h2><p className="mt-2 text-sm text-board-muted">One search profile. Choose your résumé in About me.</p></div>
    <ProfileSection title="Search preferences" resetKey={a.profile.id} disabled={a.busy} onFinish={a.saveProfile}>
      {editing=>editing?<div className="grid gap-5 sm:grid-cols-2"><label className="flex min-h-11 items-center gap-3 text-sm sm:col-span-2"><input type="checkbox" checked={a.profile.active} disabled={a.busy} onChange={e=>a.patch({active:e.target.checked})}/>Job search active</label>{fields.map(f=>{
        const saved=a.field(f.heading,f.key);
        return <div key={f.key} className={f.key==="Rules"?"sm:col-span-2":undefined}><Field label={f.label}>
          {f.options?<select className={control} value={saved.value} disabled={a.busy||saved.conflict} onChange={e=>a.change(f.heading,f.key,e.target.value)}>
            <option value="">No preference</option>{f.options.map(option=><option key={option}>{option}</option>)}
            {saved.value&&!f.options.includes(saved.value)&&<option value={saved.value}>{saved.value}</option>}
          </select>:f.key==="Rules"?<textarea className={control} rows={3} value={saved.value} placeholder={f.placeholder} disabled={a.busy||saved.conflict} onChange={e=>a.change(f.heading,f.key,e.target.value)}/>:<input className={control} value={saved.value} placeholder={f.placeholder} disabled={a.busy||saved.conflict} onChange={e=>a.change(f.heading,f.key,e.target.value)}/>}
          {saved.conflict&&<p className="text-xs text-board-muted">Conflicting saved values. Ask your agent to reconcile this field before editing.</p>}
        </Field></div>;
      })}</div>:<ProfileValues items={[{label:"Search status",value:a.profile.active?"Active":"Paused"},...fields.map(f=>({label:f.label,value:a.field(f.heading,f.key).conflict?"Conflicting saved values":a.field(f.heading,f.key).value,wide:f.key==="Rules"}))]}/>}
    </ProfileSection>
    <p className="mt-4 text-xs text-board-muted">Other saved preferences are preserved. Ask your agent to review them before changing your search.</p>
  </>;
}
