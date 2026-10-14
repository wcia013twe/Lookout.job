begin;
do $$
declare u uuid:=gen_random_uuid(); h text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); upload_id uuid:=gen_random_uuid(); j text:='extended-'||gen_random_uuid(); app uuid; r jsonb; request jsonb;
begin
 insert into auth.users(id) values(u);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Extended',h,array['workspace:read','network:write','tracking:write','resumes:write'],now()+interval '1 hour');
 begin
  perform public.agent_dispatch(h,'contacts.save','{"id":"missing-company","record":{},"expectedRevision":0}');
  raise exception 'Missing company accepted';
 exception when invalid_parameter_value then null; end;
 r:=public.agent_dispatch(h,'contacts.save','{"id":"extended-test","record":{"company":"Example","contact":"Fictional"},"expectedRevision":0}');
 if r->>'revision'<>'1' then raise exception 'Contact version wrong'; end if;
 r:=public.agent_dispatch(h,'contacts.read','{}');
 if jsonb_array_length(r)<>1 then raise exception 'Contact not readable'; end if;
 perform public.agent_dispatch(h,'contacts.delete','{"id":"extended-test","expectedRevision":1}');
 if jsonb_array_length(public.agent_dispatch(h,'contacts.read','{}'))<>0 then raise exception 'Deleted contact visible'; end if;
 request:=jsonb_build_object('id',upload_id,'name','Example','variant','Master','version',1,'fileType','pdf','sizeBytes',9,'sha256',repeat('a',64));
 r:=public.agent_dispatch(h,'resumes.upload.begin',request);
 if r->>'objectPath'<>u::text||'/'||upload_id::text||'.pdf' then raise exception 'Upload path not owner-derived'; end if;
 if exists(select 1 from public.resumes where id=upload_id) then raise exception 'Unverified upload registered'; end if;
 begin
  perform public.agent_dispatch(h,'resumes.upload.begin',request||'{"name":"Different"}');
  raise exception 'Upload conflict accepted';
 exception when serialization_failure then null; end;
 r:=public.agent_dispatch(h,'resumes.reference.add',jsonb_build_object('id',gen_random_uuid(),'name','Master','variant','Master','version',1,'url','https://example.com/resume.pdf'));
 if r->>'content_hash' is not null or r->>'reference_url'<>'https://example.com/resume.pdf' then raise exception 'Reference misrepresented as uploaded file'; end if;
 insert into public.jobs(id,canonical_url,employer) values(j,'https://example.com/'||j,'{}');
 insert into public.applications(user_id,job_id) values(u,j) returning id into app;
 request:=jsonb_build_object('applicationId',app,'expectedRevision',0,'status','Submitted','note','User says submitted manually','eventKey','first-report');
 r:=public.agent_dispatch(h,'applications.progress',request);
 if r->>'confirmed'<>'false' or r#>>'{application,receipt}' is not null then raise exception 'Forged receipt'; end if;
 if public.agent_dispatch(h,'applications.progress',request) is distinct from r then raise exception 'Report replay changed'; end if;
end $$;
rollback;
