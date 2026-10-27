begin;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();app uuid;r uuid;h text:=repeat('e',64);other_h text:=repeat('f',64);ro text:=repeat('d',64);result jsonb;item uuid;claim uuid;ctx jsonb;authz jsonb;rev integer;count_before integer;version_before bigint;rejected boolean:=false;
 j text:='inbox-'||gen_random_uuid()::text;
begin
 insert into auth.users(id) values(u),(v);
 insert into public.profiles(user_id,facts,verified_at) values(u,'{"name":"Fictional Person","email":"fictional@example.com"}',now());
 insert into public.resumes(user_id,name,object_path,content_hash) values(u,'Fictional',u||'/r.pdf',repeat('a',64)) returning id into r;
 insert into public.preferences(user_id,search) values(u,'{"autoSubmitApproved":true}');
 insert into public.jobs(id,canonical_url,employer) values(j,'https://job-boards.greenhouse.io/fictional/jobs/42','{"company":"Fictional"}');
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values
 (u,'Agent',h,array['workspace:read','drafts:write','approvals:read','resumes:read'],now()+interval '1 hour'),
 (v,'Other',other_h,array['workspace:read'],now()+interval '1 hour'),
 (u,'No read',ro,array['drafts:write'],now()+interval '1 hour');
 insert into public.applications(user_id,job_id,status,draft) values(u,j,'Awaiting approval',jsonb_build_object('questions','[]'::jsonb,'questionsReviewed',true,'resumeId',r,'url','https://job-boards.greenhouse.io/fictional/jobs/42','resumeSha256',repeat('a',64))) returning id into app;
 update public.applications set status='Awaiting approval' where id=app;
 select id into item from public.action_inbox where application_id=app and resolved_at is null;
 if item is null then raise exception 'Review not appended';end if;
 select version into version_before from public.workspace_changes where user_id=u;
 update public.applications set status='Awaiting approval' where id=app;
 if (select count(*) from public.action_inbox where application_id=app)<>1 then raise exception 'Duplicate report duplicated action';end if;
 if (select version from public.workspace_changes where user_id=u)<=version_before then raise exception 'No invalidation recorded';end if;
 -- Browser and agent read the same owned log. Neither can clear it directly.
 perform set_config('test.uid',u::text,true);
 result:=public.agent_dispatch(h,'applications.inbox.read','{}');
 execute 'set local role authenticated';
 if result is distinct from public.read_action_inbox('{}') then raise exception 'Browser MCP read differs';end if;
 if (select count(*) from public.action_inbox)<>1 then raise exception 'Owned action missing';end if;
 begin update public.action_inbox set resolved_at=now(),resolution='dismissed' where id=item;raise exception 'Browser cleared action';exception when insufficient_privilege then null;end;
 begin insert into public.workspace_changes(user_id) values(u);raise exception 'Browser forged notification';exception when insufficient_privilege then null;end;
 execute 'reset role';
 if jsonb_array_length(public.agent_dispatch(other_h,'applications.inbox.read','{}')->'items')<>0 then raise exception 'Agent leaked owner';end if;
 begin perform public.agent_dispatch(ro,'applications.inbox.read','{}');raise exception 'Read scope bypass';exception when insufficient_privilege then null;end;
 begin perform public.agent_dispatch(h,'applications.inbox.read','{"approved":true}');raise exception 'Consent argument accepted';exception when invalid_parameter_value then null;end;
 perform set_config('test.uid',v::text,true);
 execute 'set local role authenticated';
 if exists(select 1 from public.action_inbox) or exists(select 1 from public.workspace_changes) then raise exception 'RLS leaked another owner';end if;
 execute 'reset role';
 perform set_config('test.uid',u::text,true);
 -- Failed approval preserves the pending item; exact human approval resolves it.
 begin perform public.approve_application(app,99);exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Stale approval accepted';end if;
 if (select resolved_at from public.action_inbox where id=item) is not null then raise exception 'Failed approval cleared action';end if;
 perform public.approve_application(app,0);
 if (select resolution from public.action_inbox where id=item)<>'condition_resolved' then raise exception 'Approval did not resolve';end if;
 -- A rolled-back draft/blocker write must leave no log entry or notification change.
 select count(*) into count_before from public.action_inbox;
 select version into version_before from public.workspace_changes where user_id=u;
 begin
  update public.applications set blocker='Temporary failure' where id=app;
  raise exception 'rollback marker' using errcode='22023';
 exception when invalid_parameter_value then null;end;
 if (select count(*) from public.action_inbox)<>count_before or (select version from public.workspace_changes where user_id=u)<>version_before then raise exception 'Rollback left event';end if;
 update public.applications set blocker='Missing factual answer' where id=app;
 select id into item from public.action_inbox where application_id=app and resolved_at is null;
 if (select kind from public.action_inbox where id=item)<>'resolve_blocker' then raise exception 'Blocker missing';end if;
 update public.applications set blocker='Changed question' where id=app;
 if (select resolution from public.action_inbox where id=item)<>'superseded' then raise exception 'Updated blocker lost history';end if;
 update public.applications set blocker='' where id=app;
 if exists(select 1 from public.action_inbox where application_id=app and resolved_at is null and kind='resolve_blocker') then raise exception 'Resolved blocker remains pending';end if;
 update public.applications set status='Draft' where id=app;
 -- Real guarded attempt transitions create a delayed stall check, then uncertainty.
 ctx:=public.runner_submission_context(h,app);rev:=(ctx#>>'{application,revision}')::integer;
 authz:=jsonb_build_object('mode','automatic','id','inbox-test','applicationId',app,'userId',u,'revision',rev,'snapshot',jsonb_build_object('draft',ctx#>'{application,draft}','resume',ctx->'resume'));
 result:=public.runner_submission_transition(h,'claim',jsonb_build_object('applicationId',app,'attemptId','one'),ctx,authz);
 claim:=(result#>>'{attempt,id}')::uuid;
 perform public.runner_submission_transition(h,'start',jsonb_build_object('applicationId',app,'claimId',claim),ctx,authz);
 select id into item from public.action_inbox where application_id=app and resolved_at is null;
 if (select available_at from public.action_inbox where id=item)<>now()+interval '5 minutes' then raise exception 'Stall check not delayed';end if;
 perform public.runner_submission_transition(h,'finish',jsonb_build_object('applicationId',app,'claimId',claim,'outcome','uncertain'));
 if (select resolution from public.action_inbox where id=item)<>'superseded' then raise exception 'Stall check history lost';end if;
 select id into item from public.action_inbox where application_id=app and resolved_at is null;
 if (select kind from public.action_inbox where id=item)<>'check_submission' or (select available_at from public.action_inbox where id=item)>now() then raise exception 'Uncertainty not actionable';end if;
 select count(*) into count_before from public.action_inbox;
 perform public.runner_submission_transition(h,'finish',jsonb_build_object('applicationId',app,'claimId',claim,'outcome','uncertain'));
 if (select count(*) from public.action_inbox)<>count_before then raise exception 'Finish replay duplicated handoff';end if;
 rev:=(select revision from public.applications where id=app);
 -- Agent supplied progress cannot dismiss uncertainty or grant retry authority.
 update public.applications set status='Submitted' where id=app;
 if (select resolved_at from public.action_inbox where id=item) is not null then raise exception 'Status cleared uncertainty';end if;
 update public.applications set status='Blocked' where id=app;
 perform public.resolve_submission_attempt(app,rev,claim,'Checked employer portal: not submitted');
 if (select resolved_at from public.action_inbox where id=item) is null then raise exception 'Human resolution did not clear uncertainty';end if;
 if exists(select 1 from public.action_inbox where application_id=app and resolved_at is null and kind='check_submission') then raise exception 'Resolved attempt left handoff';end if;
 -- Positive human reporting resolves attention without forging employer evidence.
 update public.applications set status='Draft' where id=app;
 ctx:=public.runner_submission_context(h,app);rev:=(ctx#>>'{application,revision}')::integer;
 authz:=jsonb_set(authz,'{revision}',to_jsonb(rev));
 result:=public.runner_submission_transition(h,'claim',jsonb_build_object('applicationId',app,'attemptId','positive-human'),ctx,authz);
 claim:=(result#>>'{attempt,id}')::uuid;
 perform public.runner_submission_transition(h,'start',jsonb_build_object('applicationId',app,'claimId',claim),ctx,authz);
 perform public.runner_submission_transition(h,'finish',jsonb_build_object('applicationId',app,'claimId',claim,'outcome','uncertain'));
 rev:=(select revision from public.applications where id=app);
 execute 'set local role authenticated';
 perform public.set_application_stage(app,rev,'Submitted','Checked employer portal and saw my application');
 execute 'reset role';
 if exists(select 1 from public.action_inbox where application_id=app and resolved_at is null) then raise exception 'Human positive report left pending action';end if;
 if not exists(select 1 from public.action_inbox where application_id=app and attempt_id=claim and resolution='user_reported_submitted') then raise exception 'Positive reporting provenance lost';end if;
 if (select state from public.submission_attempts where id=claim)<>'uncertain' or (select receipt from public.applications where id=app) is not null then raise exception 'Human report forged observed evidence';end if;
 perform private.sync_application_inbox(app);
 if exists(select 1 from public.action_inbox where application_id=app and resolved_at is null) then raise exception 'Resolved positive report reopened';end if;
 begin perform public.runner_submission_transition(h,'claim',jsonb_build_object('applicationId',app,'attemptId','duplicate-positive'),public.runner_submission_context(h,app),authz);raise exception 'Positive reporting allowed retry';exception when invalid_parameter_value or insufficient_privilege then null;end;
 update private.agent_connections set revoked_at=now() where token_hash=h;
 begin perform public.agent_dispatch(h,'applications.inbox.read','{}');raise exception 'Revocation bypass';exception when invalid_authorization_specification then null;end;
 if has_function_privilege('authenticated','private.sync_application_inbox(uuid)','execute') then raise exception 'Direct reconciliation exposed';end if;
end $$;
rollback;
