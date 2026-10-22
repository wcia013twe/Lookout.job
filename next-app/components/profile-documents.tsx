"use client";
import {useEffect,useState,type FormEvent} from "react";
import {useWorkspace} from "../lib/workspace";
import {useApplicationProfile} from "./application-profile-context";
import {parseRecruitingTargets,recruitingTargetsHeading,recruitingTargetsKey} from "../../lib/recruiting-targets.mjs";
import {updateField} from "../../lib/search-profile.mjs";
import Resumes from "./resumes";
import ApplicationDocumentLibrary from "./application-document-library";
import {Field,control,primary,secondary} from "./ui";
export default function ProfileDocuments(){
 const w=useWorkspace(),a=useApplicationProfile();
 const [assignment,setAssignment]=useState<{resumeId:string;roles:string;employment:string;targetId?:string}|null>(null);
 useEffect(()=>setAssignment(null),[a.profile.id]);
 let targets:ReturnType<typeof parseRecruitingTargets>=[];
 try{targets=parseRecruitingTargets(a.field(recruitingTargetsHeading,recruitingTargetsKey).value);}catch{}
 const assignments:Record<string,string[]>={};
 for(const target of targets){if(target.resumeId)(assignments[target.resumeId]??=[]).push([target.roles||target.name,target.employment,target.active?"":"Paused"].filter(Boolean).join(" · "));}
 function addAssignment(resumeId=""){
  const target=targets.find(t=>t.resumeId===resumeId);
  setAssignment({resumeId,roles:target?.roles||"",employment:target?.employment||"",targetId:target?.id});
 }
 async function saveAssignment(e:FormEvent){
  e.preventDefault();if(!assignment||a.busy||w.locked)return;
  try{
   if(!w.state.workflow.resumes.some((r:{id:string})=>r.id===assignment.resumeId))throw Error("Choose a resume from your library.");
   const field=a.field(recruitingTargetsHeading,recruitingTargetsKey);
   if(field.conflict)throw Error("Resolve duplicate Targets fields in Job preferences / Advanced instructions.");
   const targets=parseRecruitingTargets(field.value,{requireNames:true});
   const previous=targets.find(t=>t.id===assignment.targetId);
   const target={id:crypto.randomUUID(),name:assignment.roles.trim().slice(0,80),active:true,resumeId:assignment.resumeId,timeline:"",conditions:"",...previous,roles:assignment.roles.trim(),employment:assignment.employment};
   const next=previous?targets.map(t=>t.id===previous.id?target:t):[...targets,target];parseRecruitingTargets(JSON.stringify(next),{requireNames:true});
   const prompt=updateField(a.profile.prompt,recruitingTargetsHeading,recruitingTargetsKey,JSON.stringify(next));
   if(await a.saveProfilePrompt(prompt))setAssignment(null);
  }catch(e){a.setFeedback(e instanceof Error?e.message:"Could not save role assignment.");}
 }
 return <section aria-label="Documents" className="mt-8">
  <h2 className="text-lg font-bold">Documents</h2>
  <p className="mt-2 text-sm text-board-muted">Your resumes, cover letters, and reusable templates. Documents are shared; role assignments belong to {a.profile.name}.</p>
  <Resumes onAssign={addAssignment} assignments={assignments}>
  {assignment&&<div className="mt-5 border-t border-board-line pt-5"><h4 className="mb-4 font-semibold">Assign roles · {w.state.workflow.resumes.find((r:{id:string})=>r.id===assignment.resumeId)?.name}</h4><form onSubmit={saveAssignment} className="space-y-5"><Field label="Assignment job titles"><input autoFocus className={control} value={assignment.roles} required maxLength={500} disabled={a.busy} placeholder="Backend Engineer, Software Engineer" onChange={e=>setAssignment({...assignment,roles:e.target.value})}/></Field><Field label="Assignment job type"><select className={control} value={assignment.employment} disabled={a.busy} onChange={e=>setAssignment({...assignment,employment:e.target.value})}><option value="">Use profile job types</option>{["Full-time","Internship","Part-time","Contract","Temporary"].map(t=><option key={t}>{t}</option>)}</select></Field><p className="text-xs text-board-muted">Saves the application profile, including any other profile changes. This guides preparation; it does not authorize submission.</p><div className="flex flex-wrap gap-3"><button className={primary} disabled={a.busy||!assignment.roles.trim()||!assignment.resumeId}>{a.busy?"Saving…":"Save role assignment"}</button><button type="button" className={secondary} disabled={a.busy} onClick={()=>setAssignment(null)}>Cancel assignment</button></div></form><p role="status" className="mt-3 text-sm text-board-muted">{a.feedback}</p></div>}
  </Resumes>
  <ApplicationDocumentLibrary kind="cover_letter"/>
  <ApplicationDocumentLibrary kind="application_template"/>
 </section>;
}
