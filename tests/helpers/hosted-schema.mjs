// Source-derived schema comparison shared by fresh/upgrade checks. Platform Auth
// and Storage internals differ from test doubles and are verified separately.
// Definitions are generated from migrations, not maintained as a schema dump.
import {createTestDatabase} from './database.mjs';

// Match the observed platform defaults for objects created by postgres. These
// grants are absent in a bare Postgres/PGlite database and can hide privilege
// bugs unless upgrades are tested with the same defaults as hosted Supabase.
export const hostedDefaultPrivilegesSql = `
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
 alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
 alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
`;

export function createHostedTestDatabase(options={}) {
 let first=true;
 return createTestDatabase({...options,beforeMigration:async(db,name)=>{
  if(first){await db.exec(hostedDefaultPrivilegesSql);first=false;}
  await options.beforeMigration?.(db,name);
 }});
}

export const hostedSchemaSql = `
select kind, name, definition from (
 select 'column' as kind,n.nspname||'.'||c.relname||'.'||a.attname as name,
 concat_ws('|',regexp_replace(format_type(a.atttypid,a.atttypmod),'^(extensions[.]|public[.])?vector[(]','vector('),a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) as definition
 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
 left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
 where n.nspname in ('public','private','intelligence_demo') and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped
 union all
 select 'function',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
 pg_get_functiondef(p.oid)||'|execute:'||concat_ws(',',has_function_privilege('anon',p.oid,'execute'),has_function_privilege('authenticated',p.oid,'execute'),has_function_privilege('service_role',p.oid,'execute'))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private','intelligence_demo') and p.prokind='f' and p.proname<>'rls_auto_enable'
 union all
 select 'constraint',n.nspname||'.'||c.relname||'.'||con.conname,
 pg_get_constraintdef(con.oid)||'|'||con.convalidated||'|'||con.condeferrable||'|'||con.condeferred
 from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','private','intelligence_demo')
 union all
 select 'policy',schemaname||'.'||tablename||'.'||policyname,concat_ws('|',permissive,roles,cmd,qual,with_check)
 from pg_policies where schemaname in ('public','private','intelligence_demo','storage')
 union all
 select 'index',schemaname||'.'||indexname,indexdef from pg_indexes where schemaname in ('public','private','intelligence_demo')
 union all
 select 'rls',n.nspname||'.'||c.relname,concat_ws('|',c.relrowsecurity,c.relforcerowsecurity)
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','private','intelligence_demo') and c.relkind in ('r','p')
 union all
 select 'trigger',n.nspname||'.'||c.relname||'.'||t.tgname,pg_get_triggerdef(t.oid)||'|'||t.tgenabled::text
 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
 where not t.tgisinternal and n.nspname in ('public','private','intelligence_demo')
 union all
 select 'view',n.nspname||'.'||c.relname,pg_get_viewdef(c.oid,true)
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','private','intelligence_demo') and c.relkind='v'
 union all
 select 'table_grant',n.nspname||'.'||c.relname||':'||r.role_name||':'||p.privilege,
 has_table_privilege(r.role_name,c.oid,p.privilege)::text
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 cross join (values ('anon'),('authenticated'),('service_role')) r(role_name)
 cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege)
 where n.nspname in ('public','private','intelligence_demo') and c.relkind in ('r','p','v')
) inventory order by kind,name`;

export async function hostedSchemaInventory(db) {
 return (await db.query(hostedSchemaSql)).rows;
}
