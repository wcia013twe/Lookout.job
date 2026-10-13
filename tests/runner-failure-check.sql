begin;
do $$
declare u uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid(); app_id uuid; result jsonb; failure jsonb;
  key_hash text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  blocked_hash text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  job_id text:='failure-test-'||gen_random_uuid()::text;
begin
  insert into auth.users(id) values(u),(other_user);
  insert into public.jobs(id,canonical_url,employer) values(job_id,'https://example.com/'||job_id,'{}');
  insert into public.applications(user_id,job_id,draft) values(u,job_id,'{"questions":[]}') returning id into app_id;
  insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at)
    values(u,'Failure test',key_hash,array['drafts:write'],now()+interval '1 hour'),
    (other_user,'Other user',blocked_hash,array['workspace:read'],now()+interval '1 hour');
  failure:=jsonb_build_object('applicationId',app_id,'eventKey','failure-test','expectedRevision',0,'stage','agent','outcome','blocked','reason','Form could not be completed','nextAction','Review employer form','attempts','[{"stage":"playwright","status":"failed"},{"stage":"agent","status":"failed"}]'::jsonb);
  begin perform public.agent_dispatch(blocked_hash,'runner.report_failure',failure); raise exception 'Scope bypass'; exception when insufficient_privilege then null; end;
  update private.agent_connections set scopes=array['drafts:write'] where token_hash=blocked_hash;
  begin perform public.agent_dispatch(blocked_hash,'runner.report_failure',failure); raise exception 'Owner bypass'; exception when no_data_found then null; end;
  result:=public.agent_dispatch(key_hash,'runner.report_failure',failure);
  if result->'application'->>'status'<>'Blocked' or result->'application'->'draft'<>'{"questions":[]}'::jsonb
    or result->'application'->>'revision'<>'1' or result->'application'->'receipt'<>'null'::jsonb then raise exception 'Failure modified draft/evidence'; end if;
  result:=public.agent_dispatch(key_hash,'runner.report_failure',failure);
  if result->>'replayed'<>'true' or result->'application'->>'revision'<>'1' then raise exception 'Retry changed draft'; end if;
  if (select count(*) from public.activity_events where application_id=app_id and kind='runner_failure')<>1 then raise exception 'Duplicate timeline'; end if;
  begin perform public.agent_dispatch(key_hash,'runner.report_failure',jsonb_set(failure,'{eventKey}','"stale"')); raise exception 'Stale overwrite'; exception when serialization_failure then null; end;
  update public.applications set status='Submitted' where id=app_id;
  failure:=jsonb_set(jsonb_set(failure,'{eventKey}','"past-submit"'),'{expectedRevision}','1');
  begin perform public.agent_dispatch(key_hash,'runner.report_failure',failure); raise exception 'Submitted downgraded'; exception when invalid_parameter_value then null; end;
end $$;
rollback;
