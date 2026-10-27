import {createHash} from 'node:crypto';
import type {EmbeddingProvider} from '../../backend/intelligence/types.ts';
// Fictional only. Shapes follow the inspected local Docker source tables and contact-notes contract.
import {circleObservation,applicationObservations} from '../../backend/intelligence/sources.ts';
export function demoCandidates(){
 const posts=[{id:'demo-circle-001',state:'published',parent_id:null,published_revision:1,revision:1,authorName:'Alex Example',content:{company:'Cedar Systems (demo)',role:'Backend Engineer',stage:'technical',insight:'Alex Example reported a discussion about lock contention. Contact alex@example.com or +1 (212) 555-0100. Notes: https://example.com/private?token=fake',experienceDate:'2026-10-20',provenance:'user_confirmed',uncertainty:'Fictional candidate experience; team format may vary.'}},
 {id:'demo-circle-002',state:'published',parent_id:null,published_revision:1,revision:1,content:{company:'Harbor Compute (demo)',role:'Systems Intern',stage:'technical',insight:'Fictional report: explain queue backpressure and retry storms.',provenance:'unknown'}}];
 const application={id:'demo-application-001',jobId:'DEMO-BACKEND-2027',company:'Cedar Systems (demo)',title:'Backend Engineer',candidateName:'Taylor Example',url:'https://example.com/jobs/cedar-backend'};
 const milestones=[{id:'demo-milestone-001',application_id:application.id,kind:'submitted',phase:'completed',label:'Application submitted (fictional report)',occurred_at:'2026-10-10T12:00:00Z',source:{kind:'user'}},
 {id:'demo-milestone-002',application_id:application.id,kind:'technical_round',phase:'scheduled',label:'Backend technical round scheduled',occurred_at:null,source:{kind:'email',messageId:'private-email-id',subject:'Private subject',excerpt:'Private correspondence excluded'}}];
 const contact={id:'demo-contact-001',revision:1,contact:'Morgan Example',tags:[`application:${application.id}`],notes:JSON.stringify({format:'lookout-conversation-v1',notes:'Private notes excluded',url:'https://example.com/private-thread',messages:[
 {id:'sent-001',direction:'sent',channel:'Email',date:'2026-10-12',body:'Private candidate introduction excluded'},
 {id:'received-001',direction:'received',channel:'Email',date:'2026-10-14',body:'Taylor Example, the technical round will discuss backend reliability. Morgan Example, morgan@example.com.'},
 {id:'received-002',direction:'received',channel:'Email',date:'2026-10-16',body:'The next round includes a project deep dive. Thread https://example.com/thread?token=fake'}]})};
 return [...posts.map(p=>circleObservation({...p,circle_id:'demo-circle'})),...applicationObservations(application,milestones,[contact]),...resourceCandidates(),...taggedCandidates()];
}

// Synthetic vectors prove storage mechanics only. They are not semantic embeddings.
export function fixtureProvider():EmbeddingProvider{return {model:'fixture-vector-v1',async embed(text){const bytes=createHash('sha256').update(text).digest();return Array.from({length:1536},(_,i)=>(bytes[i%bytes.length]+1)/256);}};}

export function resourceCandidates(){
 return [
  circleObservation({circle_id:'demo-circle',id:'demo-resource-general',state:'published',parent_id:null,revision:1,published_revision:1,authorName:'Alex Example',content:{
   type:'resource',title:"Alex Example's concurrency study guide",body:'Alex Example used these notes to practice lock contention. Ask alex@example.com or +1 (212) 555-0100. Private notes: https://example.com/notes?token=fake',
   provenance:'user_confirmed',sources:[{url:'https://example.com/prep/concurrency?utm_source=circle',label:'Concurrency preparation guide'}],
   contexts:[{kind:'resource',label:'Same guide shared twice',url:'https://example.com/prep/concurrency'},{kind:'resource',label:"Alex Example's locking notes",url:'https://example.com/prep/locking'}],
   uncertainty:'Fictional shared preparation resource; usefulness is a member report.'
  }}),
  circleObservation({circle_id:'demo-circle',id:'demo-resource-process',state:'published',parent_id:null,revision:1,published_revision:1,content:{
   type:'resource',title:'Backend reliability reading list',insight:'Fictional preparation resource for a backend technical round.',body:'Read the failure-handling section before practicing the project deep dive.',provenance:'unknown',
   sources:[{url:'https://example.com/prep/reliability',label:'Reliability preparation guide'}],
   contexts:[{kind:'application',label:'Cedar Systems (demo) backend process',company:'Cedar Systems (demo)',role:'Backend Engineer',stage:'technical',jobId:'DEMO-BACKEND-2027',jobUrl:'https://example.com/jobs/cedar-backend'}]
  }})
 ];
}

export function taggedCandidates(){
 return [circleObservation({circle_id:'demo-circle',id:'demo-circle-tagged',state:'published',revision:1,published_revision:1,content:{
  type:'discussion',title:'Resources for my backend round',provenance:'unknown',
  insight:'Fictional preparation discussion.',
  body:'I am using [@Concurrency study guide](?circle=demo-circle&thread=demo-resource-general) before this round. This reference does not share my private application history.',
  contexts:[{kind:'application',label:'Cedar Systems (demo) backend process',company:'Cedar Systems (demo)',role:'Backend Engineer',stage:'technical',jobId:'DEMO-BACKEND-2027'},
   {kind:'resource',label:'Reliability preparation guide',url:'https://example.com/prep/reliability'}]
 }})];
}
