import { readFile, readdir } from "node:fs/promises";
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH || "@electric-sql/pglite");

export async function createTestDatabase({beforeMigration,migrationFiles,migrationDir=new URL("../../supabase/migrations/", import.meta.url)}={}) {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
      grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
      grant usage on schema storage to authenticated; grant all on storage.objects to authenticated;
      insert into auth.users values('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');`);
    for (const name of migrationFiles || (await readdir(migrationDir))
      .filter((name) => name.endsWith(".sql"))
      .sort())
      {
        if(beforeMigration)await beforeMigration(db,name);
        await db.exec(await readFile(new URL(name, migrationDir), "utf8"));
      }
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
