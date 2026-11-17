begin;
do $$
declare u uuid:=gen_random_uuid();other uuid:=gen_random_uuid();r jsonb;fresh jsonb;bound uuid;old uuid;foreign_run uuid;
begin
 insert into auth.users(id) values(u),(other);
 insert into public.search_documents(user_id,kind,id,version,content,projection) values
 (u,'profile','recovery',1,'{}','{"active":true}'),
 (u,'portals','shared',1,'{}','{"tracked_companies":[{"id":"test","name":"Fixture","enabled":true}],"search_queries":[]}');
 r:=private.search_owned(u,'search.run.start','{"profileId":"recovery","eventKey":"first"}');old:=(r->>'id')::uuid;
 begin perform private.search_owned(u,'search.run.start','{"profileId":"recovery","eventKey":"fresh-conflict"}');raise exception 'Fresh sweep stolen';exception when serialization_failure then null;end;
 update public.search_runs set created_at=now()-interval '1 hour' where id=old;
 begin perform private.search_owned(u,'search.run.start','{"profileId":"recovery","eventKey":"progress-conflict"}');raise exception 'Recently progressing sweep stolen';exception when serialization_failure then null;end;
 update public.search_source_attempts set updated_at=now()-interval '1 hour',checkpoint='{"saved":"keep"}',counts='{"observed":7}' where run_id=old;
 insert into public.search_runs(user_id,profile_id,context_snapshot,mode,days,created_at) values(other,'recovery','{}','fresh',3,now()-interval '1 day') returning id into foreign_run;
 fresh:=private.search_owned(u,'search.run.start','{"profileId":"recovery","eventKey":"recovered"}');
 if fresh->>'id'=r->>'id' or (select state from public.search_runs where id=old)<>'partial' then raise exception 'Idle orphan not closed';end if;
 if (select checkpoint from public.search_source_attempts where run_id=old) <> '{"saved":"keep"}' or (select counts from public.search_source_attempts where run_id=old)<>'{"observed":7}' then raise exception 'Recovery lost progress';end if;
 if (select state from public.search_runs where id=foreign_run)<>'active' then raise exception 'Foreign sweep changed';end if;
 if private.search_owned(u,'search.run.start','{"profileId":"recovery","eventKey":"recovered"}')<>fresh then raise exception 'Recovery replay changed';end if;
 -- A queued/running backend owner keeps the run even after its source idle time.
 update public.search_runs set created_at=now()-interval '1 hour' where id=(fresh->>'id')::uuid;
 update public.search_source_attempts set updated_at=now()-interval '1 hour' where run_id=(fresh->>'id')::uuid;
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Fixture',repeat('b',64),array['workspace:read','preferences:write','drafts:write'],now()+interval '1 day') returning id into bound;
 insert into private.backend_jobs(user_id,connection_id,kind,input,search_run_id) values(u,bound,'search_ats','{"profileId":"recovery"}',(fresh->>'id')::uuid);
 begin perform private.search_owned(u,'search.run.start','{"profileId":"recovery","eventKey":"owned-conflict"}');raise exception 'Backend-owned sweep stolen';exception when serialization_failure then null;end;
end $$;
rollback;
