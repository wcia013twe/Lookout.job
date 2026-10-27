// Validate retirement against real local Docker PostgreSQL in one rolled-back
// transaction. No schema migration history, accounts or running services change.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const config=await readFile(new URL('../supabase/config.toml',import.meta.url),'utf8');
assert.match(config,/project_id\s*=\s*"lookout-local"/);
const container='supabase_db_lookout-local';
const details=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.equal(details.Config.Labels['com.supabase.cli.project'],'lookout-local');assert.equal(details.State.Running,true);
const strip=sql=>sql.replace(/^begin;\s*/i,'').replace(/(?:commit|rollback);\s*$/i,'');
const migration=strip(await readFile(new URL('../supabase/migrations/20261027023257_remove_backend_search_scheduler.sql',import.meta.url),'utf8'));
const scenario=strip(await readFile(new URL('../tests/backend-jobs-check.sql',import.meta.url),'utf8'))
 .replace('insert into auth.users values(u),(v);','insert into auth.users(id) values(u),(v);')
 .replaceAll("set_config('test.uid'","set_config('request.jwt.claim.sub'");
const seed=`
create temporary table retired_schedule_proof as select gen_random_uuid() as owner,gen_random_uuid() as connection,gen_random_uuid() as schedule;
insert into auth.users(id) select owner from retired_schedule_proof;
insert into private.agent_connections(id,user_id,name,token_hash,scopes,expires_at)
 select connection,owner,'Fictional retirement proof',encode(sha256(connection::text::bytea),'hex'),array['workspace:read','preferences:write','drafts:write'],now()+interval '1 hour' from retired_schedule_proof;
insert into private.backend_schedules(id,user_id,connection_id,kind,input,interval_minutes,enabled,next_run_at)
 select schedule,owner,connection,'search_ats','{"profileId":"retirement-proof"}',15,true,now() from retired_schedule_proof;
`;
const verify=`do $$begin
 if not exists(select 1 from private.backend_requests r join retired_schedule_proof p on r.user_id=p.owner where r.operation='backend.schedules.retired' and r.response->>'id'=p.schedule::text and r.response->>'enabled'='true') then raise exception 'Schedule history lost';end if;
 if to_regclass('private.backend_schedules') is not null then raise exception 'Scheduler storage remains';end if;
end $$;`;
execFileSync('docker',['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:'begin;\n'+seed+migration+verify+scenario+'\nrollback;',encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:4*1024*1024});
console.log('PASS: real local PostgreSQL retirement archives schedules, rejects recurrence, preserves job scope/lease/retry/website/reset safeguards; transaction rolled back.');
