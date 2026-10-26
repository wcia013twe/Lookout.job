// Validate only the configured local Docker database; never accepts a remote URL.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir } from 'node:fs/promises';

const exec = promisify(execFile);
const root = new URL('../../', import.meta.url);
const config = await readFile(new URL('supabase/config.toml', root), 'utf8');
const projectId = config.match(/^project_id\s*=\s*"([A-Za-z0-9_-]+)"/m)?.[1];
assert.ok(projectId, 'supabase/config.toml must declare a local project_id');
const container = `supabase_db_${projectId}`;
const run = async (args) => (await exec('docker', args, { maxBuffer: 4 * 1024 * 1024 })).stdout.trim();
const details = JSON.parse(await run(['inspect', container]))[0];
assert.equal(details.Config.Labels['com.supabase.cli.project'], projectId, 'Expected a Supabase CLI local container');
assert.equal(details.State.Running, true, 'Local database must be running');

const migrationDir = new URL('supabase/migrations/', root);
const files = (await readdir(migrationDir)).filter(name => name.endsWith('.sql')).sort();
assert.ok(files.length, 'No canonical migrations found');
const versions = files.map(name => {
  assert.match(name, /^\d{14}_[A-Za-z0-9_]+\.sql$/, `Unexpected migration name: ${name}`);
  return name.slice(0, 14);
});
assert.equal(new Set(versions).size, versions.length, 'Migration timestamps must be unique');
const sources = await Promise.all(files.map(name => readFile(new URL(name, migrationDir), 'utf8')));
// Inventory comes directly from the canonical chain, never a second schema dump.
const tables = [...new Set(sources.flatMap(sql => [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?((?:public|private)\.\w+)/gi)].map(match => match[1])))].sort();
assert.ok(tables.length, 'No application tables found in migrations');
const sql = `begin read only;
select json_build_object(
  'readOnly', current_setting('transaction_read_only'),
  'migrations', (select coalesce(json_agg(version order by version), '[]') from supabase_migrations.schema_migrations),
  'tables', (select coalesce(json_agg(json_build_object('name', n.nspname || '.' || c.relname, 'rls', c.relrowsecurity) order by n.nspname,c.relname), '[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind in ('r','p')),
  'buckets', (select json_agg(json_build_object('id',id,'public',public) order by id) from storage.buckets where id in ('resumes','company-logos')),
  'rpcGrants', (select json_agg(json_build_object('name',p.oid::regprocedure::text,'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service',has_function_privilege('service_role',p.oid,'EXECUTE')) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('agent_dispatch','manage_agent_connection','agent_outreach_dispatch','runner_submission_context','runner_submission_transition','workspace_reset_service'))
); rollback;`;
const raw = await run(['exec', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-c', sql]);
const result = JSON.parse(raw);
assert.equal(result.readOnly, 'on');
assert.deepEqual(result.migrations, versions, 'Local migration history differs from canonical migration files');
const actualTables = new Map(result.tables.map(table => [table.name, table]));
for (const name of tables) {
  assert.ok(actualTables.has(name), `Missing migrated table: ${name}`);
  assert.equal(actualTables.get(name).rls, true, `RLS disabled: ${name}`);
}
assert.equal(result.buckets.find(bucket => bucket.id === 'resumes')?.public, false, 'Resume bucket must be private');
assert.equal(result.buckets.find(bucket => bucket.id === 'company-logos')?.public, true, 'Company logo bucket must be public');
const expectedRpcs = ['agent_dispatch','manage_agent_connection','agent_outreach_dispatch','runner_submission_context','runner_submission_transition','workspace_reset_service'];
for (const name of expectedRpcs) {
  const grants = result.rpcGrants.filter(rpc => rpc.name.split('(')[0] === name || rpc.name.split('(')[0] === `public.${name}`);
  assert.ok(grants.length, `Missing gateway RPC: ${name}`);
  for (const rpc of grants) {
    assert.equal(rpc.anon, false, `Anonymous execution exposed: ${rpc.name}`);
    assert.equal(rpc.authenticated, false, `Browser execution exposed: ${rpc.name}`);
    assert.equal(rpc.service, true, `Service role cannot execute: ${rpc.name}`);
  }
}
console.log(`Local schema verified: ${files.length} migrations, ${tables.length} application tables with RLS, private resume/public logo buckets, ${result.rpcGrants.length} service-only gateway RPCs.`);
console.log(`Database container: ${container}; all checks ran in a read-only transaction.`);
