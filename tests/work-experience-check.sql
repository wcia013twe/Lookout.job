begin;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();k text:=repeat('8',64);ro text:=repeat('9',64);otherkey text:=repeat('a',64);r jsonb;p jsonb;stamp timestamptz;original jsonb;pv bigint;
begin
 insert into auth.users(id) values(u),(v);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values
 (u,'Work history test',k,array['workspace:read','profile:write'],now()+interval '1 hour'),
 (u,'Read only',ro,array['workspace:read'],now()+interval '1 hour'),
 (v,'Other owner',otherkey,array['workspace:read','profile:write'],now()+interval '1 hour');
 original:='{"name":"Fictional Person","phone":"Keep","workExperience":[{"company":"First","title":"Intern","description":"Keep details","customLegacy":"preserve"},{"company":"Second","title":"Engineer"}],"education":[{"school":"Keep school"}],"projects":[{"name":"Keep project"}]}';
 insert into public.profiles(user_id,facts,verified_at) values(u,original,now()) returning updated_at into stamp;
 pv:=(public.agent_dispatch(k,'context.versions','{}')->>'personalVersion')::bigint;
 p:=jsonb_build_object('action','add','expectedUpdatedAt',stamp,'fields',jsonb_build_object('company','Third','title','Backend Intern'));
 r:=public.agent_dispatch(k,'profile.work_experience.edit',p);
 if jsonb_array_length(r#>'{facts,workExperience}')<>3 or ((r->'facts')-'workExperience') is distinct from (original-'workExperience') or r#>'{facts,workExperience,0}' is distinct from original#>'{workExperience,0}' or r->>'verified_at' is not null then raise exception 'Add lost facts/history or granted verification';end if;
 if (r->>'updated_at')::timestamptz<=stamp or (public.agent_dispatch(k,'context.versions','{}')->>'personalVersion')::bigint<=pv then raise exception 'Versions did not advance';end if;
 begin perform public.agent_dispatch(k,'profile.work_experience.edit',p);raise exception 'Repeated add duplicated entry';exception when sqlstate 'PT409' then null;end;
 stamp:=(r->>'updated_at')::timestamptz;
 p:=jsonb_build_object('action','update','entryIndex',0,'expectedUpdatedAt',stamp,'fields',jsonb_build_object('title','Updated title'));
 r:=public.agent_dispatch(k,'profile.work_experience.edit',p);
 if r#>>'{facts,workExperience,0,title}'<>'Updated title' or r#>>'{facts,workExperience,0,company}'<>'First' or r#>>'{facts,workExperience,0,description}'<>'Keep details' or r#>>'{facts,workExperience,0,customLegacy}'<>'preserve' or r#>'{facts,workExperience,1}' is distinct from original#>'{workExperience,1}' then raise exception 'Partial entry edit lost fields or other entry';end if;
 -- A no-op must not invalidate verification or advance versions.
 update public.profiles set verified_at=now() where user_id=u;
 select updated_at into stamp from public.profiles where user_id=u;
 r:=public.agent_dispatch(k,'profile.work_experience.edit',jsonb_set(p,'{expectedUpdatedAt}',to_jsonb(stamp)));
 if r->>'verified_at' is null or (r->>'updated_at')::timestamptz<>stamp then raise exception 'No-op changed verification/version';end if;
 -- Website entry calls the exact same core; removal preserves relative order.
 perform set_config('test.uid',u::text,true);execute 'set local role authenticated';
 p:=jsonb_build_object('action','remove','entryIndex',1,'expectedUpdatedAt',stamp);
 r:=public.edit_work_experience(p,u);
 execute 'reset role';
 if jsonb_array_length(r#>'{facts,workExperience}')<>2 or r#>>'{facts,workExperience,1,company}'<>'Third' or r->>'verified_at' is not null then raise exception 'Website removal failed';end if;
 begin perform public.agent_dispatch(k,'profile.work_experience.edit',p);raise exception 'Repeated removal deleted another entry';exception when sqlstate 'PT409' then null;end;
 stamp:=(r->>'updated_at')::timestamptz;
 p:=jsonb_build_object('action','update','entryIndex',0,'expectedUpdatedAt',stamp,'fields',jsonb_build_object('description',''));
 begin perform public.agent_dispatch(ro,'profile.work_experience.edit',p);raise exception 'Read-only key wrote history';exception when insufficient_privilege then null;end;
 begin perform public.agent_dispatch(otherkey,'profile.work_experience.edit',p);raise exception 'Foreign key edited owner profile';exception when no_data_found then null;end;
 execute 'set local role authenticated';
 begin perform public.edit_work_experience(p,v);raise exception 'Wrong expected owner accepted';exception when insufficient_privilege then null;end;
 begin perform private.edit_work_experience(u,p);raise exception 'Human called private helper';exception when insufficient_privilege then null;end;
 execute 'reset role';
 -- Invalid fields and indices reject in SQL, not only in the MCP validator.
 begin perform public.agent_dispatch(k,'profile.work_experience.edit',p||'{"fields":{"verified":true}}');raise exception 'Verification injected';exception when invalid_parameter_value then null;end;
 begin perform public.agent_dispatch(k,'profile.work_experience.edit',p||'{"fields":{"current":"true"}}');raise exception 'Bad field type';exception when invalid_parameter_value then null;end;
 begin perform public.agent_dispatch(k,'profile.work_experience.edit',p||'{"entryIndex":1.5}');raise exception 'Fractional index';exception when invalid_parameter_value then null;end;
 begin perform public.agent_dispatch(k,'profile.work_experience.edit',p||'{"entryIndex":49}');raise exception 'Missing entry accepted';exception when no_data_found then null;end;
 begin perform public.agent_dispatch(k,'profile.work_experience.edit',p||jsonb_build_object('userId',v));raise exception 'Owner injection';exception when invalid_parameter_value then null;end;
 r:=public.agent_dispatch(k,'profile.work_experience.edit',p);
 if r#>>'{facts,workExperience,0,description}'<>'' then raise exception 'Explicit field clearing failed';end if;
 update private.agent_connections set revoked_at=now() where token_hash=k;
 begin perform public.agent_dispatch(k,'profile.work_experience.edit',p);raise exception 'Revoked key wrote history';exception when invalid_authorization_specification then null;end;
 -- Empty history works; a full history cannot grow beyond its existing bound.
 insert into public.profiles(user_id,facts) values(v,'{"name":"Other"}') returning updated_at into stamp;
 r:=public.agent_dispatch(otherkey,'profile.work_experience.edit',jsonb_build_object('action','add','expectedUpdatedAt',stamp,'fields','{"company":"First entry"}'::jsonb));
 if jsonb_array_length(r#>'{facts,workExperience}')<>1 then raise exception 'Missing history not initialized';end if;
 update public.profiles set facts=jsonb_set(facts,'{workExperience}',(select jsonb_agg(jsonb_build_object('company','Fictional '||n)) from generate_series(1,50)n)),updated_at=clock_timestamp() where user_id=v returning updated_at into stamp;
 begin perform public.agent_dispatch(otherkey,'profile.work_experience.edit',jsonb_build_object('action','add','expectedUpdatedAt',stamp,'fields','{"company":"Too many"}'::jsonb));raise exception 'History bound bypassed';exception when invalid_parameter_value then null;end;
end $$;
rollback;
