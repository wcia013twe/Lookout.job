import {validateMuseChanges} from '../supabase/functions/agent-gateway/muse-changes.mjs';
// Detached and resettable; never reads account storage or calls a server.
export function createMuseChangeFeedDemo(){
 const events=[['answer_confirmed','application','demo-draft'],['profile_changed','search_profile','general'],['backend_job_finished','backend_job','demo-backend-job']].map(([kind,entity,recordId],i)=>({id:`00000000-0000-4000-8000-00000000000${i+1}`,kind,entity,recordId,version:1,occurredAt:'2026-10-26T12:00:00Z',summary:'Fictional workspace change (demo)'}));const handled=new Set();
 return {async readMuseChanges(payload={}){validateMuseChanges('changes.read',payload);const pending=events.filter(e=>!handled.has(e.id)),limit=payload.limit||20;return {items:structuredClone(pending.slice(0,limit)),hasMore:pending.length>limit,limit};},async acknowledgeMuseChanges(payload){validateMuseChanges('changes.ack',payload);if(payload.eventIds.some(id=>!events.some(e=>e.id===id)))throw Error('Fictional change not found');for(const id of payload.eventIds)handled.add(id);return {acknowledgedIds:[...payload.eventIds]};}};
}
