"use client";
import {useState,useId} from 'react';
import Link from 'next/link';
import DiscoveredRoleWidget from './discovered-role-widget';
import {answerDisclosure,draftInferences,applicationActionLabel,showAnswerOnCard} from '../../lib/application-disclosures.mjs';
import JobAttachment from '../app/circles/_components/job-attachment';
import CommunicationAttachment from './communication-attachment';
import {applicationContext} from '../../lib/circle-attachments.mjs';
import {trackerProgress} from '../../lib/tracker-display.mjs';
import {importStatuses} from '../../lib/simplify-import.mjs';
import type {Application} from './workflow-types';
import {useWorkspace} from '../lib/workspace';
import {SwipeDecision} from './decision-buttons';
import type {BoardItem} from '../lib/use-action-board';
import styles from './action-decision-card.module.css';
import ActionAttention from './action-attention';
import {needsUnblocking} from '../../lib/action-board.mjs';
const answerText=(value:unknown):string=>value==null?'':typeof value==='string'?value:typeof value==='object'?JSON.stringify(value):String(value);
const names:Record<string,string>={review_application:'Review application',prepared_application:'Finish application',resolve_blocker:'Your answer is needed',check_submission:'Verify submission',submit_application:'Confirm your submission',verify_answer:'Confirm an answer',missing_answer:'Add your answer',confirm_interview:'Confirm interview',review_outreach:'Review message',imported_action:'Next action'};
const verbs:Record<string,[string,string]>={review_application:['Approve this revision','Keep saved; stop agent work'],prepared_application:['Save answers for review','Keep saved; stop agent work'],resolve_blocker:['Save and resume Muse','Keep saved; stop agent work'],check_submission:['Record that I submitted','Verify it was not submitted'],submit_application:['Record that I submitted','Keep saved; stop agent work'],verify_answer:['Verify answer','Leave answer unverified'],missing_answer:['Save and verify answer','Decline this question'],confirm_interview:['Confirm these details','Mark details incorrect'],review_outreach:['Mark ready for me to send','Decline this message'],imported_action:['Approve this action for Muse','Stop agent work on this action']};
function KindIcon({kind}:{kind:string}){return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='review_outreach'?<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></>:kind==='confirm_interview'?<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18m-11 5 2 2 4-4"/></>:['verify_answer','missing_answer','resolve_blocker'].includes(kind)?<><path d="M21 11a8 8 0 0 1-8 8H6l-4 3V11a9 9 0 0 1 19 0Z"/><path d="M9 8a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01"/></>:kind.includes('submission')||kind==='submit_application'?<><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></>:<><path d="M14 2H5v20h14V7Z"/><path d="M14 2v5h5M8 12h8M8 16h6"/></>}</svg>;}
export default function ActionDecisionCard({item,busy,onRespond,onSaveMessage}:{item:BoardItem;busy:boolean;onRespond:(item:BoardItem,response:string,policy?:string,input?:Record<string,unknown>)=>Promise<boolean>;onSaveMessage:(item:BoardItem,fields:{subject:string;message:string})=>Promise<void>}){
 const w=useWorkspace();
 const id=useId(),[answers,setAnswers]=useState((item.questions||[]).map(q=>answerText(q.answer))),[answer,setAnswer]=useState(item.kind==='missing_answer'?'':item.body||''),[policy,setPolicy]=useState('ask'),[confirmed,setConfirmed]=useState(false),[note,setNote]=useState(''),[at,setAt]=useState(item.proposedAt||''),[resumeId,setResumeId]=useState(item.resume?.id||'');
 const [error,setError]=useState(''),[editingMessage,setEditingMessage]=useState(false),[message,setMessage]=useState(item.body||''),[subject,setSubject]=useState(item.subject||'');
 const native=['review_application','prepared_application','resolve_blocker'].includes(item.kind),question=['verify_answer','missing_answer'].includes(item.kind),outcome=['check_submission','submit_application'].includes(item.kind),outreach=item.kind==='review_outreach',interview=item.kind==='confirm_interview';
 const reviewQuestions=(item.questions||[]).filter(showAnswerOnCard);
 const dirty=native&&(resumeId!==(item.resume?.id||'')||answers.some((value,index)=>value!==answerText(item.questions?.[index]?.answer)));
 const complete=(item.questions||[]).every((q,index)=>q.required===false||q.fieldType==='hidden'||(!!answers[index]?.trim()&&answers[index].trim().toLowerCase()!=='ask me'));
 const blockedFile=(item.questions||[]).some((q,index)=>q.fieldType==='file'&&q.required!==false&&!answers[index]?.trim());
 const needsNote=outcome||(item.kind==='resolve_blocker'&&!reviewQuestions.length);
 const ready=question?!!answer.trim():outcome?!!note.trim()&&confirmed:native?complete&&!blockedFile&&(item.kind==='review_application'&&!dirty?item.reviewed:confirmed)&&(!needsNote||!!note.trim()):interview?!!at:outreach?!!item.reviewed:true;
 const acceptDisabled=busy||editingMessage||!ready||(item.requiresReview&&!item.reviewed&&!dirty)||!item.canAccept;
 const rejectDisabled=busy||editingMessage||!item.canReject||(item.kind==='check_submission'&&(!note.trim()||!confirmed));
 const actionVerbs=verbs[item.kind]||['Accept action','Reject action'];
 const acceptVerb=dirty&&item.kind==='review_application'?'Save changes for a new review':actionVerbs[0];
 const objectLabel=item.reference?.label||item.company||item.recipient||'Saved answer';
 const objectDetail=item.reference?.detail||item.role||item.recipient;
 const applicationItem=!!item.applicationId||item.kind==='imported_action';
 const application=Object.values(w.state.workflow.applications as Record<string,Application>).find(app=>app.backendId===item.applicationId);
 const savedRole=w.roles?.find((role:{id:string})=>role.id===application?.id);
 const stage=application?trackerProgress(application,w.state.tracker.items[application.id]||{}).status:importStatuses[item.status||'']||item.status;
 const context=applicationContext(application||{company:item.company,title:item.role},stage);
 const attachment={title:item.role||application?.title||'Application',body:'',type:'discussion',sources:[],provenance:'private_record',personalDisclosure:false,...context};

 async function saveMessage(){
  setError('');
  try{await onSaveMessage(item,{subject,message});setEditingMessage(false);}
  catch{setError('The message could not save. Your edits are kept. Reload actions if the saved draft changed, then try again.');}
 }
 async function respond(response:string){
  setError('');let input:Record<string,unknown>|undefined;
  if(response==='accept'){
   if(question)input={answer};
   else if(native&&(item.kind!=='review_application'||dirty))input={answers,confirmed,...(resumeId?{resumeId}:{}),...(note?{note}:{})};
   else if(outcome)input={note,confirmed};
   else if(interview&&at!==item.proposedAt)input={at,timeZone:'UTC'};
  }else if(item.kind==='check_submission')input={note,confirmed};
  const saved=await onRespond(item,response==='accept'&&dirty&&item.kind==='review_application'?'save':response,question?policy:undefined,input);
  if(!saved)setError('This action could not save. Your entries are kept. Reload actions to check its current version.');
 }
 return <li className={`action-board-row ${styles.card}`} data-kind={item.kind}>
 <SwipeDecision canAccept={!acceptDisabled} canReject={!rejectDisabled} disabled={busy} onRespond={response=>void respond(response)}>
  <header className={styles.header}><span className={styles.kindIcon}><KindIcon kind={item.kind}/></span><h3>{applicationActionLabel(item)||names[item.kind]||'Your decision'}</h3>{needsUnblocking(item)&&<ActionAttention count={1} compact/>}{item.kind==='review_application'&&<span className={styles.revision}>Revision {item.version}</span>}</header>
  {applicationItem?<div className={styles.applicationReference}>{(native||outcome)?<DiscoveredRoleWidget compact role={{id:item.applicationId||item.sourceId,company:item.company||application?.company||'Saved application',title:item.role||application?.title||'Application',priority:savedRole?.priority,fitLabel:savedRole?.fitLabel}}/>:<JobAttachment content={attachment}/>}<Link className={styles.applicationDetailsLink} aria-label={`Open application details for ${item.company||application?.company||'saved application'}`} href={`${item.href}&returnTo=%2Fneeds-you%2F`} onClick={()=>{try{sessionStorage.setItem('lookout:board-scroll',String(window.scrollY));}catch{}}}><span className="sr-only">Open application details</span></Link></div>:outreach?<CommunicationAttachment item={item}/>:<div className={styles.reference}><span className={styles.at} aria-hidden="true">@</span><div><Link href={`${item.href}&returnTo=%2Fneeds-you%2F`}>{objectLabel}</Link>{objectDetail&&objectDetail!==objectLabel&&<p>{objectDetail}</p>}</div></div>}

  {item.kind==='imported_action'?<div className={styles.task}><strong>{item.reason}</strong>{item.actionDate&&<span>Due {new Date(item.actionDate+'T12:00:00Z').toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'})}</span>}</div>:!(item.kind==='resolve_blocker'&&needsNote)&&<p className={styles.reason}>{item.reason}</p>}
  {outcome&&<p className={styles.resume}><span>Résumé used</span><strong>{item.resume?.name||'No résumé selected'}{item.resume?.version!=null?` · version ${item.resume.version}`:''}</strong></p>}
  {draftInferences(item.inferences).length>0&&<section className={styles.disclosures} aria-label="Inferred details"><h4>Inferred details · check these</h4><ul>{draftInferences(item.inferences).map((inference:{field:string;reason:string},index:number)=><li key={index}><strong>{inference.field}</strong><p>{inference.reason}</p></li>)}</ul></section>}
  {item.reviewed&&native&&<p className={styles.muted}>Reviewed by you for this exact revision.</p>}
  {native&&<div className={styles.document}>
   {!(w.state.workflow.resumes||[]).length&&<p className={styles.resume}><span>Résumé</span><strong>{item.resume?.name||'No résumé selected'}</strong></p>}{(w.state.workflow.resumes||[]).length>0&&<label className={styles.field}><span>Résumé used</span><select value={resumeId} disabled={busy} onChange={e=>{setResumeId(e.target.value);setConfirmed(false);}}><option value="">No résumé selected</option>{w.state.workflow.resumes.map((r:any)=><option key={r.id} value={r.id}>{r.name}{r.version!=null?` · version ${r.version}`:""}</option>)}</select></label>}
   {item.coverLetter&&<div className={styles.prose}><h4>Cover letter</h4><small className={styles.muted}>{item.coverLetterSource==='ai_generated'?'AI-drafted text · review its factual claims':'Source not recorded · review its factual claims'}</small><p>{item.coverLetter}</p></div>}
   {!!reviewQuestions.length&&<h4 className={styles.sectionTitle}>Application questions</h4>}
   {reviewQuestions.map(q=>{const index=item.questions!.indexOf(q),options=q.options||[];return <label className={styles.field} key={index} htmlFor={`${id}-${index}`}><span>{q.question}{q.required!==false&&<span className={styles.required}> · Required</span>}</span><small className={styles.muted}>{q.questionSource==='ai_generated'?'AI-generated question · verify against the employer form':q.questionSource==='employer_form'?'Question from employer form':'Question source not recorded'} · {answerDisclosure(q,{edited:answers[index]!==answerText(q.answer)})}</small>{q.inferenceNote&&<small className={styles.muted}>{q.inferenceNote}</small>}{q.fieldType==='file'?<select id={`${id}-${index}`} value={answers[index]} disabled={busy} onChange={e=>{setAnswers(values=>values.map((value,i)=>i===index?e.target.value:value));setConfirmed(false);}}><option value="">Choose a saved file</option>{w.state.workflow.resumes.map((r:any)=><option key={r.id} value={r.id}>{r.name}{r.version!=null?` · version ${r.version}`:""}</option>)}</select>:options.length?<select id={`${id}-${index}`} disabled={busy} value={answers[index]} onChange={e=>{setAnswers(values=>values.map((value,i)=>i===index?e.target.value:value));setConfirmed(false);}}><option value="">Choose an answer</option>{options.map((o,i)=><option key={i} value={typeof o==='string'?o:o.value}>{typeof o==='string'?o:o.label||o.value}</option>)}</select>:<textarea id={`${id}-${index}`} rows={answers[index]?.length>160?4:2} maxLength={10000} disabled={busy} value={answers[index]} onChange={e=>{setAnswers(values=>values.map((value,i)=>i===index?e.target.value:value));setConfirmed(false);}} required={q.required!==false}/> }</label>;})}
  </div>}
  {question&&<div className={styles.question}><label className={styles.field} htmlFor={`${id}-answer`}><span>{item.title||'Your answer'}</span><textarea id={`${id}-answer`} required rows={3} maxLength={10000} placeholder="Write your answer…" value={answer} disabled={busy} onChange={e=>setAnswer(e.target.value)}/></label><label className={styles.field} htmlFor={`${id}-reuse`}><span>Use this answer again?</span><select id={`${id}-reuse`} disabled={busy} value={policy} onChange={e=>setPolicy(e.target.value)}><option value="ask">Ask me each time</option><option value="auto">Allow matching-question autofill</option></select></label></div>}
  {outreach&&<div className={styles.message}>{editingMessage?<>
   <label className={styles.field} htmlFor={`${id}-subject`}><span>Subject (optional)</span><input id={`${id}-subject`} value={subject} maxLength={500} disabled={busy} onChange={e=>setSubject(e.target.value)}/></label>
   <label className={styles.field} htmlFor={`${id}-message`}><span>Draft message</span><textarea id={`${id}-message`} value={message} rows={7} maxLength={10000} required disabled={busy} onChange={e=>setMessage(e.target.value)}/></label>
   <p className={styles.muted}>Saving changes requires a fresh review of this message.</p>
   <div className={styles.messageActions}><button type="button" disabled={busy||!message.trim()} onClick={()=>void saveMessage()}>Save message</button><button type="button" disabled={busy} onClick={()=>{setEditingMessage(false);setMessage(item.body||'');setSubject(item.subject||'');setError('');}}>Cancel</button></div>
  </>:<><p>{item.body}</p><button className={styles.editMessage} type="button" disabled={busy} onClick={()=>{setMessage(item.body||'');setSubject(item.subject||'');setEditingMessage(true);setError('');}}>Edit message</button></>}<p className={styles.muted}>Accept makes this message ready for you to send.</p></div>}
  {interview&&<div className={styles.interview}><div className={styles.calendar}><KindIcon kind={item.kind}/><strong>{item.proposedAt?new Date(item.proposedAt).toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:item.timeZone||'UTC'}):'Time needed'}</strong></div><div><h4>{item.title||'Interview round'}</h4>{item.proposedAt?<p>{new Date(item.proposedAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',timeZone:item.timeZone||'UTC'})} · {item.timeZone||'UTC'}</p>:<label className={styles.field}><span>Interview date and time (UTC)</span><input type="datetime-local" disabled={busy} onChange={e=>setAt(e.target.value?e.target.value+':00Z':'')}/></label>}{item.proposedAt&&<label className={styles.field}><span>Correct date and time (UTC)</span><input type="datetime-local" value={at?new Date(at).toISOString().slice(0,16):''} disabled={busy} onChange={e=>setAt(e.target.value?e.target.value+':00Z':'')}/></label>}{item.body&&<blockquote>{item.body}</blockquote>}</div></div>}
  {needsNote&&<label className={styles.field} htmlFor={`${id}-note`}><span>{outcome?'Employer portal or confirmation evidence':item.reason||'What does Muse need to continue?'}</span><textarea id={`${id}-note`} rows={2} maxLength={500} required disabled={busy} placeholder={outcome?'What did you check, and what did it show?':'Write your answer…'} value={note} onChange={e=>setNote(e.target.value)}/></label>}
  {((native&&(item.kind!=='review_application'||dirty))||outcome)&&<label className={styles.confirmation}><input type="checkbox" disabled={busy} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>{outcome?'I checked the employer portal or confirmation email.':'I have checked the answers shown above.'}</span></label>}
  {item.requiresReview&&<label className={styles.confirmation}><input type="checkbox" checked={item.reviewed} disabled={busy||editingMessage||item.reviewed||(native&&(!complete||dirty))} onChange={()=>void onRespond(item,'review')}/><span>{outreach?'I reviewed this exact message.':'I reviewed this exact application revision.'}</span></label>}
  <footer className={styles.footer}><div className={styles.meaning}><span>{acceptVerb}</span><small>{item.kind==='check_submission'?'X verifies not submitted':outreach?'Nothing is sent automatically':item.kind==='resolve_blocker'?'Saves your answer without approving submission':native?'Rejection keeps it saved and stops agent work':item.kind==='imported_action'?'Approval is not completion · X stops agent work':item.kind==='submit_application'?'A user report, not an observed submission receipt':'X declines this proposal'}</small></div><div className={styles.decisions}>
   <button type="button" className={styles.reject} disabled={rejectDisabled} aria-label={`Reject: ${actionVerbs[1]}`} title={actionVerbs[1]} onClick={()=>void respond('reject')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
   <button type="button" className={styles.accept} disabled={acceptDisabled} aria-label={`Accept: ${acceptVerb}`} title={acceptVerb} onClick={()=>void respond('accept')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button>
  </div></footer>
  {error&&<p role="alert" className={styles.error}>{error}</p>}
 </SwipeDecision></li>;
}
