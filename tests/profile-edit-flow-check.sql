begin;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();key text:=repeat('d',64);ro text:=repeat('e',64);r jsonb;old jsonb;stamp timestamptz;
begin
 insert into auth.users values(u),(v);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Fictional profile flow',key,array['workspace:read','profile:write'],now()+interval '1 day'),(v,'Other account',ro,array['workspace:read','profile:write'],now()+interval '1 day');
 perform set_config('test.uid',u::text,true);execute 'set local role authenticated';
 r:=public.save_profile_changes('{"fields":{"name":"Fictional candidate","workExperience":[{"company":"Original","title":"Intern"}]},"expectedUpdatedAt":null}',u);
 old:=r;execute 'reset role';
 r:=public.agent_dispatch(key,'profile.work_experience.edit',jsonb_build_object('action','add','fields','{"company":"Added by Muse","title":"Engineer"}'::jsonb,'expectedUpdatedAt',r->'updated_at'));
 -- Website reloads, patches one scalar, Muse reads the same saved record.
 execute 'set local role authenticated';
 r:=public.save_profile_changes(jsonb_build_object('fields','{"phone":"Website phone","preferredName":"Fictional","postalCode":"00123"}'::jsonb,'expectedUpdatedAt',r->'updated_at'),u);
 if jsonb_array_length(r#>'{facts,workExperience}')<>2 then raise exception 'Browser patch erased agent entry';end if;
 begin perform public.save_profile_changes(jsonb_build_object('fields','{"name":"Stale"}'::jsonb,'expectedUpdatedAt',old->'updated_at'),u);raise exception 'Stale browser write accepted';exception when sqlstate 'PT409' then null;end;
 begin update public.profiles set facts='{}' where user_id=u;raise exception 'Legacy upsert path still writable';exception when insufficient_privilege then null;end;
 r:=public.review_profile_facts((r->>'updated_at')::timestamptz,true,u);if r->>'verified_at' is null then raise exception 'Human review unavailable';end if;
 old:=r;execute 'reset role';
 r:=public.agent_dispatch(key,'profile.fields.update',jsonb_build_object('fields','{"address":"New address"}'::jsonb,'expectedUpdatedAt',r->'updated_at'));
 if r->>'verified_at' is not null or r#>>'{facts,postalCode}'<>'00123' then raise exception 'Agent patch lost facts or retained verification';end if;
 begin perform public.agent_dispatch(key,'profile.fields.update',jsonb_build_object('fields','{"verified":true}'::jsonb,'expectedUpdatedAt',r->'updated_at'));raise exception 'Agent forged verification';exception when invalid_parameter_value then null;end;
 begin perform public.agent_dispatch(key,'profile.fields.update',jsonb_build_object('fields','{"phone":"Stale"}'::jsonb,'expectedUpdatedAt',old->'updated_at'));raise exception 'Stale agent patch accepted';exception when sqlstate 'PT409' then null;end;
 execute 'set local role authenticated';
 begin perform public.review_profile_facts((old->>'updated_at')::timestamptz,true,u);raise exception 'Stale human review accepted';exception when sqlstate 'PT409' then null;end;
 old:=public.save_profile_changes(jsonb_build_object('fields','{"location":"Website retry"}'::jsonb,'expectedUpdatedAt',r->'updated_at'),u);
 begin perform public.save_profile_changes(jsonb_build_object('fields','{"name":"Wrong owner"}'::jsonb,'expectedUpdatedAt',old->'updated_at'),v);raise exception 'Changed owner accepted';exception when insufficient_privilege then null;end;
 execute 'reset role';
 r:=public.agent_dispatch(key,'workspace.read','{}');
 if r#>>'{profile,facts,location}'<>'Website retry' or jsonb_array_length(r#>'{profile,facts,workExperience}')<>2 then raise exception 'Muse read-back differs';end if;
 begin perform public.agent_dispatch(ro,'profile.fields.update',jsonb_build_object('fields','{"name":"Cross-account"}'::jsonb,'expectedUpdatedAt',old->'updated_at'));raise exception 'Cross-account timestamp accepted';exception when sqlstate 'PT409' then null;end;
 execute 'set local role anon';
 begin perform public.review_profile_facts((old->>'updated_at')::timestamptz,true,u);raise exception 'Anonymous review accepted';exception when insufficient_privilege then null;end;
 execute 'reset role';
end $$;
rollback;
