import {museChangeFeedResponse} from './muse-change-feed.mjs';
import {validateMuseChanges} from '../supabase/functions/agent-gateway/muse-changes.mjs';
// Detached and resettable; never reads account storage or calls a server.
export function createMuseChangeFeedDemo(store){
 const events=[['answer_confirmed','application','demo-draft'],['profile_changed','search_profile','general'],['schedule_changed','automation_schedule','demo-owner'],['backend_job_finished','backend_job','33333333-3333-4333-8333-000000000007'],['application_timeline_changed','application_timeline','demo-draft']].map(([kind,entity,recordId],i)=>({id:`00000000-0000-4000-8000-00000000000${i+1}`,kind,entity,recordId,version:1,occurredAt:'2026-10-26T12:00:00Z',summary:'Fictional workspace change (demo)',...(kind==='application_timeline_changed'?{change:'milestone_added',milestoneId:'demo-interview',milestoneKind:'interview',phase:'scheduled'}:{})}));const handled=new Set();let watchId=null,generation=0;
 const all=()=>[...events,...(store?.get('demo.changeEvents')||[])];
 return {async readAgentSchedule(){return {schedule:{enabled:true,timezone:'America/New_York',configVersion:1,routines:[{id:'demo-search',title:'Fictional search',description:'Demo only',enabled:true,mode:'scheduled',time:'09:00',sourceIds:[],connectionIds:[]}]},configVersion:1,updatedAt:'2026-10-26T12:00:00Z',connectionId:'demo-connection'};},async configureAgentWatch(payload){validateMuseChanges('changes.watch',payload);watchId=payload.enabled?'fictional-watch-'+(++generation):null;return {watchId,enabled:!!watchId,pollIntervalSeconds:120};},async readAgentPendingCount(id){return id&&id===watchId?all().filter(e=>!handled.has(e.id)).length:0;},async readMuseChanges(payload={}){validateMuseChanges('changes.read',payload);const pending=all().filter(e=>!handled.has(e.id)),limit=payload.limit||20;return museChangeFeedResponse({items:structuredClone(pending.slice(0,limit)),hasMore:pending.length>limit,limit});},async acknowledgeMuseChanges(payload){validateMuseChanges('changes.ack',payload);if(payload.eventIds.some(id=>!all().some(e=>e.id===id)))throw Error('Fictional change not found');for(const id of payload.eventIds)handled.add(id);return {acknowledgedIds:[...payload.eventIds]};}};
}

export function emitDemoMuseChange(store,event){
 const rows=store.get('demo.changeEvents')||[];
 if(rows.some(row=>row.eventKey===event.eventKey))return;
 store.set('demo.changeEvents',[...rows,{id:crypto.randomUUID(),occurredAt:new Date().toISOString(),...structuredClone(event)}]);
}
