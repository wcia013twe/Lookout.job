// Shared labels and read destinations, not a behavior engine. Values stay in
// their existing owned records; the feed only tells Muse what to refresh.
export const MUSE_CHANGE_TYPES=Object.freeze([
 {kind:'answer_confirmed',label:'Application answer confirmed',readTool:'read_application_record'},
 {kind:'preferences_changed',label:'Shared preferences changed',readTool:'read_personal_context'},
 {kind:'profile_changed',label:'Application profile changed',readTool:'read_search_context'},
 {kind:'backend_job_finished',label:'Backend job finished',readTool:'read_backend_jobs'},
 {kind:'application_timeline_changed',label:'Application/interview timeline updated',readTool:'read_application_timeline'},
]);
const types=new Map(MUSE_CHANGE_TYPES.map(type=>[type.kind,type]));
export function museChangeFeedResponse(data) {
 return {...data,eventTypes:structuredClone(MUSE_CHANGE_TYPES),items:data.items.map(item=>{
  const type=types.get(item.kind);if(!type)return item;
  const args=type.readTool==='read_personal_context'?{}:type.readTool==='read_search_context'?{profileId:item.recordId}:type.readTool==='read_backend_jobs'?{jobId:item.recordId}:{applicationId:item.recordId};
  const label=item.kind==='application_timeline_changed'&&['recruiter_call','technical_round','interview'].includes(item.milestoneKind)
   ? item.phase==='scheduled'?(item.supersedesId?'Interview rescheduled':'Interview scheduled'):item.phase==='completed'?'Interview completed':'Interview update recorded'
   : type.label;
  return {...item,label,refresh:{tool:type.readTool,arguments:args}};
 })};
}
