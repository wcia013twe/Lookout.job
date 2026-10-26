import {contactsForProcess} from '../../lib/network-model.mjs';
import {readConversation} from '../../lib/outreach-conversation.mjs';
import type {Observation} from './types.ts';
export type Candidate={observation:Observation; identities:string[]};
export function circleObservation(post:any):Candidate {
 if(post.state!=='published'||post.parent_id||post.revision!==post.published_revision)throw Error('SOURCE_NOT_PUBLISHED');
 const c=post.content;
 return {identities:[post.authorName].filter(Boolean),observation:{sourceType:'circle_post',sourceId:post.id,sourceRevision:post.revision,company:c.company,role:c.role??null,stage:c.stage??null,insight:c.insight||c.body,experienceDate:c.experienceDate??null,provenance:c.provenance,uncertainty:c.uncertainty??null}};
}
export function applicationObservations(application:any,milestones:any[],contacts:any[]):Candidate[] {
 const base={sourceType:'application_update' as const,company:application.company,role:application.title??null};
 const rows:Candidate[]=milestones.filter(m=>m.application_id===application.id).map(m=>({identities:[application.candidateName].filter(Boolean),observation:{...base,sourceId:m.id,sourceRevision:1,stage:m.kind,insight:`${m.phase}: ${m.label}`,experienceDate:m.occurred_at?.slice(0,10)??null,provenance:'unknown',uncertainty:'Recorded application milestone; not independent employer verification.'}}));
 for(const contact of contactsForProcess(contacts,application)) {
  for(const message of readConversation(contact).messages.filter((m:any)=>m.direction==='received'))rows.push({identities:[contact.contact,contact.name,application.candidateName].filter(Boolean),observation:{...base,sourceId:`${contact.id}:${message.id}`,sourceRevision:contact.revision??1,stage:null,insight:`Logged ${message.channel} reply: ${message.body}`,experienceDate:message.date,provenance:'unknown',uncertainty:'Logged correspondence; sender statements are not independently verified.'}});
 }
 return rows;
}
