-- Public branding only. No client write policies: maintenance uses server credentials.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('company-logos','company-logos',true,1048576,array['image/png'])
on conflict(id) do update set public=excluded.public,
  file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
