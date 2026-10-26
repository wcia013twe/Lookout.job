import {createHash} from 'node:crypto';
import type {EmbeddingProvider} from '../../backend/intelligence/types.ts';
// Fictional only. Shapes follow the inspected local Docker source tables and contact-notes contract.
import {circleObservation,applicationObservations} from '../../backend/intelligence/sources.ts';
export function demoCandidates(){
 const posts=[{id:'demo-circle-001',state:'published',parent_id:null,published_revision:1,revision:1,authorName:'Alex Example',content:{company:'Cedar Systems (demo)',role:'Backend Engineer',stage:'technical',insight:'Alex Example reported a discussion about lock contention. Contact alex@example.com or +1 (212) 555-0100. Notes: https://example.com/private?token=fake',experienceDate:'2026-10-20',provenance:'user_confirmed',uncertainty:'Fictional candidate experience; team format may vary.'}},
 {id:'demo-circle-002',state:'published',parent_id:null,published_revision:1,revision:1,content:{company:'Harbor Compute (demo)',role:'Systems Intern',stage:'technical',insight:'Fictional report: explain queue backpressure and retry storms.',provenance:'unknown'}}];
 const application={id:'demo-application-001',company:'Cedar Systems (demo)',title:'Backend Engineer',candidateName:'Taylor Example',url:'https://example.com/jobs/cedar-backend'};
 const milestones=[{id:'demo-milestone-001',application_id:application.id,kind:'submitted',phase:'completed',label:'Application submitted (fictional report)',occurred_at:'2026-10-10T12:00:00Z',source:{kind:'user'}},
 {id:'demo-milestone-002',application_id:application.id,kind:'technical_round',phase:'scheduled',label:'Backend technical round scheduled',occurred_at:null,source:{kind:'email',messageId:'private-email-id',subject:'Private subject',excerpt:'Private correspondence excluded'}}];
 const contact={id:'demo-contact-001',revision:1,contact:'Morgan Example',tags:[`application:${application.id}`],notes:JSON.stringify({format:'lookout-conversation-v1',notes:'Private notes excluded',url:'https://example.com/private-thread',messages:[
 {id:'sent-001',direction:'sent',channel:'Email',date:'2026-10-12',body:'Private candidate introduction excluded'},
 {id:'received-001',direction:'received',channel:'Email',date:'2026-10-14',body:'Taylor Example, the technical round will discuss backend reliability. Morgan Example, morgan@example.com.'},
 {id:'received-002',direction:'received',channel:'Email',date:'2026-10-16',body:'The next round includes a project deep dive. Thread https://example.com/thread?token=fake'}]})};
 return [...posts.map(circleObservation),...applicationObservations(application,milestones,[contact])];
}

// Synthetic vectors prove storage mechanics only. They are not semantic embeddings.
export function fixtureProvider():EmbeddingProvider{return {model:'fixture-vector-v1',async embed(text){const bytes=createHash('sha256').update(text).digest();return Array.from({length:1536},(_,i)=>(bytes[i%bytes.length]+1)/256);}};}
