// Real local PostgreSQL proof. Migration and fictional fixtures roll back together.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {museChangeFeedResponse} from '../lib/muse-change-feed.mjs';
const config=await readFile(new URL('../supabase/config.toml',import.meta.url),'utf8');assert.match(config,/project_id\s*=\s*"lookout-local"/);
const container='supabase_db_lookout-local',details=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.equal(details.Config.Labels['com.supabase.cli.project'],'lookout-local');assert.equal(details.State.Running,true);
const strip=sql=>sql.replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'');
const exists=execFileSync('docker',['exec',container,'psql','-X','-U','postgres','-d','postgres','-A','-t','-q','-c',"select to_regprocedure('private.interview_reporting_dispatch_previous(text,text,jsonb)') is not null"],{encoding:'utf8'}).trim()==='t';
// Apply the adjacent reporting dependency only inside this rolled-back proof.
const dependency=exists?'':strip(await readFile(new URL('../supabase/migrations/20261027030033_interview_reporting.sql',import.meta.url),'utf8'));
const migration=strip(await readFile(new URL('../supabase/migrations/20261027030548_semantic_muse_timeline_changes.sql',import.meta.url),'utf8'));
const user=randomUUID(),app=randomUUID(),job='timeline-proof-'+randomUUID(),hash=randomBytes(32).toString('hex');
const sql=`begin;
${dependency}
${migration}
insert into auth.users(id) values('${user}');
insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values('${user}','Fictional local timeline proof','${hash}',array['workspace:read','activity:write'],now()+interval '1 hour');
insert into public.jobs(id,canonical_url,employer) values('${job}','https://example.test/${job}','{}');
insert into public.applications(id,user_id,job_id,draft) values('${app}','${user}','${job}','{}');
do $$declare m jsonb;f jsonb;event uuid;t jsonb;
begin
 perform set_config('request.jwt.claim.sub','${user}',true);
 m:=to_jsonb(public.record_application_milestone('${app}','{"eventKey":"timeline-proof","kind":"interview","label":"PRIVATE interview label","occurredAt":null,"phase":"scheduled","source":{"kind":"user","note":"PRIVATE notes"}}'));
 f:=public.agent_dispatch('${hash}','changes.read','{}');
 if jsonb_array_length(f->'items')<>1 or f->'items'->0->>'kind'<>'application_timeline_changed' or f->'items'->0->>'milestoneId'<>m->>'id' or f::text like '%PRIVATE%' then raise exception 'Invalid timeline pointer';end if;
 event:=(f->'items'->0->>'id')::uuid;
 t:=public.agent_dispatch('${hash}','applications.timeline',jsonb_build_object('applicationId','${app}'));
 if jsonb_array_length(t->'milestones')<>1 or t->'milestones'->0->>'label'<>'PRIVATE interview label' then raise exception 'Current timeline missing';end if;
 perform public.agent_dispatch('${hash}','changes.ack',jsonb_build_object('eventIds',jsonb_build_array(event)));
 if public.agent_dispatch('${hash}','changes.read','{}')->'items'<>'[]'::jsonb then raise exception 'Ack did not clear handled event';end if;
 -- A later update remains pending, without resurrecting the earlier event.
 perform public.record_application_milestone('${app}','{"eventKey":"timeline-completed-proof","kind":"interview","label":"PRIVATE completed label","phase":"completed","source":{"kind":"user"}}');
end $$;
select public.agent_dispatch('${hash}','changes.read','{}');
rollback;`;
const raw=execFileSync('docker',['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-A','-t','-q','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:4*1024*1024});
const feed=museChangeFeedResponse(JSON.parse(raw.trim()));assert.equal(feed.items.length,1);assert.equal(feed.items[0].label,'Interview completed');assert.equal(feed.items[0].refresh.tool,'read_application_timeline');assert.equal(feed.eventTypes.length,5);
console.log('PASS: local Docker website timeline write → change pointer → current timeline read → acknowledge → new completion update; labels/catalog verified; all database changes rolled back.');
