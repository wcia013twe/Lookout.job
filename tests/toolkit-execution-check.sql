begin;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();a uuid;b uuid;r jsonb;f jsonb;
 k text:=repeat('a',64);other_key text:=repeat('b',64);p jsonb;
begin
 insert into auth.users(id) values(u),(v);
 insert into public.jobs(id,canonical_url,employer) values('toolkit-fixture','https://example.com/toolkit','{}');
 insert into public.applications(user_id,job_id) values(u,'toolkit-fixture') returning id into a;
 insert into public.applications(user_id,job_id) values(v,'toolkit-fixture') returning id into b;
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Toolkit',k,array['workspace:read','drafts:write','profile:write','preferences:write'],now()+interval '1 hour'),(v,'Other',other_key,array['workspace:read','drafts:write'],now()+interval '1 hour');
 p:=jsonb_build_object('kind','evaluation','eventKey','eval','applicationId',a,'result','{"score":4.5,"requirements":[]}'::jsonb);
 r:=public.agent_dispatch(k,'toolkit.record',p);
 if public.agent_dispatch(k,'toolkit.record',p)->>'id'<>r->>'id' then raise exception 'Duplicate result';end if;
 begin perform public.agent_dispatch(k,'toolkit.record',jsonb_set(p,'{result,score}','4'));raise exception 'Changed retry';exception when serialization_failure then null;end;
 begin perform public.agent_dispatch(other_key,'toolkit.record',p);raise exception 'Owner bypass';exception when no_data_found then null;end;
 if jsonb_array_length(public.agent_dispatch(other_key,'toolkit.results','{}'))<>0 then raise exception 'Foreign results';end if;
 r:=public.agent_dispatch(k,'toolkit.context','{}');if jsonb_array_length(r->'applications')<>1 or jsonb_array_length(r->'results')<>1 then raise exception 'Context ownership';end if;
 p:=jsonb_build_object('kind','resume','eventKey','pdf','fileName','resume.pdf','sha256',repeat('c',64),'bytes',100,'applicationId',a);
 f:=public.agent_dispatch(k,'toolkit.file.begin',p);
 begin perform public.agent_dispatch(other_key,'toolkit.file.read',jsonb_build_object('fileId',f->>'fileId'));raise exception 'Foreign file';exception when no_data_found then null;end;
 begin perform public.agent_dispatch(k,'toolkit.file.read',jsonb_build_object('fileId',f->>'fileId'));raise exception 'Incomplete file';exception when no_data_found then null;end;
 insert into storage.objects(bucket_id,name) values('resumes',f->>'objectPath');
 r:=public.agent_dispatch(k,'toolkit.file.finalize',jsonb_build_object('fileId',f->>'fileId'));
 if r->>'completed'<>'true' or r->>'resumeId' is null then raise exception 'Not registered';end if;
 perform public.agent_dispatch(k,'toolkit.file.finalize',jsonb_build_object('fileId',f->>'fileId'));
 begin perform public.agent_dispatch(k,'toolkit.file.begin',jsonb_set(p,'{sha256}',to_jsonb(repeat('d',64))));raise exception 'PDF retry changed';exception when serialization_failure then null;end;
 if (select count(*) from public.resumes where id=(f->>'fileId')::uuid)<>1 then raise exception 'Duplicate resume';end if;
 if (select draft from public.applications where id=a)<>'{}'::jsonb then raise exception 'Draft modified';end if;
 update private.agent_connections set scopes=array['workspace:read'] where token_hash=k;
 begin perform public.agent_dispatch(k,'toolkit.record',p);raise exception 'Scope bypass';exception when insufficient_privilege then null;end;
 update private.agent_connections set revoked_at=now() where token_hash=k;
 begin perform public.agent_dispatch(k,'toolkit.context','{}');raise exception 'Revocation bypass';exception when invalid_authorization_specification then null;end;
end $$;
set local role authenticated;
select set_config('test.uid','22222222-2222-2222-2222-222222222222',true);
do $$ begin
 begin insert into public.career_toolkit_results(user_id,kind,event_key,result) values(auth.uid(),'analytics','browser-write','{}');raise exception 'Browser wrote result';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.career_toolkit_results) then raise exception 'RLS leak';end if;end $$;
rollback;
