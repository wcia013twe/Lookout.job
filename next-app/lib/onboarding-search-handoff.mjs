import {onboardingConnectionReady} from './onboarding-connection.mjs';
import {onboardingTaskKey} from './onboarding-work.mjs';

// Browser submits only saved search intent and bounded discovery; the runtime owns verification.
export async function handoffOnboardingSearch(api,intent,isCurrent=()=>true) {
 let session=await api.onboardingAction('onboarding.get_state');
 if(!isCurrent())return {status:'cancelled',session};
 if(!onboardingConnectionReady(session))return {status:'waiting',session};
 if(session.step==='intent_pending'){
  if(typeof intent!=='string'||intent.trim().length<3||intent.length>2000)throw Error('Saved search preferences are missing. Return to the search step.');
  await api.onboardingAction('onboarding.submit_step',{expectedRevision:session.revision,eventKey:`web-first-intent-${session.revision}`,event:'intent',data:{text:intent}});
  if(!isCurrent())return {status:'cancelled',session};
  session=await api.onboardingAction('onboarding.get_state');
 }
 if(!isCurrent())return {status:'cancelled',session};
 if(session.step!=='first_match_pending')return {status:session.data?.match?'result_ready':'existing_setup',session};
 const tasks=(session.tasks||[]).filter(task=>task.kind==='discover');
 if(session.data?.blocker||tasks.some(task=>['uncertain','needs_user','failed'].includes(task.state)))return {status:'needs_attention',session};
 if(!tasks.some(task=>['queued','claimed','running','completed'].includes(task.state))){
  await api.onboardingAction('tasks.create',{expectedRevision:session.revision,eventKey:onboardingTaskKey(session,'discover'),kind:'discover',target:{}});
 }
 return {status:'queued',session};
}
