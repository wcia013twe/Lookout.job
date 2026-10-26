import {circleObservation,applicationObservations} from './sources.ts';
import type {Candidate,Query,SourceLoader} from './types.ts';

// Server-selected owner only. Callers must authenticate/authorize before selecting this owner.
// Stage privately; selecting a source does not authorize Circle/global publication.
export function accountSourceLoader(query:Query,ownerId:string):SourceLoader {
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId))throw Error('INVALID_OWNER');
 return async()=>{
  const posts=await query(`select p.id,p.state,p.parent_id,p.published_revision,r.revision,r.content,m.alias as "authorName"
   from private.knowledge_posts p join private.knowledge_revisions r on r.post_id=p.id and r.revision=p.published_revision
   join private.circle_members m on m.circle_id=p.circle_id and m.user_id=$1 and m.active
   where p.author_id=$1 and (select enabled from private.knowledge_config where singleton) and p.state='published' and p.parent_id is null order by p.id limit 201`,[ownerId]);
  const applications=await query(`select a.id,a.revision,j.canonical_url as url,j.employer->>'company' as company,j.employer->>'title' as title
   from public.applications a join public.jobs j on j.id=a.job_id where a.user_id=$1 order by a.id limit 201`,[ownerId]);
  const milestones=await query(`select m.id,m.application_id,m.kind,m.phase,m.label,m.occurred_at::text
   from public.application_milestones m join public.applications a on a.id=m.application_id and a.user_id=m.user_id
   where m.user_id=$1 order by m.id limit 201`,[ownerId]);
  const contacts=await query('select id,revision,record from public.outreach_contacts where user_id=$1 and deleted_at is null order by id limit 201',[ownerId]);
  if([posts,applications,milestones,contacts].some(result=>result.rows.length>200))throw Error('SOURCE_BATCH_LIMIT_REACHED');
  const profile=await query(`select case when jsonb_typeof(facts->'name')='string' then facts->>'name' when jsonb_typeof(facts#>'{name,value}')='string' then facts#>>'{name,value}' end as name from public.profiles where user_id=$1`,[ownerId]);
  const candidateName=profile.rows[0]?.name??undefined;
  // Contact storage starts at revision zero; observation versions are one-based.
  const results:Candidate[]=posts.rows.map(circleObservation);
  for(const application of applications.rows)results.push(...applicationObservations({...application,candidateName},milestones.rows,contacts.rows.map(row=>({...row.record,id:row.id,revision:row.revision+1}))));
  return results;
 };
}
