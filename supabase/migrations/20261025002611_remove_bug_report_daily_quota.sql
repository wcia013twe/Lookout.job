-- Remove only the application daily quota. CREATE OR REPLACE preserves existing grants and receipts.
create or replace function public.bug_report_receipt(action text, args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.bug_report_receipts;
begin
  if args->>'fingerprint' is null or args->>'fingerprint' !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid fingerprint' using errcode='22023';
  end if;
  -- Keep existing serialization and deduplication; no daily reservation quota.
  perform pg_advisory_xact_lock(591372814);
  select * into r from private.bug_report_receipts where fingerprint=args->>'fingerprint' for update;
  if action='read' then return coalesce(to_jsonb(r),'{}'::jsonb);
  elsif action='reserve' then
    if r.issue_number is not null and r.issue_number=(args->>'closedIssue')::bigint then
      delete from private.bug_report_receipts where fingerprint=r.fingerprint;
      r:=null;
    end if;
    if r.fingerprint is not null then
      return jsonb_build_object('issue_number',r.issue_number);
    end if;
    insert into private.bug_report_receipts(fingerprint) values(args->>'fingerprint') returning * into r;
    return to_jsonb(r);
  elsif action='finish' then
    if r.claim_id is distinct from (args->>'claimId')::uuid or (args->>'issueNumber')::bigint is null then
      raise exception 'Invalid claim' using errcode='22023';
    end if;
    if r.issue_number is not null and r.issue_number<>(args->>'issueNumber')::bigint then
      raise exception 'Claim already completed' using errcode='40001';
    end if;
    update private.bug_report_receipts set issue_number=(args->>'issueNumber')::bigint where fingerprint=r.fingerprint returning * into r;
    return to_jsonb(r);
  end if;
  raise exception 'Unknown receipt action' using errcode='22023';
end;
$$;
