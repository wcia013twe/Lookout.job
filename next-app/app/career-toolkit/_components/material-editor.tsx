'use client';
import {useMemo,useState} from 'react';
import {control,primary,secondary} from '../../../components/ui';
import type {Artifact,ArtifactContent} from './artifact-viewer';
import styles from '../toolkit.module.css';
import {readStructuredAnswer} from '../../../../lib/interview-prep.mjs';

export type MaterialEditorProps={artifact?:Artifact;kind?:string;preset?:{question:string;category:string};onSave:(content:ArtifactContent)=>Promise<void>;onCancel:()=>void;busy?:boolean};

const answerCategories=['Introductions and motivation','Behavioral questions','Project and experience stories','Technical explanations','Questions to ask interviewers'] as const;
const answerSections=['Category','Status','Question','Answer','Experiences','Company adaptation'] as const;
const statuses=['Draft','Needs Review','Ready'] as const;
type AnswerDraft={Category:string;Status:string;Question:string;Answer:string;Experiences:string;'Company adaptation':string};

function readAnswerBody(body:string):AnswerDraft|null{
 return readStructuredAnswer(body) as AnswerDraft|null;
}

function encodeAnswerBody(value:AnswerDraft){return answerSections.map(section=>`## ${section}\n${value[section]}`).join('\n\n');}

export default function MaterialEditor({artifact,kind,preset,onSave,onCancel,busy=false}:MaterialEditorProps){
 const content=artifact?.content;
 const actualKind=content?.kind||kind||'notes';
 const existingAnswer=useMemo(()=>actualKind==='story_bank'&&content?readAnswerBody(content.body):null,[actualKind,content]);
 const structuredAnswer=actualKind==='story_bank'&&(!artifact||existingAnswer!==null);
 const initialAnswer=existingAnswer||{Category:preset?.category||answerCategories[0],Status:'Draft',Question:preset?.question||'',Answer:'',Experiences:'','Company adaptation':''};
 const [title,setTitle]=useState(content?.title||preset?.question||'');
 const [purpose,setPurpose]=useState(content?.purpose||(preset?'Reusable interview answer':''));
 const [body,setBody]=useState(content?.body||'');
 const [practiceCategory,setPracticeCategory]=useState('Algorithms and coding');
 const [answer,setAnswer]=useState<AnswerDraft>(initialAnswer);
 const format=content?.format||'markdown';
 if(actualKind==='mock_interview')return null;
 const save=(event:React.FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  const nextBody=structuredAnswer?encodeAnswerBody(answer):!artifact&&actualKind==='practice'?`## Category\n${practiceCategory}\n\n${body}`:body;
  const next:ArtifactContent={...(content||{title:'',purpose:'',kind:actualKind,format,body:nextBody,sources:[],links:[]}),title:title.trim(),purpose:purpose.trim(),kind:actualKind,format,body:nextBody};
  void onSave(next).catch(()=>{});
 };
 const fieldClass=`${control} mt-1 w-full`;
 return <form className="mx-auto max-w-3xl space-y-5" onSubmit={save} aria-label={`${artifact?'Edit':'Create'} ${actualKind.replaceAll('_',' ')}`}>
  <header className={styles.shelfHeading}><div><h1 className="text-2xl font-semibold">{artifact?'Edit material':'Create material'}</h1><p className="mt-1 text-sm text-board-muted">{artifact?'Changes are saved as a new revision.':'Add material to your interview prep workspace.'}</p></div></header>
  <label className="block text-sm font-medium">Title<input className={fieldClass} required maxLength={200} value={title} onChange={event=>setTitle(event.target.value)}/></label>
  <label className="block text-sm font-medium">Purpose<textarea className={`${fieldClass} min-h-20`} required maxLength={1000} value={purpose} onChange={event=>setPurpose(event.target.value)}/></label>
  {structuredAnswer?<fieldset className="space-y-4 rounded-xl border border-board-border p-4"><legend className="px-1 font-semibold">Reusable answer</legend>
   <label className="block text-sm font-medium">Category<select className={fieldClass} value={answer.Category} onChange={event=>setAnswer({...answer,Category:event.target.value})}>{answerCategories.map(value=><option key={value}>{value}</option>)}</select></label>
   <label className="block text-sm font-medium">Status<select className={fieldClass} value={answer.Status} onChange={event=>setAnswer({...answer,Status:event.target.value})}>{statuses.map(value=><option key={value}>{value}</option>)}</select></label>
   <label className="block text-sm font-medium">Question<input className={fieldClass} required value={answer.Question} onChange={event=>setAnswer({...answer,Question:event.target.value})}/></label>
   <label className="block text-sm font-medium">Answer / talking points<textarea className={`${fieldClass} min-h-40`} required value={answer.Answer} onChange={event=>setAnswer({...answer,Answer:event.target.value})}/></label>
   <label className="block text-sm font-medium">Linked experiences / projects<textarea className={`${fieldClass} min-h-20`} value={answer.Experiences} onChange={event=>setAnswer({...answer,Experiences:event.target.value})}/></label>
   <label className="block text-sm font-medium">Company adaptation<textarea className={`${fieldClass} min-h-20`} value={answer['Company adaptation']} onChange={event=>setAnswer({...answer,'Company adaptation':event.target.value})}/></label>
  </fieldset>:<>
   {!artifact&&actualKind==='practice'&&<label className="block text-sm font-medium">Practice category<select className={fieldClass} value={practiceCategory} onChange={event=>setPracticeCategory(event.target.value)}>{['Algorithms and coding','System design','Behavioral practice','Mock interviews'].map(value=><option key={value}>{value}</option>)}</select></label>}
   {actualKind==='story_bank'&&<p className="text-sm text-board-muted">This answer has an unrecognized layout. Edit its Markdown directly to preserve its content and structure.</p>}
   {actualKind==='company_research'&&<p className="text-sm text-board-muted">Separate verified facts from assumptions. Add source links and note when each source was checked.</p>}
   <label className="block text-sm font-medium">{format==='html'?'HTML source':'Markdown body'}<textarea className={`${fieldClass} min-h-80 font-mono text-sm`} required value={body} onChange={event=>setBody(event.target.value)} aria-describedby="material-body-guidance"/></label>
   <p id="material-body-guidance" className="text-sm text-board-muted">{format==='html'?'Source only. This editor does not execute HTML.':'Use Markdown. For research, label assumptions and cite verified facts with source links.'}</p>
  </>}
  <div className="flex flex-wrap gap-3"><button className={primary} disabled={busy}>{busy?'Saving…':'Save material'}</button><button type="button" className={secondary} disabled={busy} onClick={onCancel}>Cancel</button></div>
 </form>;
}
