"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import { useWorkspace } from "../lib/workspace";
import { control, primary, Field } from "./ui";
import type { Role } from "./role-card";
import ProfileIcon from "./profile-icon";
import {applicationReviewQuestions,applicationReviewSummary,applicationReviewGroups} from "../../lib/application-review.mjs";
import {confirmDraftAnswer} from "../../lib/confirm-draft-answer.mjs";
import styles from "./discover-role-panel.module.css";
type Question={id?:string;fieldId?:string;question:string;answer?:string;reason?:string;required?:boolean;fieldType?:string;maxLength?:number;options?:{value:string;label:string}[]};
function AnswerEditor({question,revision,disabled,onConfirm}:{question:Question;revision:number;disabled:boolean;onConfirm:(id:string,answer:string,revision:number)=>Promise<void>}){
 const [value,setValue]=useState(question.answer||""),[base,setBase]=useState(revision),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState("");
 useEffect(()=>{if(!dirty&&!busy){setValue(question.answer||"");setBase(revision);}},[question.answer,revision,dirty,busy]);
 function edit(v:string){setValue(v);setDirty(true);setSaved(false);setError("");}
 async function confirm(){setBusy(true);setError("");try{await onConfirm(question.fieldId||question.id||"",value,base);setDirty(false);setSaved(true);}catch(e){setError(e instanceof Error?e.message:"Could not save. Try again.");}finally{setBusy(false);}}
 const props={"aria-label":question.question,className:control,value,disabled:disabled||busy,onChange:(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>edit(e.target.value)};
 return <div className={styles.reviewQuestion}>
  <Field label={question.question}>{["select","radio"].includes(question.fieldType||"")?<select {...props}><option value="">Choose an answer</option>{question.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:question.fieldType==="textarea"?<textarea {...props} rows={3} maxLength={question.maxLength} placeholder="Write your answer"/>:<input {...props} type="text" maxLength={question.maxLength} placeholder="Your answer"/>}</Field>
  <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" className={primary} disabled={disabled||busy||!value.trim()||(saved&&!dirty)} onClick={confirm}>{busy?"Saving…":saved&&!dirty?"Confirmed":"Confirm answer"}</button>{saved&&!dirty&&<span role="status" className="text-sm text-board-success">Saved to draft</span>}</div>
  {error&&<p role="alert" className="mt-2 text-sm text-board-warning">{error}</p>}
 </div>;
}
export default function RoleApplicationPreview({role}:{role:Role}){
 const w=useWorkspace(),draft=w.state.workflow.applications[role.id];
 const source:Question[]=draft?.questions||(w.demo?role.reviewPreview?.map((q:Question,i:number)=>({...q,id:`demo-review-${i}`})):[])||[];
 const groups=applicationReviewGroups(source,draft?.questionsReviewed===true),summary=applicationReviewSummary(source,draft?.questionsReviewed===true);
 const optionalLabels=[...new Set(groups.optional.map((q:Question)=>q.question))];
 const checkedAt=draft?.inspectedAt&&Number.isFinite(Date.parse(draft.inspectedAt))?new Date(draft.inspectedAt).toLocaleString():null;
 if(!draft&&applicationReviewQuestions(source).length===0)return null;
 const editable=!w.locked&&(w.demo||Boolean(w.user&&draft&&w.models.workflowModel.canEdit(draft)));
 async function confirm(fieldId:string,answer:string,expectedRevision:number){
  const owner=w.user?.id,epoch=w.demoEpoch;
  if(!editable)throw Error('Wait for your workspace to connect before saving.');
  if(w.demo&&!w.store.get('workflow.applications')[role.id]){
   const initial=w.models.workflowModel.create(role);w.store.update('workflow.applications',(apps:any)=>({...apps,[role.id]:{...initial,questions:source}}));
  }
  await confirmDraftAnswer({store:w.store,model:w.models.workflowModel,jobId:role.id,fieldId,answer,expectedRevision,
   isCurrent:()=>w.demo?w.demoEpoch===epoch:window.JB?.auth?.userId===owner,
   save:async()=>{if(!w.demo){if(!window.JB?.cloud?.ready)throw Error('Not connected. Your answer is kept here; retry when connected.');await window.JB.cloud.save();}},
  });
 }
 return <section aria-labelledby="application-preview" className={styles.application}>
  <h3 id="application-preview" className="mb-4 text-lg font-semibold">Application answers</h3>
  {groups.human.map((q:Question)=><AnswerEditor key={q.fieldId||q.id||q.question} question={q} revision={draft?.backendRevision??draft?.revision??0} disabled={!editable} onConfirm={confirm}/>)}
  {groups.human.length===0&&<p className="text-sm text-board-muted">No answers needed from you right now.</p>}
  {groups.agent.length>0&&<p className="mt-4 text-sm text-board-muted">Your agent has {groups.agent.length} {groups.agent.length===1?"answer":"answers"} to draft.</p>}
  {groups.optional.length>0&&<details className="mt-5 border-t border-board-line pt-3"><summary className="cursor-pointer text-sm font-semibold">Optional questions ({optionalLabels.length})</summary><ul className="mt-2 list-disc pl-5 text-sm text-board-muted">{optionalLabels.map((label,index)=><li key={index}>{label}</li>)}</ul></details>}
  <details className="mt-4 text-xs text-board-muted"><summary className="cursor-pointer">Preparation details</summary><p className="mt-2">{summary.filled} saved answers. {checkedAt?`Form checked ${checkedAt}. `:""}Conditional fields still need browser review.</p><p className="mt-2">Confirming saves this answer only. Application approval and submission are separate.</p></details>
  {draft&&<Link href="/applications/" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-board-accent">View full application<ProfileIcon name="arrow" width={16} height={16}/></Link>}
 </section>;
}
