import {emitDemoMuseChange} from '../../lib/muse-change-feed-demo.mjs';
import {validateTrackerProgress} from '../../supabase/functions/agent-gateway/action-board.mjs';
import {actionBoardMessageFields} from '../../lib/action-board.mjs';
// Detached, fictional services: no imports of account clients or persistent storage.
const copy=structuredClone;
const signature=value=>encodeURIComponent(JSON.stringify(value));
export function withActionBoardDemo(services,store){
 const receipts=new Map(),events=new Map(),holds=new Map();
 const stopped=id=>[...receipts.values()].some(r=>r.source_kind==='imported_action'&&r.source_id===id&&r.response==='reject'&&!r.resumed_at);
 const trackerHash=value=>{let h=2166136261;for(const c of JSON.stringify(value))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(16);};
 const trackerKey=row=>{const resumed=[...receipts.values()].filter(r=>r.source_kind==='imported_action'&&r.source_id===row.id&&r.resumed_at).map(r=>r.resumed_at).sort().at(-1);return `imported:${row.id}:${trackerHash(row.record)}`+(resumed?':r'+signature(resumed):'');};
 const emit=(key,response,kind,id,savedResponse)=>emitDemoMuseChange(store,{eventKey:`decision:${key}:${response}`,kind:'action_decision',entity:'action_board',recordId:id,decisionKey:key,sourceKind:kind,response,...(savedResponse?{savedResponse:copy(savedResponse)}:{}),summary:'Fictional human action decision saved.'});

 function items(includeResolved=false,imports=store.get('demo.boardImports')||[]){
  const apps=Object.values(store.get('workflow.applications')||{}),answers=store.get('workflow.savedAnswers')||[],contacts=store.get('network.referrals')||[],result=[];
  for(const app of apps){
   if(holds.get(app.backendId)?.resumed_at===null)continue;
   const uncertain=(app.submissionAttempts||[]).some(a=>a.state==='uncertain');
   const kind=uncertain?'check_submission':app.status==='Awaiting approval'?'review_application':app.status==='Blocked'?'resolve_blocker':app.status==='Approved'?'submit_application':app.status==='Draft'&&(app.resumeId||app.coverLetter||app.questions?.some(q=>q.answer?.trim()))?'prepared_application':null;
   if(kind)result.push({key:`application:${app.backendId}:${app.backendRevision||0}:${kind}`,kind,sourceId:app.backendId,applicationId:app.backendId,version:String(app.backendRevision||0),company:app.company,role:app.title,reason:app.blocker||(kind==='prepared_application'?'This saved draft has application content. Open it to complete review.':kind==='submit_application'?'This approved application still needs submission.':'Your approval is required before this application can proceed.'),href:`/applications/?application=${app.backendId}&tab=Documents`,canAccept:kind==='review_application',canReject:kind==='review_application',requiresReview:kind==='review_application',questions:app.questions||[]});
   for(const round of app.milestones||[]){if(round.phase!=='scheduled'||round.confirmation!=='needs_confirmation'||(app.milestones||[]).some(m=>m.supersedes_id===round.id))continue;result.push({key:`interview:${round.id}`,kind:'confirm_interview',sourceId:round.id,applicationId:app.backendId,version:round.id,company:app.company,title:round.label,proposedAt:round.proposed_at,timeZone:round.time_zone||'UTC',reason:'These interview details need confirmation before preparation can be scheduled.',href:`/applications/?application=${app.backendId}&tab=Interview&round=${round.id}`,canAccept:!!round.proposed_at,canReject:true,requiresReview:false});}
  }
  for(const row of imports){const r=row.record;if(!stopped(row.id)&&r.needsAction===true&&r.nextAction?.trim()&&!r.archived&&!['REJECTED','WITHDRAWN','CLOSED'].includes(r.status))result.push({key:trackerKey(row),kind:'imported_action',sourceId:row.id,version:signature(r),company:r.company,role:r.title,status:r.status,employmentType:r.employmentType,appliedDate:r.appliedDate,actionDate:r.actionDate,reason:r.nextAction,href:`/applications/?application=import:${row.id}&tab=Overview`,canAccept:false,canReject:false,requiresReview:false});}
  for(const answer of answers.filter(a=>!a.verifiedAt&&a.imported))result.push({key:`answer:${answer.id}:${signature(answer)}`,kind:['','ask me'].includes(answer.answer?.trim().toLowerCase()||'')?'missing_answer':'verify_answer',sourceId:answer.id,version:signature(answer),title:answer.question,body:answer.answer,reason:'This proposed answer has not been verified. Choose whether it may be reused.',href:`/profile/?section=agent&answer=${answer.id}`,canAccept:!['','ask me'].includes(answer.answer?.trim().toLowerCase()||''),canReject:!['','ask me'].includes(answer.answer?.trim().toLowerCase()||''),requiresReview:false});
  for(const c of contacts.filter(c=>c.message?.trim()&&!/\[[^\]]+\]/.test(c.message)&&['Not asked','Draft','Drafted'].includes(c.status||'Not asked')))result.push({key:`outreach:${c.id}:${signature([c.message,c.subject,c.contact||c.name,c.email,c.linkedin])}`,kind:'review_outreach',sourceId:c.id,version:String(c._revision||0),title:'Review message',recipient:c.contact||c.name,subject:c.subject||'',destination:c.email||c.linkedin||'',company:c.company,body:c.message,reason:'This message is ready for review. Accepting marks it ready for you to send.',href:`/referrals/?person=${c.id}`,canAccept:true,canReject:true,requiresReview:true});
  return result.map(i=>{const app=apps.find(a=>a.backendId===i.applicationId),resume=(store.get('workflow.resumes')||[]).find(r=>r.id===app?.resumeId);return {...i,canAccept:true,canReject:true,questions:app?.questions||i.questions,coverLetter:app?.coverLetter,inferences:app?.inferences||[],coverLetterSource:app?.coverLetterSource,resume:resume?{id:resume.id,name:resume.name,version:resume.version}:undefined,reference:{id:i.sourceId,kind:i.applicationId?'application':i.kind==='review_outreach'?'person':'answer',label:i.kind==='review_outreach'?(i.recipient||i.company):i.kind==='confirm_interview'?i.title:i.company||i.title||'Saved application',detail:['review_outreach','confirm_interview'].includes(i.kind)?i.company:i.role,href:i.href},createdAt:'2026-11-07T12:00:00Z',reviewed:!!receipts.get(i.key)?.reviewed_at}}).filter(i=>includeResolved||!receipts.get(i.key)?.response);
 }
 return {...services,
  async readActionBoard(){const imports=services.simplifyImport?(await services.simplifyImport('list')).records:undefined;const trackerWork=[...receipts].filter(([,r])=>r.source_kind==='imported_action'&&r.response&&!r.resumed_at).map(([key,r])=>{const row=(imports||store.get('demo.boardImports')||[]).find(i=>i.id===r.source_id);if(!row)return null;return {key,sourceId:r.source_id,version:r.work_version||1,company:row.record.company,role:row.record.title,action:row.record.nextAction,note:r.work_note,observedOutcome:r.work_state,state:r.response==='reject'?'rejected':r.work_state==='completed'?'completed':key!==trackerKey(row)||!row.record.needsAction?'superseded':r.work_state||'approved',href:`/applications/?application=import:${row.id}&tab=Overview`};}).filter(Boolean);return copy({trackerWork,items:items(false,imports),outreach:items(true).filter(i=>i.kind==='review_outreach'&&receipts.get(i.key)?.response).map(i=>({...i,response:receipts.get(i.key).response})),holds:[...holds.values()],history:[...receipts].filter(([,r])=>r.response).map(([decision_key,r])=>({decision_key,...r}))});},
  async recordTrackerActionProgress(payload){
   validateTrackerProgress(payload);const req={...payload,__operation:'progress'},prior=events.get(payload.eventKey);if(prior){if(JSON.stringify(prior.payload)!==JSON.stringify(req))throw Error('Retry changed');return copy(prior.result);}
   const r=receipts.get(payload.key),rows=services.simplifyImport?(await services.simplifyImport('list')).records:store.get('demo.boardImports'),row=rows.find(i=>i.id===r?.source_id);
   if(!r||!row||r.resumed_at||(r.work_version||1)!==payload.expectedVersion||r.work_state==='completed')throw Error('Tracker decision changed');
   const current=payload.key===trackerKey(row)&&row.record.needsAction&&!stopped(row.id);
   if(payload.stage==='started'){if(r.response!=='accept'||!current||r.work_connection_id)throw Error('Current human approval required');r.work_connection_id='demo-agent';}
   else if(r.work_connection_id!=='demo-agent'||!r.work_state)throw Error('Start this approved work first');
   r.work_state=payload.stage;r.work_note=payload.note||null;r.work_version=(r.work_version||1)+1;
   if(payload.stage==='completed'&&current){
    if(services.simplifyImport){const snapshot=await services.simplifyImport('list');await services.simplifyImport('update',{id:row.id,expectedVersion:snapshot.version,eventKey:'progress:'+payload.eventKey,changes:{needsAction:false}});store.set('demo.boardImports',(await services.simplifyImport('list')).records);}
    else store.update('demo.boardImports',rows=>rows.map(i=>i.id===row.id?{...i,record:{...i.record,needsAction:false}}:i));
   }
   const result={key:payload.key,state:payload.stage,version:r.work_version,sourceCurrent:!!current,verifiedSubmission:false};events.set(payload.eventKey,{payload:req,result});return copy(result);
  },
  async saveActionBoardMessage({id,expectedRevision,subject,message}){
   const fields=actionBoardMessageFields({subject,message}),contact=(store.get('network.referrals')||[]).find(c=>c.id===id);
   if(!contact||(contact._revision||0)!==expectedRevision)throw Error('Message changed. Reload actions before saving.');
   const saved={...contact,...fields,_revision:(contact._revision||0)+1};
   store.update('network.referrals',rows=>rows.map(c=>c.id===id?saved:c));return copy(saved);
  },
  async respondActionBoard(payload){
   const old=events.get(payload.eventKey);if(old){if(JSON.stringify(old.payload)!==JSON.stringify(payload))throw Error('Retry changed');return copy(old.result);}
   const input=payload.input||{},response=payload.response;
   if(['resume_tracker','stop_tracker'].includes(response)){
    const r=receipts.get(payload.key);if(!r||r.source_kind!=='imported_action'||r.resumed_at)throw Error('Tracker work changed');
    if(response==='resume_tracker'){
     if(r.response!=='reject'&&!['blocked','uncertain'].includes(r.work_state))throw Error('Tracker work changed');
     if(['blocked','uncertain'].includes(r.work_state)&&(!input.confirmed||!input.note?.trim()))throw Error('Verification note required');
     r.resumed_at=new Date().toISOString();
    }else{if(r.response!=='accept'||r.work_state==='completed')throw Error('Tracker work changed');r.response='reject';}
    r.work_version=(r.work_version||1)+1;emit(payload.key,response==='resume_tracker'?'resume':'reject','imported_action',r.source_id,payload);
   }else if(response==='resume'){const held=holds.get(payload.key);if(!held||held.resumed_at||held.version!==payload.expectedVersion)throw Error('Work hold changed');held.version++;held.resumed_at=new Date().toISOString();}
   else{
    const imported=services.simplifyImport?await services.simplifyImport('list'):null;
    const item=items(false,imported?.records).find(i=>i.key===payload.key);if(!item)throw Error('Decision changed');
    const apps=store.get('workflow.applications'),app=Object.values(apps).find(a=>a.backendId===item.applicationId);
    if(response==='review'){if(!item.requiresReview)throw Error('Review not required');receipts.set(item.key,{reviewed_at:new Date().toISOString()});}
    else{
     if(!['accept','reject','save'].includes(response))throw Error('Choose a decision');
     if(response==='accept'&&item.requiresReview&&!item.reviewed)throw Error('Review exact version first');
     if(response==='reject'&&['review_application','prepared_application','resolve_blocker','submit_application'].includes(item.kind)){
      holds.set(item.sourceId,{application_id:item.sourceId,resumed_at:null,version:(holds.get(item.sourceId)?.version||0)+1});app.backendRevision=(app.backendRevision||0)+1;app.status='Draft';app.approved=null;store.set('workflow.applications',apps);
     }else if(['prepared_application','resolve_blocker','review_application'].includes(item.kind)&&(response==='save'||item.kind!=='review_application')){
      if(!Array.isArray(input.answers)||input.answers.length!==(app.questions||[]).length||(response==='accept'&&(!input.confirmed||app.questions.some((q,i)=>q.required!==false&&q.fieldType!=='hidden'&&!input.answers[i]?.trim()))))throw Error('Complete required form fields');
      app.questions=app.questions.map((q,i)=>({...q,answer:input.answers[i]}));if(input.resumeId)app.resumeId=input.resumeId;app.questionsReviewed=response==='accept';app.backendRevision=(app.backendRevision||0)+1;if(response==='accept'){app.blocker='';app.status='Awaiting approval';}store.set('workflow.applications',apps);
     }else if(item.kind==='review_application'&&response==='accept'){app.status='Approved';app.approved={revision:app.backendRevision};store.set('workflow.applications',apps);}
     else if(['verify_answer','missing_answer'].includes(item.kind)&&response==='accept'){
      const answer=input.answer??item.body;if(!answer?.trim()||!['ask','auto'].includes(payload.policy))throw Error('Answer and reuse permission required');
      store.update('workflow.savedAnswers',rows=>rows.map(a=>a.id===item.sourceId?{...a,answer,verifiedAt:new Date().toISOString(),policy:payload.policy}:a));
     }else if(item.kind==='imported_action'){
      // Decision only: task remains pending until the approved agent reports an outcome.
     }else if(['check_submission','submit_application'].includes(item.kind)){
      if(!input.note?.trim()||!input.confirmed)throw Error('Verification note required');
      app.status=response==='accept'?'Submitted':'Draft';app.submissionAttempts=(app.submissionAttempts||[]).map(a=>a.state==='uncertain'?{...a,state:response==='accept'?'user_reported_submitted':'verified_not_submitted'}:a);app.activity=[...(app.activity||[]),{actor:'user',at:new Date().toISOString(),text:response==='accept'?'You reported Submitted: '+input.note:'Verified not submitted: '+input.note}];store.set('workflow.applications',apps);
     }else if(item.kind==='confirm_interview'){
      const target=Object.values(apps).find(a=>a.milestones?.some(m=>m.id===item.sourceId)),round=target.milestones.find(m=>m.id===item.sourceId);
      if(response==='accept')await this.recordApplicationMilestone(target.backendId,{eventKey:'board-'+payload.eventKey,kind:round.kind,label:round.label,phase:'scheduled',occurredAt:input.at||round.proposed_at,supersedesId:round.id,practiceCategory:round.practice_category,timeZone:input.timeZone||round.time_zone,source:{kind:'user',timestampConfirmed:true,note:'Confirmed in fictional Action Board'}});
      else store.update('workflow.applications',rows=>{rows[target.id].milestones=rows[target.id].milestones.map(m=>m.id===round.id?{...m,confirmation:'incorrect'}:m);return rows;});
     }
     if(response!=='save'){receipts.set(item.key,{...receipts.get(item.key),source_kind:item.kind,source_id:item.sourceId,response,work_version:1,responded_at:new Date().toISOString()});emit(item.key,response,item.kind,item.sourceId,payload);}
    }
   }
   const result={saved:true,key:payload.key,response};events.set(payload.eventKey,{payload:copy(payload),result});return copy(result);
  },
  async recordApplicationMilestone(id,input){
   const before=Object.values(store.get('workflow.applications')).find(a=>a.backendId===id),previous=before?.milestones?.find(m=>m.id===input.supersedesId);
   const row=await services.recordApplicationMilestone(id,input);
   Object.assign(row,{round_id:previous?.round_id||previous?.id||row.id,practice_category:input.practiceCategory||'general',time_zone:input.timeZone||'UTC',confirmation:input.occurredAt?'confirmed':'needs_confirmation',proposed_at:input.proposedAt||null});
   store.update('workflow.applications',apps=>{const app=Object.values(apps).find(a=>a.backendId===id);app.milestones=app.milestones.map(m=>m.id===row.id?row:m);return apps;});
   if(['recruiter_call','technical_round','interview'].includes(row.kind)){
    const rows=store.get('demo.preparationRows')||{},existing=rows[id]||{application_id:id,version:0,plan:{applicationId:before.id,deadline:{date:null,status:'needs_confirmation'},tasks:[],guides:[],warnings:[]}};
    if(!existing.plan.tasks.some(t=>t.roundId===row.round_id)&&row.phase==='scheduled'&&row.confirmation==='confirmed')existing.plan.tasks.push(...[['practice','Practice for this round',30],['questions','Prepare questions for the team',15]].map(([key,title,minutes])=>({id:row.round_id+':'+key,roundId:row.round_id,key,title,detail:'Fictional practice.',minutes,completed:false})));
    existing.version++;rows[id]=existing;store.set('demo.preparationRows',rows);
   }
   return copy(row);
  },
  async queueApplicationJob(payload){const app=Object.values(store.get('workflow.applications')||{}).find(a=>a.id===payload.posting.id);if(holds.get(app?.backendId)?.resumed_at===null)throw Error('Agent work stopped');return services.queueApplicationJob(payload);},
  async readPreparationPlanner(){const bundle=await services.readPreparationPlanner();return {...bundle,applications:store.get('workflow.applications'),holds:[...holds.values()]};}
 };
}
export function enableActionBoardScenario(fixtures,date){
 fixtures.state.demo.connectedBoard=true;
 for(const resume of fixtures.state.workflow.resumes||[])resume.version=resume.version||2;
 const messageContact=fixtures.state.network.referrals.find(c=>c.status==='Not asked');
 if(messageContact){messageContact.email='contact@example.com';messageContact.subject='Team and engineer ownership (fictional)';}
 fixtures.state.demo.boardImports=[{id:'00000000-0000-4000-8000-000000000777',identity_key:'fictional-board-import',source_rows:[],record:{company:'Example Follow-up (demo)',title:'Systems Engineer',location:'Remote',employmentType:'FT',status:'APPLIED',statusDate:date,appliedDate:date,url:null,notes:'Fictional application',archived:false,needsAction:true,nextAction:'Choose an interview time',actionDate:date}}];

 fixtures.state.demo.boardImports.push({id:'00000000-0000-4000-8000-000000000780',identity_key:'demo-event-only',source_rows:[],record:{company:'Example Scheduled (demo)',title:'Engineer',location:'Remote',employmentType:'FT',status:'INTERVIEW',statusDate:date,appliedDate:date,url:null,archived:false,archivedDate:null,notes:'Fictional scheduled interview, no human task.',needsAction:false,nextAction:'Technical interview',actionDate:date,rounds:[{id:'event-only-round',label:'Technical interview',stage:'INTERVIEW',type:'technical',phase:'scheduled',date,notes:'Fictional event only.',cancelled:false}]}});
 fixtures.state.demo.boardImports.push({id:'00000000-0000-4000-8000-000000000778',record:{company:'Example Assessment (demo)',title:'Engineer',status:'SCREEN',rounds:[{id:'demo-undated-assessment',label:'Complete the assessment',stage:'SCREEN',type:'oa',phase:'received',date:null,notes:'Fictional task with no deadline.',cancelled:false}]}});
 fixtures.state.demo.boardImports.push({id:'00000000-0000-4000-8000-000000000779',record:{company:'Example Dated Assessment (demo)',title:'Engineer',status:'SCREEN',needsAction:false,nextAction:'Complete the dated assessment',actionDate:date,rounds:[{id:'demo-dated-assessment',label:'Assessment with a saved deadline',stage:'SCREEN',type:'oa',phase:'received',date:null,notes:'Fictional deadline lives on the next action.',cancelled:false}]}});
 const apps=Object.values(fixtures.state.workflow.applications),app=apps[0];
 const discovered=(fixtures.state.demo.roles||[]).find(role=>role.id===app.id);if(discovered)discovered.priority='Apply Now';
 app.status='Awaiting approval';app.questionsReviewed=true;app.questions=(app.questions||[]).map(q=>({...q,answer:q.answer||'Fictional candidate answer'}));
 app.questions=app.questions.map((q,index)=>({...q,questionSource:'employer_form',...(index===0?{answer:fixtures.state.workflow.profile.email,profileField:'email'}:{answerSource:'ai_generated'})}));
 app.questions.push({id:'demo-sourced-location',question:'Current location',answer:'New York, NY (demo)',questionSource:'employer_form',profileField:'location',required:true});
 app.inferences=[{field:'Team scope',reason:'The draft assumes this role includes query-performance work based on the posting. Confirm the exact team and ownership.'}];
 fixtures.state.workflow.profile.verified=true;
 fixtures.state.workflow.savedAnswers.push({id:'demo-board-missing',question:'What is your preferred work location?',answer:'',imported:true,policy:'ask',companyScope:''});
 fixtures.state.workflow.savedAnswers.push({id:'demo-board-answer',question:'Can you work onsite three days a week?',answer:'Yes, for the fictional demo.',imported:true,policy:'ask',companyScope:''});
 const target=apps[1]||app;target.questions=[{question:'When can you start?',answer:'',required:true,fieldType:'text'}];target.blocker='Your start date is needed to finish this application.';
 const day=offset=>new Date(Date.parse(date+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);
 const rounds=[{id:'demo-round-a',round_id:'demo-round-a',label:'Architecture discussion',practice_category:'systems',confirmation:'confirmed',occurred_at:day(3)+'T17:00:00Z'},{id:'demo-round-b',round_id:'demo-round-b',label:'Follow-up',practice_category:'coding',confirmation:'needs_confirmation',proposed_at:day(5)+'T17:00:00Z'}].map(r=>({...r,kind:'technical_round',phase:'scheduled',time_zone:'UTC',source:{kind:'user',timestampConfirmed:r.confirmation==='confirmed'}}));
 target.milestones=rounds;
 const filled=copy(app);Object.assign(filled,{id:'demo-filled-board',backendId:'demo-filled-board',company:'Example Prepared (demo)',status:'Draft',resumeId:app.resumeId||'demo-resume',milestones:[]});fixtures.state.workflow.applications[filled.id]=filled;
 const manual=copy(filled);Object.assign(manual,{id:'demo-manual-board',backendId:'demo-manual-board',company:'Example Verification (demo)',status:'Blocked',questions:[],blocker:'The agent filled the form, but the employer requires a CAPTCHA. Complete verification on the employer form, then describe what you completed here.',submissionAttempts:[]});fixtures.state.workflow.applications[manual.id]=manual;
 const uncertain=copy(filled);Object.assign(uncertain,{id:'demo-uncertain-board',backendId:'demo-uncertain-board',company:'Example Timeout (demo)',status:'Draft',questions:[],blocker:'The submit request timed out without confirmation. Check the employer portal or confirmation email before deciding; retry stays blocked while the outcome is uncertain.',submissionAttempts:[{id:'demo-uncertain-attempt',state:'uncertain',startedAt:date+'T12:00:00Z'}]});fixtures.state.workflow.applications[uncertain.id]=uncertain;
 filled.questions.push({question:'Can you work Eastern hours?',answer:'Yes, pending my review.',required:true,questionSource:'employer_form',answerSource:'inferred',inferenceNote:'Inferred from the fictional location; working-hour availability is not confirmed.'});
 const approved=copy(filled);Object.assign(approved,{id:'demo-approved-board',backendId:'demo-approved-board',company:'Example Approved (demo)',status:'Approved'});fixtures.state.workflow.applications[approved.id]=approved;

 fixtures.state.demo.preparationRows[target.backendId]={application_id:target.backendId,version:1,plan:{applicationId:target.id,deadline:{date:null,status:'needs_confirmation'},guides:[],warnings:[],tasks:rounds.map(r=>({id:r.id+':practice',roundId:r.round_id,key:'practice',title:'Practice for this round',detail:'Fictional practice.',minutes:30,completed:false}))}};
}
