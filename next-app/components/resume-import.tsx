"use client";
import {useContext,useEffect,useRef,useState} from 'react';
import {motion,useReducedMotion} from 'framer-motion';
import {ProfileDraftContext} from './profile-draft-context';
import {useWorkspace} from '../lib/workspace';
import {requestResumeParse,profileImportChoices,selectedProfileFields} from '../../lib/resume-import.mjs';
import {primary,secondary,Notice} from './ui';
const labels:Record<string,string>={name:'Full name',firstName:'First name',lastName:'Last name',email:'Email',phone:'Phone',location:'Location',introduction:'Introduction',linkedin:'LinkedIn',github:'GitHub',portfolio:'Portfolio',skills:'Skills',languages:'Languages',workExperience:'Work experience',education:'Education',projects:'Projects',title:'Job title',company:'Company',school:'School',degree:'Degree',fieldOfStudy:'Field of study',startDate:'Start date',endDate:'End date',current:'Current role',description:'Description',employmentType:'Employment type',gpa:'GPA',role:'Role',url:'Link'};
function Value({value}:{value:unknown}){
 if(Array.isArray(value))return <ul className="space-y-3">{value.map((entry,index)=><li key={index}><dl className="space-y-1">{Object.entries(entry).map(([key,item])=><div key={key}><dt className="inline font-medium">{labels[key]||key}: </dt><dd className="inline whitespace-pre-wrap break-words">{typeof item==='boolean'?(item?'Yes':'No'):String(item)}</dd></div>)}</dl></li>)}</ul>;
 return <span className="whitespace-pre-wrap break-words">{String(value||'Not provided')}</span>;
}
function ProcessingStep({label,done,active=false}:{label:string;done:boolean;active?:boolean}){
 const reduce=useReducedMotion();
 return <li className="flex items-center gap-3 py-2 text-sm"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${done?'bg-board-success/10 text-board-success':'text-board-muted'}`}>
 {done?<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><motion.path d="m5 12 4 4L19 6" initial={{pathLength:reduce?1:0}} animate={{pathLength:1}} transition={{duration:.3,ease:[.16,1,.3,1]}}/></svg>:<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" className={active?'motion-safe:animate-spin':''}><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" opacity=".25"/>{active&&<path d="M12 4a8 8 0 0 1 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>}</svg>}
 </span><span>{label}</span><span className="sr-only">{done?'Completed':active?'In progress':'Pending'}</span></li>;
}
export default function ResumeImport({resumeId,onClose,autoStart=false,onComplete}:{resumeId:string;onClose?:()=>void;autoStart?:boolean;onComplete?:()=>void}){
 const draftPending=useContext(ProfileDraftContext);
 const w=useWorkspace(),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState(''),[proposal,setProposal]=useState<any>(null),[selected,setSelected]=useState<string[]>([]),[saved,setSaved]=useState(false);
 const lock=useRef(false),baseline=useRef<any>(null),identity=useRef('');
 const started=useRef(false);
 useEffect(()=>{
  if(!autoStart||started.current||w.locked||draftPending)return;
  started.current=true;void parse();
 });
 const owner=()=>w.demo?'demo-'+w.demoEpoch:window.JB.auth.userId;
 async function parse(){
  if(lock.current||w.locked||draftPending)return;lock.current=true;setBusy(true);setFeedback('');setSaved(false);
  identity.current=owner();
  try{
   if(!w.demo)await window.JB.cloud.save();
   baseline.current=structuredClone(w.store.get('workflow.profile'));
   const result=w.demo?{resumeId,profileUpdatedAt:'2026-01-01T00:00:00Z',profileFacts:baseline.current,facts:{name:'Jordan Example',skills:'TypeScript\nPostgreSQL',workExperience:[{company:'Example Systems',title:'Software Engineering Intern',description:'Dates returned by parser: June–August 2026'}]},warnings:['Fictional extraction preview. No file is sent to APILayer and no API credits are used.','Dates returned by the parser may be normalized or incomplete. They are preserved in descriptions; check the original resume before filling date fields.']}:await requestResumeParse({client:w.client,getOwner:()=>window.JB.auth.userId,resumeId,apiUrl:process.env.NEXT_PUBLIC_LOOKOUT_API_URL});
   if(owner()!==identity.current)return;
   if(JSON.stringify(w.store.get('workflow.profile'))!==JSON.stringify(baseline.current))throw Error('Your profile changed during parsing. Start the import again.');
   const choices=profileImportChoices(result.profileFacts,result.facts);
   setProposal({...result,choices});setSelected(choices.filter((c:any)=>c.selected).map((c:any)=>c.key));
  }catch(e){if(owner()===identity.current)setFeedback(e instanceof Error?e.message:'Could not parse this resume. Your file is saved.');}
  finally{lock.current=false;setBusy(false);}
 }
 async function save(){
  if(lock.current||w.locked||draftPending||!proposal||!selected.length)return;
  lock.current=true;setBusy(true);setFeedback('');
  try{
   if(owner()!==identity.current)throw Error('Account changed. Start the import again.');
   const fields=selectedProfileFields(proposal.choices,selected);
   if(w.demo){if(JSON.stringify(w.store.get('workflow.profile'))!==JSON.stringify(baseline.current))throw Error('Your profile changed. Start the import again.');w.store.set('workflow.profile',{...baseline.current,...fields,verified:false});}
   else await window.JB.cloud.importProfileFields(fields,proposal.profileUpdatedAt,baseline.current);
   if(owner()!==identity.current)return;
   setProposal(null);setSaved(true);setFeedback(w.demo?'Demo profile updated in memory. Reset the demo to restore it.':'Profile details saved. You can edit them in My Profile.');
  }catch(e){setFeedback(e instanceof Error?e.message:'Could not save imported details. Review your current profile before retrying.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <section aria-label="Resume profile autofill" aria-busy={busy} className="mt-5 space-y-4 border-t border-board-line pt-5">
  <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{saved?'Your profile is saved':proposal?'Review extracted details':autoStart?'Building your profile':'Fill your profile from this resume'}</h3>{onClose&&<button type="button" className={secondary} disabled={busy} onClick={onClose}>Close</button>}</div>
  {!proposal&&!saved&&!autoStart&&<><p className="max-w-prose text-sm text-board-muted">{w.demo?'Preview a fictional resume import. No file leaves this demo.':'Send this resume to APILayer to extract your profile details. APILayer states that uploaded files are deleted after 15 seconds and parsed results are not retained. Scanned-resume support is unverified; use a text-based PDF or DOCX. You choose what to save; existing details stay unchanged until then.'}</p><button type="button" className={secondary} disabled={busy||w.locked||draftPending} onClick={()=>void parse()}>{busy?'Reading resume…':w.demo?'Preview autofill':'Autofill with APILayer'}</button></>}
  {(autoStart||saved||proposal)&&<ol aria-label="Profile processing" aria-live="polite" className="py-2">
   <ProcessingStep label="Résumé saved" done/>
   <ProcessingStep label={proposal||saved?'Profile details extracted':feedback&&!proposal?'Extraction needs attention':'Extracting profile details'} done={Boolean(proposal)||saved} active={busy&&!proposal&&!saved}/>
   <ProcessingStep label={saved?'Profile details saved':proposal&&busy?'Saving your profile':'Save reviewed profile details'} done={saved} active={busy&&Boolean(proposal)}/>
  </ol>}
  {saved&&autoStart&&<button type="button" className={primary} onClick={onComplete}>Continue</button>}
  {proposal&&<>
   <p className="text-sm text-board-muted">Missing fields are selected. Existing fields are unchecked. Selecting a history section replaces that entire section; compare every entry before saving. Imported details remain unverified.</p>
   {proposal.warnings.map((warning:string)=><p key={warning} role="status" className="text-sm text-board-muted">{warning}</p>)}
   {!proposal.choices.length?<><p className="text-sm">Your saved profile already matches the extracted details.</p>{autoStart&&<button type="button" className={primary} onClick={onComplete}>Continue</button>}</>:<ul className="divide-y divide-board-line">{proposal.choices.map((choice:any)=><li key={choice.key} className="py-4"><label className="flex min-h-11 cursor-pointer items-center gap-3 font-medium"><input type="checkbox" className="h-5 w-5 accent-board-accent" checked={selected.includes(choice.key)} disabled={busy||w.locked||draftPending} onChange={e=>setSelected(keys=>e.target.checked?[...keys,choice.key]:keys.filter(key=>key!==choice.key))}/>{labels[choice.key]||choice.key}</label><div className="mt-3 grid gap-5 text-sm sm:grid-cols-2"><div><p className="mb-2 font-medium text-board-muted">Saved</p><Value value={choice.existing}/></div><div><p className="mb-2 font-medium text-board-muted">From resume</p><Value value={choice.value}/></div></div></li>)}</ul>}
   <div className="flex flex-wrap gap-3"><button type="button" className={primary} disabled={busy||w.locked||draftPending||!selected.length} onClick={()=>void save()}>{busy?'Saving…':'Save selected details'}</button><button type="button" className={secondary} disabled={busy} onClick={()=>{setProposal(null);setFeedback('');if(autoStart)onClose?.();}}>Discard changes</button></div>
  </>}
  <Notice>{draftPending?"Save your background edits with their section checkmark before importing resume details.":feedback}</Notice>
 </section>;
}
