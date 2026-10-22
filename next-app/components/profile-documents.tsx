"use client";
import {useEffect,useState,type FormEvent} from "react";
import {useWorkspace} from "../lib/workspace";
import {useApplicationProfile} from "./application-profile-context";
import {parseRecruitingTargets,recruitingTargetsHeading,recruitingTargetsKey} from "../../lib/recruiting-targets.mjs";
import {updateField} from "../../lib/search-profile.mjs";
import Resumes from "./resumes";
import RecruitingTargets from "./recruiting-targets";
import ApplicationDocumentLibrary from "./application-document-library";
import {ProfileCard} from "./profile-section";
import {Field,control,primary,secondary} from "./ui";
export default function ProfileDocuments(){
 const w=useWorkspace(),a=useApplicationProfile();
 const [assignment,setAssignment]=useState<{resumeId:string;roles:string;employment:string}|null>(null);
 useEffect(()=>setAssignment(null),[a.profile.id]);
 function addAssignment(resumeId=""){setAssignment({resumeId,roles:"",employment:""});}
 async function saveAssignment(e:FormEvent){
  e.preventDefault();if(!assignment||a.busy||w.locked)return;
  try{
   if(!w.state.workflow.resumes.some((r:{id:string})=>r.id===assignment.resumeId))throw Error("Choose a resume from your library.");
   const field=a.field(recruitingTargetsHeading,recruitingTargetsKey);
   if(field.conflict)throw Error("Resolve duplicate Targets fields in Job preferences / Advanced instructions.");
   const targets=parseRecruitingTargets(field.value,{requireNames:true});
   const target={id:crypto.randomUUID(),name:assignment.roles.trim().slice(0,80),active:true,roles:assignment.roles.trim(),employment:assignment.employment,resumeId:assignment.resumeId,timeline:"",conditions:""};
   const next=[...targets,target];parseRecruitingTargets(JSON.stringify(next),{requireNames:true});
   const prompt=updateField(a.profile.prompt,recruitingTargetsHeading,recruitingTargetsKey,JSON.stringify(next));
   if(await a.saveProfilePrompt(prompt))setAssignment(null);
  }catch(e){a.setFeedback(e instanceof Error?e.message:"Could not save role assignment.");}
 }
 return <section aria-label="Documents" className="mt-8">
  <h2 className="text-lg font-bold">Documents</h2>
  <p className="mt-2 text-sm text-board-muted">Your resumes and cover letters. Reusable templates live in My Agent. Documents are shared; role assignments belong to {a.profile.name}.</p>
  <Resumes onAssign={addAssignment}/>
  <div className="mt-4"><button type="button" className={secondary} disabled={a.busy||w.locked||!w.state.workflow.resumes.length||!!assignment} onClick={()=>addAssignment()}>Add role assignment</button></div>
  {assignment&&<ProfileCard title="New role assignment"><form onSubmit={saveAssignment} className="space-y-5"><Field label="Assignment resume"><select className={control} value={assignment.resumeId} required disabled={a.busy} onChange={e=>setAssignment({...assignment,resumeId:e.target.value})}><option value="">Choose a resume</option>{w.state.workflow.resumes.map((r:{id:string;name:string})=><option key={r.id} value={r.id}>{r.name}</option>)}</select></Field><Field label="Assignment job titles"><input className={control} value={assignment.roles} required maxLength={500} disabled={a.busy} placeholder="Backend Engineer, Software Engineer" onChange={e=>setAssignment({...assignment,roles:e.target.value})}/></Field><Field label="Assignment job type"><select className={control} value={assignment.employment} disabled={a.busy} onChange={e=>setAssignment({...assignment,employment:e.target.value})}><option value="">Use profile job types</option>{["Full-time","Internship","Part-time","Contract","Temporary"].map(t=><option key={t}>{t}</option>)}</select></Field><p className="text-xs text-board-muted">Saves the application profile, including any other profile changes. This guides preparation; it does not authorize submission.</p><div className="flex flex-wrap gap-3"><button className={primary} disabled={a.busy||!assignment.roles.trim()||!assignment.resumeId}>{a.busy?"Saving…":"Save role assignment"}</button><button type="button" className={secondary} disabled={a.busy} onClick={()=>setAssignment(null)}>Cancel assignment</button></div></form><p role="status" className="mt-3 text-sm text-board-muted">{a.feedback}</p></ProfileCard>}
  <RecruitingTargets/>
  <ApplicationDocumentLibrary kind="cover_letter"/>

 </section>;
}
