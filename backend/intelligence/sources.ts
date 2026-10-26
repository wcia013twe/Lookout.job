import {contactsForProcess} from '../../lib/network-model.mjs';
import {readConversation} from '../../lib/outreach-conversation.mjs';
import type {Candidate, MatchingContext, ResourceLink} from './types.ts';
export type {Candidate} from './types.ts';
export type CircleSource = {
 id:string; state:string; parent_id?:string|null; revision:number; published_revision:number|null; authorName?:string;
 content:{type?:string;title?:string;company?:string|null;sources?:ResourceLink[];contexts?:({kind:string;label:string;url?:string;company?:string;role?:string;stage?:string;jobId?:string;jobUrl?:string;contact?:string})[]; role?:string|null; stage?:string|null; insight?:string; body?:string; experienceDate?:string|null; provenance:string; uncertainty?:string|null};
};
export type ApplicationSource = {id:string; company:string; title?:string; candidateName?:string; url?:string; applicationUrl?:string; backendId?:string};
export type MilestoneSource = {id:string; application_id:string; kind:string; phase:string; label:string; occurred_at:string|null; source?:unknown};
export type ContactSource = {id:string; revision?:number; contact?:string; name?:string; tags?:string[]; notes:string; jobUrl?:string; link?:string};
type LoggedMessage = {id:string; direction:string; channel:string; date:string; body:string};
const identities = (...values:(string|undefined)[]) => values.filter((value):value is string => Boolean(value));

export function circleObservation(post:CircleSource):Candidate {
 if(post.state!=='published'||post.parent_id||post.revision!==post.published_revision)throw Error('SOURCE_NOT_PUBLISHED');
 const c=post.content;
 const resource=c.type==='resource';
 const contexts:MatchingContext[]=(c.contexts??[]).filter(item=>item.kind==='application').map(item=>({
  label:item.label,...Object.fromEntries(['company','role','stage','jobId','jobUrl'].filter(key=>Object.hasOwn(item,key)).map(key=>[key,item[key as keyof typeof item]])),
 }));
 // A single attached application is usable context; never combine fields from unrelated attachments.
 const primary=!c.company&&contexts.length===1?contexts[0]:null;
 const resourceLinks=resource?[...(c.sources??[]),...(c.contexts??[]).filter(item=>item.kind==='resource'&&item.url).map(item=>({url:item.url!,label:item.label}))]:[];
 return {
  identities:identities(post.authorName,...(c.contexts??[]).filter(item=>item.kind==='referral').map(item=>item.contact)),
  observation:{sourceType:'circle_post',sourceId:post.id,sourceRevision:post.revision,
   contentKind:resource?'resource':'observation',title:c.title??null,resourceLinks,contexts,
   company:c.company??primary?.company??null,role:primary?.role??c.role??null,stage:primary?.stage??c.stage??null,
   insight:resource?[...new Set([c.insight,c.body].filter(Boolean))].join('\n\n'):c.insight||c.body||'',experienceDate:c.experienceDate??null,provenance:c.provenance,uncertainty:c.uncertainty??null},
 };
}
export function applicationObservations(application:ApplicationSource,milestones:MilestoneSource[],contacts:ContactSource[]):Candidate[] {
 const base={sourceType:'application_update' as const,company:application.company,role:application.title??null};
 const rows:Candidate[]=milestones.filter(m=>m.application_id===application.id).map(m=>({identities:identities(application.candidateName),observation:{...base,sourceId:m.id,sourceRevision:1,stage:m.kind,insight:`${m.phase}: ${m.label}`,experienceDate:m.occurred_at?.slice(0,10)??null,provenance:'unknown',uncertainty:'Recorded application milestone; not independent employer verification.'}}));
 for(const contact of contactsForProcess(contacts,application)) {
  for(const message of (readConversation(contact).messages as LoggedMessage[]).filter(m=>m.direction==='received'))rows.push({identities:identities(contact.contact,contact.name,application.candidateName),observation:{...base,sourceId:`${contact.id}:${message.id}`,sourceRevision:contact.revision??1,stage:null,insight:`Logged ${message.channel} reply: ${message.body}`,experienceDate:message.date,provenance:'unknown',uncertainty:'Logged correspondence; sender statements are not independently verified.'}});
 }
 return rows;
}
