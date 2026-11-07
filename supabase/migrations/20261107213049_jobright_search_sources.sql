begin;
alter function private.default_search_portals() rename to default_search_portals_before_jobright;
create function private.default_search_portals() returns jsonb
language sql stable set search_path = '' as $function$
 select jsonb_set(p,'{tracked_companies}',
  (select jsonb_agg(value order by ord) from jsonb_array_elements(p->'tracked_companies') with ordinality t(value,ord) where ord<=4)
  || '[{"id": "jobright-newgrad", "name": "Jobright new-grad", "kind": "board", "careers_url": "https://github.com/jobright-ai/2026-Software-Engineer-New-Grad", "enabled": true}, {"id": "jobright-internship", "name": "Jobright internships", "kind": "board", "careers_url": "https://github.com/jobright-ai/2026-Software-Engineer-Internship", "enabled": true}]'::jsonb
  || (select jsonb_agg(value order by ord) from jsonb_array_elements(p->'tracked_companies') with ordinality t(value,ord) where ord>4))
 from private.default_search_portals_before_jobright() p;
$function$;
revoke all on function private.default_search_portals() from public,anon,authenticated;
commit;
