-- Generic browser sync preserves independently versioned profile and quiet settings.
begin;
create or replace function private.save_preferences_authenticated(search_next jsonb, lists_next jsonb, active_next text, theme_next jsonb)
returns public.preferences language plpgsql security definer set search_path='' as $$
declare p public.preferences; next_search jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if jsonb_typeof(search_next) is distinct from 'object' or jsonb_typeof(lists_next) is distinct from 'array' or jsonb_typeof(theme_next) is distinct from 'object'
  or octet_length(search_next::text)>100000 or octet_length(lists_next::text)>1000000 or octet_length(theme_next::text)>10000
 then raise exception 'Invalid preferences' using errcode='22023'; end if;
 -- Create missing row before locking so simultaneous first saves serialize.
 insert into public.preferences(user_id) values(auth.uid()) on conflict(user_id) do nothing;
 select * into p from public.preferences where user_id=auth.uid() for update;
 next_search:=search_next-'quietMode'-'profiles';
 if p.search ? 'profiles' then next_search:=next_search||jsonb_build_object('profiles',p.search->'profiles'); end if;
 if p.search ? 'quietMode' then next_search:=next_search||jsonb_build_object('quietMode',p.search->'quietMode'); end if;
 update public.preferences set search=next_search,tier_lists=lists_next,active_tier_list_id=active_next,theme=theme_next,updated_at=now()
 where user_id=auth.uid() returning * into p;
 return p;
end $$;
commit;
