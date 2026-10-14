import { createPreparationPlan, setPreparationTaskCompletion, PREPARATION_GUIDES } from './preparation-model.mjs';
import { buildDeliveryPolicy, normalizeQuietMode } from './quiet-mode.mjs';
import { applicationPolicy } from './application-policy.mjs';
const allowedPreferences = ['excludedCompanies','employmentTypes','locations','categories','targetYear','fit'];
export function selectionExplanation({preferences,job,payload}) {
 const policy=applicationPolicy({preferences,job});
 if (policy.mode==='skip') {
  const preference=policy.reason.startsWith('Company')?'excludedCompanies':'employmentTypes';
  return {...payload, reason:policy.reason,preference,evidence:`${job.company} · ${job.title} · ${job.employmentType}`,certainty:'exclusion'};
 }
 if (!allowedPreferences.includes(payload.preference) || payload.certainty!=='uncertain') throw Error('Only current explicit policy exclusions can be recorded as firm exclusions. Other fit assessments must be uncertain.');
 return payload;
}
export function notificationAdvice(bundle, now=new Date()) {
 const acknowledged=new Set((bundle.deliveries||[]).flatMap(n=>n.event_ids||[]));
 const events=(bundle.events||[]).map(e=>({id:e.id,kind:e.payload?.kind||e.kind,actionRequired:e.payload?.actionRequired===true,deadlineAt:e.payload?.deadlineAt,summary:e.payload?.text||e.kind,applicationId:e.application_id}));
 for (const row of bundle.plans||[]) {
  const plan=row.plan;
  if(plan?.deadline?.status!=='confirmed' || !(plan.tasks||[]).some(t=>!t.completed)) continue;
  const id=`deadline:${row.application_id}:${row.version}`;
  if(acknowledged.has(id)) continue;
  events.push({id,kind:'deadline',actionRequired:true,deadlineAt:`${plan.deadline.date}T23:59:59Z`,summary:`Preparation due ${plan.deadline.date} (${plan.deadline.stage})`,applicationId:row.application_id,dateOnly:true});
 }
 for (const app of bundle.applications||[]) {
  if(!['Blocked','Awaiting approval'].includes(app.status)) continue;
  const id=`decision:${app.id}:${app.revision}`;
  if(!acknowledged.has(id)) events.push({id,kind:'review',actionRequired:true,interrupt:true,applicationId:app.id,summary:app.blocker?'Your application needs an answer or blocker resolved.':'Your application is ready for review.'});
 }
 const delivery=buildDeliveryPolicy({settings:bundle.settings,now,lastDigestAt:bundle.lastDigestAt,events});
 const ids=delivery.reason==='urgent_action'?delivery.urgentEventIds:events.map(e=>e.id);
 return {delivery,events:delivery.decision==='due'?events.filter(e=>ids.includes(e.id)):[],pendingCount:events.length,applications:bundle.applications||[],transport:'agent-runtime',acknowledgeOnlyAfterDelivery:true};
}
export async function museFeatureDispatch({operation,payload,rpc,loadJob,now=new Date()}) {
 if(operation==='preparation.update'||operation==='preparation.complete') {
  const read=await rpc('preparation.read',{applicationId:payload.applicationId});
  if(read.error) return read;
  const context=read.data, previous=context.preparation;
  if((previous?.version||0)!==payload.expectedVersion) return {error:{code:'40001'}};
  let plan;
  if(operation==='preparation.complete') {
   if(!previous) return {error:{code:'P0002'}};
   plan=setPreparationTaskCompletion(previous.plan,payload.taskId,payload.completed);
  } else {
   const employer=context.job?.employer||{};
   const zone=normalizeQuietMode({timezone:context.timeZone}).timezone;
   const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
   const today=`${parts.year}-${parts.month}-${parts.day}`;
   const guides=[...new Map([...(payload.resourceGuides||[]),...PREPARATION_GUIDES].map(g=>[g.id,g])).values()];
   plan=createPreparationPlan({application:{...context.application.draft,...employer,id:context.application.job_id,resume:context.resume},deadline:payload.deadline,previousPlan:previous?.plan,now:today,dailyMinutes:payload.dailyMinutes,guides});
  }
  return rpc('preparation.save',{applicationId:payload.applicationId,expectedVersion:payload.expectedVersion,plan});
 }
 if(operation==='selection.record') {
  const personal=await rpc('context.personal',{}); if(personal.error) return personal;
  const job=await loadJob(payload.jobId); if(!job) return {error:{code:'P0002'}};
  return rpc(operation,selectionExplanation({preferences:personal.data.settings.preferences,job:job.employer,payload}));
 }
 if(operation==='notifications.read') {
  const read=await rpc(operation,{}); if(read.error) return read;
  return {data:notificationAdvice(read.data,now),error:null};
 }
 return rpc(operation,payload);
}
