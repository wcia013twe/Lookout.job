begin;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();a uuid:=gen_random_uuid();k text:=repeat('1',64);ro text:=repeat('2',64);foreign_key text:=repeat('3',64);r jsonb;p jsonb;t timestamptz;
begin
 insert into auth.users(id) values(u),(v);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values
 (u,'Workflow',k,array['workspace:read','network:write','drafts:write','profile:write'],now()+interval '1 hour'),
 (u,'Read only',ro,array['workspace:read'],now()+interval '1 hour'),
 (v,'Other',foreign_key,array['workspace:read','network:write','drafts:write'],now()+interval '1 hour');
 insert into public.profiles(user_id,facts,verified_at) values(u,'{"name":"Fictional Person","location":"Old","projects":[{"name":"Keep"}]}',now()) returning updated_at into t;
 p:=jsonb_build_object('expectedUpdatedAt',t,'fields',jsonb_build_object('location','New'));
 r:=public.agent_dispatch(k,'profile.fields.update',p);
 if r#>>'{facts,name}'<>'Fictional Person' or r#>>'{facts,location}'<>'New' or r#>>'{facts,projects,0,name}'<>'Keep' or r->>'verified_at' is not null then raise exception 'Partial facts lost fields or granted verification';end if;
 begin perform public.agent_dispatch(k,'profile.fields.update',p||jsonb_build_object('expectedUpdatedAt',t-interval '1 second'));raise exception 'Stale profile accepted';exception when sqlstate 'PT409' then null;end;
 begin perform public.agent_dispatch(k,'profile.fields.update',p||'{"fields":{"verified_at":"now"}}');raise exception 'Verification injection accepted';exception when invalid_parameter_value then null;end;
 insert into public.company_workspaces(user_id,id,name,research) values(u,'target','Fictional Co','Keep research');
 p:='{"id":"target","expectedRevision":1,"fields":{"nextAction":"Ask about team scope"}}';
 perform set_config('test.uid',u::text,true);
 execute 'set local role authenticated';
 r:=public.update_workspace_fields('company_workspaces.fields.update',p,u);
 execute 'reset role';
 if r#>>'{record,research}'<>'Keep research' or r#>>'{record,nextAction}'<>'Ask about team scope' or (r->>'revision')::integer<>2 then raise exception 'Company field update failed';end if;
 begin perform public.agent_dispatch(k,'company_workspaces.fields.update',p);raise exception 'Stale company accepted';exception when serialization_failure then null;end;
 begin perform public.agent_dispatch(ro,'company_workspaces.fields.update',p);raise exception 'Read scope wrote';exception when insufficient_privilege then null;end;
 begin perform public.agent_dispatch(foreign_key,'company_workspaces.fields.update',p);raise exception 'Foreign company accepted';exception when no_data_found then null;end;
 begin perform public.update_workspace_fields('company_workspaces.fields.update',p,v);raise exception 'Changed account accepted';exception when insufficient_privilege then null;end;
 insert into public.outreach_contacts(user_id,id,record) values(u,'person','{"company":"Fictional Co","name":"Fictional Person","notes":"Keep"}');
 r:=public.agent_dispatch(k,'contacts.fields.update','{"id":"person","expectedRevision":0,"fields":{"message":"Draft only"}}');
 if r#>>'{record,notes}'<>'Keep' or r#>>'{record,message}'<>'Draft only' then raise exception 'Contact update lost fields';end if;
 begin perform public.agent_dispatch(k,'contacts.fields.update','{"id":"person","expectedRevision":2,"fields":{"collection":"companies"}}');raise exception 'Contact kind injection';exception when invalid_parameter_value then null;end;
 perform private.artifact_owned(u,'artifacts.save',jsonb_build_object('id',a,'expectedVersion',0,'title','Original','purpose','Keep purpose','kind','notes','format','markdown','body','Original body','sources','[]'::jsonb,'links','[]'::jsonb));
 p:=jsonb_build_object('id',a,'expectedVersion',1,'fields',jsonb_build_object('body','AI analysis: team scope remains unknown.'));
 perform public.agent_dispatch(k,'artifacts.fields.update',p);
 if (select content->>'purpose' from public.career_artifacts where id=a)<>'Keep purpose' or (select count(*) from public.career_artifact_revisions where artifact_id=a)<>2 then raise exception 'Artifact history or fields lost';end if;
 begin perform public.agent_dispatch(k,'artifacts.fields.update',p);raise exception 'Stale artifact replay overwrote';exception when serialization_failure then null;end;
 begin perform public.agent_dispatch(foreign_key,'artifacts.fields.update',p);raise exception 'Foreign artifact accepted';exception when no_data_found then null;end;
 insert into public.activity_events(user_id,event_key,kind,actor,payload) values(u,'brief','agent_note','agent','{"text":"Fictional saved outcome"}'),(v,'other','agent_note','agent','{"text":"Private foreign outcome"}');
 r:=public.agent_dispatch(ro,'brief.read','{}');
 execute 'set local role authenticated';
 if r is distinct from public.read_user_brief_snapshot('{}',u) then raise exception 'Brief transport parity failed';end if;
 execute 'reset role';
 if r::text like '%Private foreign outcome%' or r::text not like '%Fictional saved outcome%' then raise exception 'Brief ownership failed';end if;
 if (public.agent_dispatch(ro,'brief.read','{"mode":"notification"}')->>'batch') is not null then raise exception 'Notification pulled unsendable batch';end if;
 begin perform public.agent_dispatch(ro,'brief.read','{"approved":true}');raise exception 'Unknown brief arguments accepted';exception when invalid_parameter_value then null;end;
 update private.agent_connections set revoked_at=now() where token_hash=k;
 begin perform public.agent_dispatch(k,'contacts.fields.update','{}');raise exception 'Revoked credential accepted';exception when invalid_authorization_specification then null;end;
end $$;
rollback;
