begin;
do $$
declare u uuid:='11111111-1111-1111-1111-111111111111';v uuid:='22222222-2222-2222-2222-222222222222';h text:=repeat('e',64); read_h text:=repeat('f',64);r jsonb; p jsonb; saved jsonb;
begin
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Network',h,array['workspace:read','network:write'],now()+interval '1 hour'),(v,'Read only',read_h,array['workspace:read'],now()+interval '1 hour');
 insert into public.outreach_contacts(id,user_id,record) values('network-contact',u,'{"company":"Example Company","contact":"Fictional Recruiter"}');
 insert into public.jobs(id,canonical_url,employer) values('network-job','https://example.com/network-job','{"company":"Example Company"}');
 insert into public.applications(id,user_id,job_id) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc',u,'network-job');
 r:='{"name":"Example Company","website":"https://example.com","priority":"Apply Now","interest":"Database work","targetTeams":"Storage","concerns":"Verify scope","research":"Agent observation, not confirmed instructions","nextAction":"Ask about scope","followUpDate":"2026-10-20","sources":[{"title":"Official guide","url":"https://example.com/guide","observedAt":"2026-10-20","summary":"Public evidence"}],"contactIds":["network-contact"],"applicationIds":["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],"archived":false}';
 p:=jsonb_build_object('id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','expectedRevision',0,'record',r);
 saved:=public.agent_network_dispatch(h,'network.company.save',p);
 if saved->>'revision'<>'1' or saved ? 'user_id' then raise exception 'Company create failed or leaks owner';end if;
 if public.agent_network_dispatch(h,'network.company.save',p)<>saved then raise exception 'Exact retry failed';end if;
 if (public.agent_network_dispatch(read_h,'network.companies.read','{}')->>'total')::int<>0 then raise exception 'Foreign company exposed';end if;
 begin perform public.agent_network_dispatch(read_h,'network.company.save',p);raise exception 'Read-only credential saved';exception when insufficient_privilege then null;end;
 begin perform public.agent_network_dispatch(h,'network.company.save',p||jsonb_build_object('record',r||'{"interest":"Stale"}'));raise exception 'Stale write saved';exception when serialization_failure then null;end;
 begin perform public.agent_network_dispatch(h,'network.company.save',p||jsonb_build_object('id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','record',r||'{"name":"  EXAMPLE   COMPANY "}'));raise exception 'Duplicate name saved';exception when unique_violation then null;end;
 begin perform public.agent_network_dispatch(h,'network.company.save',p||jsonb_build_object('expectedRevision',1,'record',r||'{"contactIds":["foreign"]}'));raise exception 'Foreign contact linked';exception when insufficient_privilege then null;end;
 begin perform public.agent_network_dispatch(h,'network.company.save',p||jsonb_build_object('expectedRevision',1,'record',r||'{"applicationIds":["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]}'));raise exception 'Foreign application linked';exception when insufficient_privilege then null;end;
 begin perform public.agent_network_dispatch(h,'network.company.save',p||jsonb_build_object('expectedRevision',1,'record',r||'{"website":"javascript:alert(1)"}'));raise exception 'Unsafe URL saved';exception when invalid_parameter_value then null;end;
 begin perform public.agent_network_dispatch(h,'network.company.save',p||jsonb_build_object('expectedRevision',1,'record',r||'{"followUpDate":"2026-02-30"}'));raise exception 'Invalid date saved';exception when datetime_field_overflow then null;end;
 begin perform public.agent_network_dispatch(h,'network.companies.read','{"limit":101}');raise exception 'Unbounded page accepted';exception when invalid_parameter_value then null;end;
 begin perform public.agent_network_dispatch(h,'network.company.save',p||jsonb_build_object('expectedRevision',1,'record',r||'{"approval":true}'));raise exception 'Unknown fields saved';exception when invalid_parameter_value then null;end;
 perform set_config('test.uid',u::text,true);
 saved:=public.network_action('network.company.save',p||jsonb_build_object('expectedRevision',1,'record',r||'{"research":"Human edit"}'),u);
 if saved->>'revision'<>'2' then raise exception 'Browser did not share revisions';end if;
 begin perform public.agent_network_dispatch(h,'network.company.save',p||jsonb_build_object('expectedRevision',1,'record',r));raise exception 'Agent overwrote browser';exception when serialization_failure then null;end;
 saved:=public.agent_network_dispatch(h,'network.company.save',p||jsonb_build_object('expectedRevision',2,'record',r||'{"archived":true}'));
 if saved->>'revision'<>'3' then raise exception 'Archive failed';end if;
 update private.agent_connections set revoked_at=now() where token_hash=h;
 begin perform public.agent_network_dispatch(h,'network.companies.read','{}');raise exception 'Revoked credential read';exception when invalid_authorization_specification then null;end;
end $$;
set local role authenticated;
set local test.uid='22222222-2222-2222-2222-222222222222';
do $$begin
 if (select count(*) from public.network_companies)<>0 then raise exception 'RLS exposed foreign rows';end if;
 begin perform public.network_action('network.companies.read','{}','11111111-1111-1111-1111-111111111111');raise exception 'Account swap accepted';exception when insufficient_privilege then null;end;
 begin perform public.agent_network_dispatch('x','network.companies.read','{}');raise exception 'Browser called trusted dispatcher';exception when insufficient_privilege then null;end;
 begin update public.network_companies set record='{}';raise exception 'Direct unvalidated edit accepted';exception when insufficient_privilege then null;end;
end $$;
set local test.uid='11111111-1111-1111-1111-111111111111';
do $$begin
 if (public.network_action('network.companies.read','{}','11111111-1111-1111-1111-111111111111')->>'total')::int<>1 then raise exception 'Browser could not read owned company';end if;
end $$;
rollback;
