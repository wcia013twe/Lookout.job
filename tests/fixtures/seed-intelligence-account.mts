// Local account seed only. Never imported by the account-backed ingestion entrypoint.
import {createHash} from 'node:crypto';
import {localPool} from '../../backend/intelligence/store.ts';
const ownerId=process.env.INTELLIGENCE_ACCOUNT_ID;
if(!ownerId)throw Error('INTELLIGENCE_ACCOUNT_ID_REQUIRED');
const pool=localPool(process.env.INTELLIGENCE_SOURCE_DATABASE_URL||'postgresql://postgres:postgres@127.0.0.1:54322/postgres','postgres');
const id=(kind:string)=>{const hash=createHash('md5').update(`lookout-intelligence-local:${ownerId}:${kind}`).digest('hex');return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20)}`;};
const circleId=id('circle'),resourceId=id('resource'),postId=id('post');
const client=await pool.connect();
try{
 await client.query('begin');
 const account=await client.query('select email from auth.users where id=$1',[ownerId]);
 if(!account.rows[0]?.email?.endsWith('@example.test'))throw Error('LOCAL_TEST_ACCOUNT_REQUIRED');
 const before=await client.query('select id,status,revision from public.applications where user_id=$1 order by id for share',[ownerId]);
 const apps=await client.query("select a.id,j.canonical_url,j.employer->>'company' as company,j.employer->>'title' as title from public.applications a join public.jobs j on j.id=a.job_id where a.user_id=$1 order by a.created_at,a.id limit 1",[ownerId]);
 const app=apps.rows[0];if(!app)throw Error('LOCAL_APPLICATION_REQUIRED');
 await client.query("insert into private.circles(id,name,owner_id) values($1,'[DEMO] Intelligence ingestion',$2) on conflict(id) do nothing",[circleId,ownerId]);
 const circle=await client.query('select owner_id from private.circles where id=$1',[circleId]);if(circle.rows[0].owner_id!==ownerId)throw Error('OWNER_MISMATCH');
 await client.query("insert into private.circle_members(circle_id,user_id,alias) values($1,$2,'Local test account') on conflict(circle_id,user_id) do nothing",[circleId,ownerId]);
 const resource={type:'resource',title:'[DEMO] A study guide shared through my account',body:'Fictional local ingestion test: Local test account practiced explaining lock contention. Contact sample@example.test. This is not an employer report.',sources:[{url:'https://example.com/demo/concurrency',label:'Fictional concurrency guide'}],provenance:'unknown',personalDisclosure:false};
 const linked={type:'discussion',title:'[DEMO] Preparing for this application',body:`Fictional local test: I attached my application context and [@A study guide](?circle=${circleId}&thread=${resourceId}). No actual interview outcome is asserted.`,sources:[],contexts:[{kind:'application',label:`${app.company} application context`.slice(0,200),company:app.company,role:app.title,jobUrl:app.canonical_url}],provenance:'unknown',personalDisclosure:true};
 for(const [post,content] of [[resourceId,resource],[postId,linked]] as const){
  await client.query("insert into private.knowledge_posts(id,circle_id,author_id,current_revision,published_revision,state) values($1,$2,$3,1,1,'published') on conflict(id) do nothing",[post,circleId,ownerId]);
  await client.query('insert into private.knowledge_revisions(post_id,revision,content) values($1,1,$2::jsonb) on conflict(post_id,revision) do nothing',[post,JSON.stringify(content)]);
 }
 const milestone=await client.query("select (private.record_application_milestone_owned($1,$2,$3::jsonb,'user')).id as id",[ownerId,app.id,JSON.stringify({eventKey:'local-intelligence-demo-v1',kind:'technical_round',label:'[DEMO] Technical-round note — fictional, not an employer update',phase:'received',source:{kind:'user',note:'Fictional local-account ingestion test; no real recruiting outcome asserted.'}})]);
 const after=await client.query('select id,status,revision from public.applications where user_id=$1 order by id',[ownerId]);
 if(JSON.stringify(before.rows)!==JSON.stringify(after.rows))throw Error('APPLICATION_STATE_CHANGED');
 if(process.argv.includes('--enable-local-circles'))await client.query('update private.knowledge_config set enabled=true where singleton');
 await client.query('commit');
 console.log(JSON.stringify({circleId,postIds:[resourceId,postId],applicationId:app.id,milestoneId:milestone.rows[0].id,localOnly:true,existingApplicationsUnchanged:true}));
}catch(error){await client.query('rollback');throw error;}finally{client.release();await pool.end();}
