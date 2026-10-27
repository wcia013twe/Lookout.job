begin;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();a uuid;b uuid;foreign_app uuid;k text:=repeat('4',64);other_key text:=repeat('5',64);limited text:=repeat('6',64);p jsonb;begun jsonb;replay jsonb;batch jsonb;lease uuid;old_version integer;
begin
 insert into auth.users(id) values(u),(v);
 insert into public.jobs(id,canonical_url,employer) values('batch-fixture','https://job-boards.greenhouse.io/fixture/jobs/901','{}'),('batch-fixture-2','https://job-boards.greenhouse.io/fixture/jobs/902','{}');
 insert into public.applications(user_id,job_id) values(u,'batch-fixture') returning id into a;
 insert into public.applications(user_id,job_id) values(u,'batch-fixture-2') returning id into b;
 insert into public.applications(user_id,job_id) values(v,'batch-fixture') returning id into foreign_app;
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values
 (u,'batch',k,array['workspace:read','drafts:write','approvals:read','resumes:read'],now()+interval '1 hour'),
 (v,'other',other_key,array['workspace:read','drafts:write','approvals:read','resumes:read'],now()+interval '1 hour'),
 (u,'read',limited,array['workspace:read'],now()+interval '1 hour');
 p:=jsonb_build_object('eventKey','batch','applications',jsonb_build_array(jsonb_build_object('applicationId',a,'expectedRevision',0),jsonb_build_object('applicationId',b,'expectedRevision',0)));
 begin perform public.agent_dispatch(limited,'submission.batch.begin',p);raise exception 'Scope bypass';exception when insufficient_privilege then null;end;
 begin perform public.agent_dispatch(other_key,'submission.batch.begin',p);raise exception 'Owner bypass';exception when no_data_found then null;end;
 begin perform public.agent_dispatch(k,'submission.batch.begin',p||jsonb_build_object('owner',v));raise exception 'Identity injection';exception when invalid_parameter_value then null;end;
 begin perform public.agent_dispatch(k,'submission.batch.begin',jsonb_set(p,'{applications,0,expectedRevision}','1'));raise exception 'Stale draft';exception when serialization_failure then null;end;
 begun:=public.agent_dispatch(k,'submission.batch.begin',p);batch:=begun->'batch';lease:=(begun->>'leaseToken')::uuid;
 if begun->>'acquired'<>'true' then raise exception 'Batch not acquired';end if;
 replay:=public.agent_dispatch(k,'submission.batch.begin',p);
 if replay->>'acquired'<>'false' or replay->'batch'->>'id'<>batch->>'id' then raise exception 'Active batch replay executed';end if;
 perform set_config('test.uid',u::text,true);
 replay:=public.agent_dispatch(limited,'submission.batch.read','{}');
 execute 'set local role authenticated';
 if replay is distinct from public.read_submission_batches('{}') then raise exception 'Browser/MCP batch parity failed';end if;
 execute 'reset role';
 if public.agent_dispatch(limited,'submission.batch.read','{}')::text like '%lease_token%' then raise exception 'Lease secret leaked';end if;
 if jsonb_array_length(public.agent_dispatch(other_key,'submission.batch.read','{}')->'batches')<>0 then raise exception 'Foreign read leaked';end if;
 begin perform public.agent_dispatch(k,'submission.batch.begin',jsonb_set(p,'{applications,0,expectedRevision}','9'));raise exception 'Changed retry';exception when serialization_failure then null;end;
 old_version:=(batch->>'version')::integer;
 update private.submission_batches set lease_expires_at=now()-interval '1 second' where id=(batch->>'id')::uuid;
 begun:=public.agent_dispatch(k,'submission.batch.begin',p);batch:=begun->'batch';
 begin perform public.agent_dispatch(k,'submission.batch.touch',jsonb_build_object('batchId',batch->>'id','leaseToken',lease,'expectedVersion',old_version,'applicationId',a));raise exception 'Old lease accepted';exception when serialization_failure then null;end;
 lease:=(begun->>'leaseToken')::uuid;
 begin perform public.agent_dispatch(k,'submission.batch.checkpoint',jsonb_build_object('batchId',batch->>'id','leaseToken',lease,'expectedVersion',(batch->>'version')::integer,'applicationId',foreign_app));raise exception 'Batch boundary bypass';exception when insufficient_privilege then null;end;
 -- Client checkpoints cannot claim success: outcomes derive only from saved records.
 begin perform public.agent_dispatch(k,'submission.batch.checkpoint',jsonb_build_object('batchId',batch->>'id','leaseToken',lease,'expectedVersion',(batch->>'version')::integer,'applicationId',a,'status','Submitted'));raise exception 'Outcome injection';exception when invalid_parameter_value then null;end;
 batch:=public.agent_dispatch(k,'submission.batch.checkpoint',jsonb_build_object('batchId',batch->>'id','leaseToken',lease,'expectedVersion',(batch->>'version')::integer,'applicationId',a));
 if batch->'results'->a::text->>'status'<>'Not submitted' then raise exception 'Checkpoint forged submission';end if;
 update public.applications set blocker='Needs a personal decision' where id=b;
 batch:=public.agent_dispatch(k,'submission.batch.checkpoint',jsonb_build_object('batchId',batch->>'id','leaseToken',lease,'expectedVersion',(batch->>'version')::integer,'applicationId',b));
 if batch->>'status'<>'partial' or batch->'results'->b::text->>'status'<>'Needs you' then raise exception 'Mixed outcomes lost';end if;
 if (select count(*) from public.approvals where user_id=u)<>0 or (select count(*) from public.submission_attempts where user_id=u)<>0 then raise exception 'Batch granted execution authority';end if;
 replay:=public.agent_dispatch(k,'submission.batch.begin',p);
 if replay->>'acquired'<>'false' or replay->'batch'->>'status'<>'partial' then raise exception 'Terminal replay reran';end if;
 execute 'set local role authenticated';
 begin perform 1 from private.submission_batches;raise exception 'Browser read private jobs';exception when insufficient_privilege then null;end;
 execute 'reset role';
 update private.agent_connections set revoked_at=now() where token_hash=k;
 begin perform public.agent_dispatch(k,'submission.batch.read','{}');raise exception 'Revoked read';exception when invalid_authorization_specification then null;end;
end $$;
rollback;
