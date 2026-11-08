import {MUSE_WORKFLOW_VERSIONS} from './muse-workflow-routing.mjs';
// Shared labels and read destinations, not a behavior engine. Values stay in
// their existing owned records; the feed only tells Muse what to refresh.
export const MUSE_CHANGE_TYPES=Object.freeze([
 {kind:'action_decision',workflow:Object.freeze({guideId:'application-workspace',guideVersion:MUSE_WORKFLOW_VERSIONS['application-workspace']}),label:'Human action decision saved',readTool:'read_action_board'},
 {kind:'application_requested',workflow:Object.freeze({guideId:'application-workspace',guideVersion:MUSE_WORKFLOW_VERSIONS['application-workspace']}),label:'AI Apply requested',readTool:'read_backend_jobs'},
 {kind:'answer_confirmed',workflow:Object.freeze({guideId:'application-workspace',guideVersion:MUSE_WORKFLOW_VERSIONS['application-workspace']}),label:'Application answer confirmed',readTool:'read_application_record'},
 {kind:'schedule_changed',workflow:Object.freeze({guideId:'connection-schedules',guideVersion:MUSE_WORKFLOW_VERSIONS['connection-schedules']}),label:'My Agent schedule changed',readTool:'read_agent_schedule'},
 {kind:'preferences_changed',workflow:Object.freeze({guideId:'workspace-maintenance',guideVersion:MUSE_WORKFLOW_VERSIONS['workspace-maintenance']}),label:'Shared preferences changed',readTool:'read_personal_context'},
 {kind:'profile_changed',workflow:Object.freeze({guideId:'career-find-jobs',guideVersion:MUSE_WORKFLOW_VERSIONS['career-find-jobs']}),label:'Application profile changed',readTool:'read_search_context'},
 {kind:'backend_job_finished',workflow:Object.freeze({guideId:'career-find-jobs',guideVersion:MUSE_WORKFLOW_VERSIONS['career-find-jobs']}),label:'Backend job finished',readTool:'read_backend_jobs'},
 {kind:'application_timeline_changed',workflow:Object.freeze({guideId:'interview-preparation',guideVersion:MUSE_WORKFLOW_VERSIONS['interview-preparation']}),label:'Application/interview timeline updated',readTool:'read_application_timeline'},
]);
const types=new Map(MUSE_CHANGE_TYPES.map(type=>[type.kind,type]));
export function museChangeFeedResponse(data) {
 return {...data,eventTypes:structuredClone(MUSE_CHANGE_TYPES),items:data.items.map(item=>{
  const type=types.get(item.kind);if(!type)return item;
  const args=['read_personal_context','read_agent_schedule','read_action_board'].includes(type.readTool)?{}:type.readTool==='read_search_context'?{profileId:item.recordId}:type.readTool==='read_backend_jobs'?{jobId:item.recordId}:{applicationId:item.recordId};
  const label=item.kind==='application_timeline_changed'&&['recruiter_call','technical_round','interview'].includes(item.milestoneKind)
   ? item.phase==='scheduled'?(item.supersedesId?'Interview rescheduled':'Interview scheduled'):item.phase==='completed'?'Interview completed':'Interview update recorded'
   : type.label;
  return {...item,label,workflow:{...type.workflow},refresh:{tool:type.readTool,arguments:args}};
 })};
}
