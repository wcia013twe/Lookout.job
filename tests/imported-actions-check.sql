begin;
do $$
declare u uuid:='11111111-1111-1111-1111-111111111111';other uuid:='22222222-2222-2222-2222-222222222222';h text:=repeat('8',64);ro text:=repeat('9',64);r jsonb;request jsonb;before_sources jsonb;app uuid;bad jsonb;i integer:=0;
begin
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Actions test',h,array['workspace:read','tracking:write'],now()+interval '1 hour'),(u,'Read only',ro,array['workspace:read'],now()+interval '1 hour');
 r:=private.simplify_import_owned(u,'save','{"expectedVersion":0,"eventKey":"actions-fixture","rows":[{"company":"Fictional Trading","title":"Quant Associate","location":"Remote","url":null,"status":"SCREEN","employmentType":"FT","appliedDate":"2026-11-01","statusDate":"2026-11-07","archived":false,"archivedDate":null,"notes":"Original notes"}]}');
 select id,source_rows into app,before_sources from public.imported_jobs where user_id=u;
 request:=jsonb_build_object('id',app,'expectedVersion',1,'eventKey','record-action','changes','{"nextAction":"Complete HireVue","actionDate":"2026-11-08","needsAction":true,"completedStages":["APPLIED","SCREEN"]}'::jsonb);
 r:=public.agent_dispatch(h,'imports.update',request);
 if r->>'version'<>'2' or r->'record'->'record'->>'actionDate'<>'2026-11-08' or r->'record'->'record'->>'status'<>'SCREEN' or r->'record'->'record'->'completedStages'<>'["APPLIED","SCREEN"]'::jsonb or r->'verifiedSubmission'<>'false'::jsonb then raise exception 'Structured action or independent completion lost: %',r;end if;
 if public.agent_dispatch(h,'imports.update',request) is distinct from r then raise exception 'Replay differs';end if;
 if (select source_rows from public.imported_jobs where id=app) is distinct from before_sources or (select record->>'notes' from public.imported_jobs where id=app)<>'Original notes' then raise exception 'Source history changed';end if;
 begin perform public.agent_dispatch(h,'imports.update',request||'{"eventKey":"stale"}');raise exception 'Stale accepted';exception when serialization_failure then null;end;
 begin perform public.agent_dispatch(h,'imports.update',request||'{"changes":{"nextAction":"Different"}}');raise exception 'Changed retry accepted';exception when serialization_failure then null;end;
 begin perform public.agent_dispatch(ro,'imports.update',request);raise exception 'Read-only write accepted';exception when insufficient_privilege then null;end;
 for bad in select value from jsonb_array_elements('[{"actionDate":"2026-02-30"},{"actionDate":"tomorrow"},{"actionDate":5},{"nextAction":{}},{"nextAction":null},{"needsAction":null},{"needsAction":"yes"},{"completedStages":null},{"completedStages":["SCREEN","SCREEN"]},{"completedStages":["INTERVIEW"]},{"completedStages":["REJECTED"]},{"completedStages":[null]},{"receipt":{}}]'::jsonb) loop
  i:=i+1;
  begin perform public.agent_dispatch(h,'imports.update',jsonb_build_object('id',app,'expectedVersion',2,'eventKey','invalid-'||i,'changes',bad));raise exception 'Invalid changes accepted: %',bad;exception when invalid_parameter_value or invalid_datetime_format or datetime_field_overflow then null;end;
 end loop;
 perform set_config('test.uid',u::text,true);set local role authenticated;
 r:=public.simplify_import('list');if r->'records'->0->'record'->>'actionDate'<>'2026-11-08' then raise exception 'Browser read parity lost';end if;
 r:=public.simplify_import('update',jsonb_build_object('id',app,'expectedVersion',2,'eventKey','browser-waiting','changes','{"nextAction":"Wait for employer response","actionDate":null,"needsAction":false}'::jsonb));
 if r->'record'->'record'->'actionDate'<>'null'::jsonb or r->'record'->'record'->'needsAction'<>'false'::jsonb or r->'record'->'record'->'completedStages'<>'["APPLIED","SCREEN"]'::jsonb then raise exception 'Waiting state or completion preservation lost';end if;
 reset role;perform set_config('test.uid',other::text,true);set local role authenticated;
 begin perform public.simplify_import('update',jsonb_build_object('id',app,'expectedVersion',0,'eventKey','foreign','changes','{"nextAction":"Steal","actionDate":"2026-11-09"}'::jsonb));raise exception 'Cross-owner update';exception when no_data_found then null;end;
 reset role;
 if (select count(*) from public.applications where user_id=u)<>0 then raise exception 'Created a native application';end if;
 if (select version from private.tracker_import_versions where user_id=u)<>3 then raise exception 'Failed writes changed version';end if;
 r:=public.agent_dispatch(h,'imports.update',jsonb_build_object('id',app,'expectedVersion',3,'eventKey','clear','changes','{"nextAction":null,"actionDate":null,"needsAction":false,"completedStages":[]}'::jsonb));
 if r->'record'->'record'->'nextAction'<>'null'::jsonb then raise exception 'Clear failed';end if;
end $$;
rollback;
