'use client';
import {useEffect,useRef,useState,type FormEvent,type DragEvent} from 'react';
import {Field,Notice,control,primary,secondary} from '../../../components/ui';
import {types,type Content,type Offer,type SharedContext} from '../_lib/types';
import {applicationContext} from '../../../../lib/circle-attachments.mjs';
import {validateCircleContextContent} from '../../../../lib/circle-context.mjs';
import {formatCircleActivity,parseCircleActivity} from '../../../../lib/circle-activity.mjs';
import styles from './conversation.module.css';
import PromptComposer from './prompt-composer';
import promptStyles from './prompt-composer.module.css';

type Props={initial?:Content;reply?:boolean;inline?:boolean;activityUpdate?:boolean;demo?:boolean;contexts?:Content[];incomingContext?:Content;busy:boolean;save:(content:Content)=>Promise<void>;cancel:()=>void};
const jobKeys=['company','role','jobId','jobUrl','stage'] as const;
const offerLabels:Record<keyof Offer,string>={company:'Company',role:'Role',location:'Location',base:'Base pay (currency / period)',equity:'Equity (amount / vesting)',signOn:'Signing bonus',notes:'Team, deadline & other details'};
export default function Editor({initial,reply,inline,activityUpdate=false,demo=false,contexts=[],incomingContext,busy,save,cancel}:Props){
 const sharedActivity=parseCircleActivity(initial?.body);
 const [activity,setActivity]=useState(activityUpdate||!!(sharedActivity.highlights.length||sharedActivity.goal||sharedActivity.help));
 const [insight,setInsight]=useState(initial?.insight||'');
 const [message,setMessage]=useState(sharedActivity.message),[selectedContexts,setSelectedContexts]=useState<SharedContext[]>(initial?.contexts||[]);
 const [error,setError]=useState(''),[kind,setKind]=useState(initial?.type||'discussion');
 const [attached,setAttached]=useState(!initial?.contexts?.some(item=>item.kind==='application')&&!!(initial?.company||initial?.jobId||initial?.jobUrl||initial?.stage));
 const [job,setJob]=useState<Partial<Content>>(()=>Object.fromEntries(jobKeys.map(k=>[k,initial?.[k]||''])));
 const [offers,setOffers]=useState<Offer[]>(initial?.offers||[{company:''},{company:''}]);
 const [dragging,setDragging]=useState(false);
 const formRef=useRef<HTMLFormElement>(null);
 useEffect(()=>{if(incomingContext){const snapshot=applicationContext({...incomingContext,title:incomingContext.role||''},incomingContext.stage) as SharedContext;setSelectedContexts(old=>old.some(item=>JSON.stringify(item)===JSON.stringify(snapshot))?old:old.length<6?[...old,snapshot]:old);}},[incomingContext]);
 function attach(content:Content){setJob(Object.fromEntries(jobKeys.map(k=>[k,content[k]||''])));setAttached(true);if(kind==='discussion')setKind('interview_report');}
 function drop(event:DragEvent){event.preventDefault();setDragging(false);try{const context=JSON.parse(event.dataTransfer.getData('application/x-lookout-job'));if(context&&typeof context==='object'&&jobKeys.every(k=>context[k]===undefined||typeof context[k]==='string'))attach(context);}catch{setError('Choose a shared job or enter its details below.');}}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=new FormData(event.currentTarget),value=(key:string)=>String(form.get(key)||'').trim();
  const sources=value('sources').split('\n').filter(Boolean).map(line=>{const [url,...label]=line.trim().split(/\s+/);return {url,label:label.join(' ')||url};});
  try{
   if(sources.length>10||sources.some(s=>{try{const u=new URL(s.url);return u.protocol!=='https:'||!!u.username||!!u.password;}catch{return true;}}))throw Error('Use up to 10 public HTTPS sources, one per line.');
   const activityText=activity&&!reply?formatCircleActivity({highlights:value('activityHighlights').split('\n'),goal:value('activityGoal'),help:value('activityHelp')}):'';
   const body=[value('body'),activityText].filter(Boolean).join('\n\n');
   const content:Content={title:reply?'Reply':value('title')||(activityText?'A little progress this week':'')||body.slice(0,100)||value('insight').slice(0,100),body,type:reply?'reply':kind,sources,provenance:value('provenance')||'user_confirmed',personalDisclosure:!!activityText||form.has('personalDisclosure')};
   for(const key of ['experienceDate','uncertainty','insight'] as const)if(value(key))content[key]=value(key);
   if(!reply&&attached)for(const key of jobKeys)if(job[key]?.trim())content[key]=job[key]!.trim();
   if(!reply&&selectedContexts.length){content.contexts=selectedContexts;const first=selectedContexts.find(item=>item.kind==='application');if(!attached&&first)for(const key of jobKeys)if(first[key])content[key]=first[key];if(selectedContexts.some(item=>['application','referral'].includes(item.kind)))content.personalDisclosure=true;}
   if(!reply&&kind==='offer_comparison')content.offers=offers.map(offer=>Object.fromEntries(Object.entries(offer).map(([k,v])=>[k,v.trim()])) as Offer);
   validateCircleContextContent(content);setError('');await save(content);
  }catch(e){setError(e instanceof Error?e.message:'Draft could not save. Try again.');}
 }
 const sourceDetails=<details className={styles.extra} open={!!initial?.sources.length||undefined}><summary>Sources &amp; sharing details</summary><div className="space-y-4 py-4"><Field label="Source classification (reported)"><select name="provenance" className={control} defaultValue={initial?.provenance||'user_confirmed'}><option value="user_confirmed">My confirmed experience</option><option value="employer_verified">Employer source provided</option><option value="agent_observed">Agent observed</option><option value="agent_inferred">Agent inference</option><option value="unknown">Unknown</option></select></Field><Field label="Public sources (HTTPS URL followed by a label, one per line)"><textarea name="sources" className={`${control} min-h-24`} defaultValue={initial?.sources.map(s=>`${s.url} ${s.label}`).join('\n')}/></Field><label className="flex min-h-11 items-center gap-3 text-sm"><input name="personalDisclosure" type="checkbox" defaultChecked={initial?.personalDisclosure??false}/>Contains personal details</label></div></details>;
 return <form ref={formRef} onSubmit={submit} className={inline?promptStyles.form:'space-y-5 border-y border-board-line py-6'} aria-label={reply?'Write a reply':inline?'Start a conversation':'Contribution editor'} data-dragging={dragging} onDragOver={event=>{if(event.dataTransfer.types.includes('application/x-lookout-job')){event.preventDefault();setDragging(true);}}} onDragLeave={()=>setDragging(false)} onDrop={drop}>
  {!inline&&<><h2 className="text-lg font-bold">{reply?'Write a reply':initial?'Edit contribution':'Start a conversation'}</h2><p className="text-sm text-board-muted">Your draft stays private until you review and share it.</p></>}
  {reply?<Field label="Your reply"><textarea name="body" className={`${control} min-h-24`} defaultValue={initial?.body} required maxLength={12000}/></Field>:<><PromptComposer value={message} change={setMessage} contexts={selectedContexts} attach={context=>setSelectedContexts(old=>old.some(item=>JSON.stringify(item)===JSON.stringify(context))?old:[...old,context])} remove={index=>setSelectedContexts(old=>old.filter((_,i)=>i!==index))} legacyJob={attached?job:undefined} removeJob={()=>setAttached(false)} shared={contexts} demo={demo} busy={busy} hasInsight={!!insight.trim()||activity}/><div className={promptStyles.after}><span>Only your Circle · Review before sharing</span><span>Up to 6 context items</span></div></>}
  {!reply&&<>
   {activity&&<fieldset className={styles.attachment}><legend>Your shared activity</legend><p>Only share what you want your Circle to see. Counts are your own report.</p><Field label="Recent highlights (up to 3, one per line)"><textarea name="activityHighlights" className={`${control} min-h-24`} defaultValue={sharedActivity.highlights.join('\n')} maxLength={900} placeholder="Submitted 3 applications&#10;Received 1 referral&#10;Completed a mock interview"/></Field><Field label="This week's goal (optional)"><input name="activityGoal" className={control} defaultValue={sharedActivity.goal} maxLength={300} placeholder="2 of 3 interview prep sessions complete"/></Field><Field label="Could use a hand with… (optional)"><input name="activityHelp" className={control} defaultValue={sharedActivity.help} maxLength={300} placeholder="A practice partner for my project deep dive"/></Field><p>Friends can offer help by replying to this update.</p></fieldset>}
  <button type="button" className={secondary} aria-expanded={activity} onClick={()=>setActivity(!activity)}>{activity?'Remove activity details':'Share activity'}</button>
  </>}
  {!reply&&<details className={promptStyles.details}><summary>Post details &amp; other attachments</summary><div><label className={styles.kind}>Conversation type<select aria-label="Conversation type" value={kind} onChange={event=>{setKind(event.target.value);if(event.target.value==='interview_report')setAttached(true);}} disabled={busy}>{Object.entries(types).filter(([key])=>key!=='reply').map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  {!reply&&<>
   {attached&&<fieldset className={styles.attachment}><legend>Attached job &amp; round</legend><div className={styles.attachmentHeading}><span>Only the fields below will be shared.</span><button type="button" onClick={()=>setAttached(false)}>Remove context</button></div><div className={styles.jobFields}>{jobKeys.map(key=><Field key={key} label={{company:'Company',role:'Role',jobId:'Employer job ID',jobUrl:'Public job link',stage:'Interview stage'}[key]}><input className={control} value={job[key]||''} type={key==='jobUrl'?'url':'text'} maxLength={key==='jobUrl'?2000:200} placeholder={{company:'Company name',role:'e.g. Backend engineer',jobId:'e.g. REQ-1042',jobUrl:'https://…',stage:'e.g. Round 2 · Technical'}[key]} onChange={event=>setJob({...job,[key]:event.target.value})}/></Field>)}</div></fieldset>}
   {kind==='offer_comparison'&&<fieldset className={styles.attachment}><legend>Offer comparison</legend><p className={styles.offerNote}>Enter only what you want your Circle to see. Include currency and time period; equity is shown as entered.</p><div className={styles.offerFields}>{offers.map((offer,index)=><div key={index}><h3>Offer {index+1}</h3>{(Object.keys(offerLabels) as (keyof Offer)[]).map(key=><Field key={key} label={`${offerLabels[key]} · offer ${index+1}`}><input className={control} required={key==='company'} value={offer[key]||''} maxLength={key==='notes'?1000:200} onChange={event=>setOffers(old=>old.map((item,i)=>i===index?{...item,[key]:event.target.value}:item))}/></Field>)}{offers.length>2&&<button type="button" className={secondary} onClick={()=>setOffers(old=>old.filter((_,i)=>i!==index))}>Remove offer {index+1}</button>}</div>)}</div>{offers.length<4&&<button type="button" className={secondary} onClick={()=>setOffers(old=>[...old,{company:''}])}>Add another offer</button>}</fieldset>}
   <div className={styles.contextTools}><button type="button" className={secondary} onClick={()=>setAttached(!attached)} aria-expanded={attached}>{attached?'Remove job / round':'Attach job / round'}</button>{kind!=='offer_comparison'&&<button type="button" className={secondary} onClick={()=>setKind('offer_comparison')}>Compare offers</button>}{contexts.some(c=>c.company||c.jobId||c.jobUrl)&&<details><summary>Use a shared job</summary><div className={styles.contextChoices}>{contexts.filter(c=>c.company||c.jobId||c.jobUrl).filter((c,i,a)=>a.findIndex(x=>(x.jobId||x.jobUrl||x.company)===(c.jobId||c.jobUrl||c.company))===i).map((context,index)=><button type="button" key={index} onClick={()=>attach(context)}>{context.company||context.jobId||'Shared job'}<span>{context.role}{context.jobId?` · ${context.jobId}`:''}</span></button>)}</div></details>}</div>
   <details className={styles.extra} open={!!initial?.insight||undefined}><summary>Insight &amp; additional details</summary><div className="space-y-4 py-4"><Field label="Key insight (optional)"><textarea name="insight" className={`${control} min-h-24`} value={insight} onChange={event=>setInsight(event.target.value)} maxLength={4000}/></Field><Field label="Thread title (optional)"><input name="title" className={control} defaultValue={initial?.title} maxLength={200}/></Field><Field label="Experience date (optional)"><input name="experienceDate" type="date" className={control} defaultValue={initial?.experienceDate}/></Field><Field label="Uncertainty or limits (optional)"><input name="uncertainty" className={control} defaultValue={initial?.uncertainty} maxLength={1000}/></Field></div></details>
  </>}
  {sourceDetails}
  </div></details>}
  {reply&&sourceDetails}
  <div role="alert"><Notice>{error}</Notice></div>
  {reply?<div className={styles.composerBottom}><span>Saving does not publish.</span><div><button className={primary} disabled={busy}>{busy?'Saving…':'Save private draft'}</button><button className={secondary} type="button" disabled={busy} onClick={cancel}>Cancel</button></div></div>:!inline&&<button className={secondary} type="button" disabled={busy} onClick={cancel}>Cancel</button>}

 </form>;
}
