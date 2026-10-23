begin;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();child uuid:=gen_random_uuid();pack uuid:=gen_random_uuid();foreign_id uuid:=gen_random_uuid();nested uuid:=gen_random_uuid();letter uuid:=gen_random_uuid();p jsonb;c jsonb;r jsonb;b jsonb;
 k text:=repeat('7',64);foreign_key text:=repeat('8',64);i integer;
begin
 insert into auth.users(id) values(u),(v);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Collection',k,array['workspace:read','drafts:write'],now()+interval '1 hour'),(v,'Foreign',foreign_key,array['workspace:read','drafts:write'],now()+interval '1 hour');
 perform set_config('test.uid',u::text,true);
 p:=jsonb_build_object('id',child,'expectedVersion',0,'title','Project story','purpose','Reusable evidence','kind','notes','format','markdown','body','Original candidate story','sources','[]'::jsonb,'links','[]'::jsonb);
 perform public.artifact_action('artifacts.save',p);
 perform public.agent_dispatch(foreign_key,'artifacts.save',p||jsonb_build_object('id',foreign_id));
 perform public.artifact_action('artifacts.save',p||jsonb_build_object('id',letter,'kind','cover_letter'));
 c:=p||jsonb_build_object('id',pack,'kind','interview_brief','title','Interview folder','preparedFor','2026-10-23','materials',jsonb_build_array(jsonb_build_object('id',child,'version',1)));
 r:=public.artifact_action('artifacts.save',c);
 if public.agent_dispatch(k,'artifacts.save',c)<>r then raise exception 'Collection transport replay mismatch';end if;
 if public.agent_dispatch(k,'artifacts.read',jsonb_build_object('id',pack))->'content'->'materials'<>c->'materials' then raise exception 'Ordered references lost';end if;
 b:=public.agent_dispatch(k,'artifacts.list','{"shelf":"prepared","asOf":"2026-10-22"}');
 if jsonb_array_length(b->'items')<>1 or b->'items'->0->'content'->'materials'<>c->'materials' or b->'items'->0->'content' ? 'body' then raise exception 'Prepared shelf metadata mismatch';end if;
 if jsonb_array_length(public.artifact_action('artifacts.list','{"shelf":"prepared","asOf":"2026-10-24"}')->'items')<>0 then raise exception 'Old prep remains featured';end if;
 if jsonb_array_length(public.artifact_action('artifacts.list','{"shelf":"saved","asOf":"2026-10-24"}')->'items')<>2 then raise exception 'Expired prep not saved';end if;
 if jsonb_array_length(public.agent_dispatch(foreign_key,'artifacts.list','{"shelf":"prepared","asOf":"2026-10-22"}')->'items')<>0 then raise exception 'Foreign shelf leak';end if;
 begin perform public.artifact_action('artifacts.save',c||jsonb_build_object('id',nested,'materials',jsonb_build_array(jsonb_build_object('id',foreign_id,'version',1))));raise exception 'Foreign reference accepted';exception when no_data_found then null;end;
 begin perform public.agent_dispatch(k,'artifacts.save',c||jsonb_build_object('id',nested,'materials',jsonb_build_array(jsonb_build_object('id',child,'version',99))));raise exception 'Missing revision accepted';exception when no_data_found then null;end;
 begin perform public.artifact_action('artifacts.save',c||jsonb_build_object('id',nested,'materials',jsonb_build_array(jsonb_build_object('id',pack,'version',1))));raise exception 'Nested collection accepted';exception when no_data_found then null;end;
 begin perform public.artifact_action('artifacts.save',c||jsonb_build_object('id',nested,'materials',jsonb_build_array(jsonb_build_object('id',letter,'version',1))));raise exception 'Application document accepted';exception when no_data_found then null;end;
 begin perform public.artifact_action('artifacts.save',c||jsonb_build_object('id',nested,'materials',(c->'materials')||(c->'materials')));raise exception 'Duplicate reference accepted';exception when invalid_parameter_value then null;end;
 begin perform public.agent_dispatch(k,'artifacts.save',c||jsonb_build_object('id',child));raise exception 'Self reference accepted';exception when invalid_parameter_value then null;end;
 begin perform public.agent_dispatch(k,'artifacts.save',c||'{"preparedFor":"2026-02-30"}');raise exception 'Bad date accepted';exception when invalid_parameter_value then null;end;
 begin perform public.artifact_action('artifacts.save',c||'{"kind":"notes"}');raise exception 'Non-prep featured';exception when invalid_parameter_value then null;end;
 begin perform public.agent_dispatch(k,'artifacts.list','{"shelf":"fake"}');raise exception 'Bad shelf accepted';exception when invalid_parameter_value then null;end;
 begin perform public.artifact_action('artifacts.list','{"asOf":"2026-10-22"}');raise exception 'Date without shelf accepted';exception when invalid_parameter_value then null;end;
 perform public.agent_dispatch(k,'artifacts.save',p||'{"expectedVersion":1,"body":"New candidate story"}');
 if public.artifact_action('artifacts.read',jsonb_build_object('id',child,'version',1))->'content'->>'body'<>'Original candidate story' then raise exception 'Collection content changed underneath';end if;
 perform public.artifact_action('artifacts.archive',jsonb_build_object('id',child,'expectedVersion',2,'archived',true));
 if public.agent_dispatch(k,'artifacts.read',jsonb_build_object('id',child,'version',1))->'content'->>'body'<>'Original candidate story' then raise exception 'Archived child revision unreadable';end if;
 perform public.agent_dispatch(k,'artifacts.save',c||'{"expectedVersion":1,"body":"Updated overview"}');
 begin perform public.artifact_action('artifacts.save',c||'{"body":"Stale overview"}');raise exception 'Stale collection accepted';exception when serialization_failure then null;end;
 -- Shelf pagination happens after classification, so new generic notes cannot bury older prep.
 for i in 1..26 loop
  perform public.artifact_action('artifacts.save',p||jsonb_build_object('id',gen_random_uuid(),'title','Saved note '||i));
 end loop;
 if jsonb_array_length(public.artifact_action('artifacts.list','{"shelf":"prepared","asOf":"2026-10-22"}')->'items')<>1 then raise exception 'Prep buried by saved notes';end if;
 b:=public.artifact_action('artifacts.list','{"shelf":"saved","asOf":"2026-10-22"}');
 if jsonb_array_length(b->'items')<>25 or b->>'nextOffset'<>'25' then raise exception 'Saved shelf pagination lost';end if;
 if jsonb_array_length(public.agent_dispatch(k,'artifacts.list','{"shelf":"saved","asOf":"2026-10-22","offset":25}')->'items')<>1 then raise exception 'Saved continuation lost';end if;
end $$;
rollback;
