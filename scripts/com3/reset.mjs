// Reset only a dedicated, explicitly receipted local COM3 owner. Never executed by prepare/preflight.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
export function buildResetSQL(a,initial){
if(a.status!=='verified'||a.benchmarkTaskId!=='COM3'||a.apiUrl!=='http://127.0.0.1:54321'||!a.email?.endsWith('@example.test')||!/^[-a-f0-9]{36}$/.test(a.userId))throw Error('Dedicated local COM3 account required');
const q=v=>"'"+String(v).replaceAll("'","''")+"'",uid=q(a.userId)+'::uuid';
const ids=initial.applications.map(x=>q(x.id)+'::uuid').join(',');
let sql=`BEGIN; SELECT pg_advisory_xact_lock(hashtext(${q(a.userId)})); DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=${uid} AND email=${q(a.email)} AND raw_app_meta_data->>'benchmarkTaskId'='COM3') THEN RAISE EXCEPTION 'COM3 owner/assignment mismatch'; END IF; IF EXISTS(SELECT 1 FROM public.applications WHERE user_id=${uid} AND id NOT IN (${ids})) OR EXISTS(SELECT 1 FROM public.agent_audit_runs WHERE user_id=${uid}) OR EXISTS(SELECT 1 FROM public.agent_audit_events WHERE user_id=${uid}) THEN RAISE EXCEPTION 'Unexpected account activity; preserve for investigation'; END IF; END $guard$;\n`;
sql+=`DELETE FROM public.activity_events WHERE user_id=${uid}; DELETE FROM public.applications WHERE user_id=${uid}; DELETE FROM public.career_artifacts WHERE user_id=${uid}; DELETE FROM public.company_workspaces WHERE user_id=${uid}; DELETE FROM public.outreach_contacts WHERE user_id=${uid}; UPDATE public.profiles SET facts=${q(JSON.stringify(initial.profileFacts))}::jsonb WHERE user_id=${uid};\n`;
for(const c of initial.contacts)sql+=`INSERT INTO public.outreach_contacts(user_id,id,record,revision) VALUES(${uid},${q(c.id)},${q(JSON.stringify(c.record))}::jsonb,0);\n`;
for(const app of initial.applications){
 if(!/^[-a-f0-9]{36}$/.test(app.id)||app.receipt!==null||app.submissionSource!=='user_reported')throw Error('Invalid COM3 seed provenance');
 const employer={company:app.company,title:app.title,location:'United States',workspaceOwner:a.userId,roleKey:'COM3',role:app.role};
 sql+=`INSERT INTO public.jobs(id,canonical_url,employer,verified_at) VALUES(${q(app.jobId)},${q(app.url+'?workspace='+a.userId)},${q(JSON.stringify(employer))}::jsonb,NULL) ON CONFLICT(id) DO NOTHING; DO $job$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.jobs WHERE id=${q(app.jobId)} AND employer->>'workspaceOwner'=${q(a.userId)} AND employer->>'roleKey'='COM3') THEN RAISE EXCEPTION 'Fixture job collision'; END IF; END $job$;\n`;
 sql+=`INSERT INTO public.applications(id,user_id,job_id,status,revision,draft,submitted_at,receipt) VALUES(${q(app.id)}::uuid,${uid},${q(app.jobId)},'Submitted',0,${q(JSON.stringify(app.draft))}::jsonb,${q(app.submittedAt)}::timestamptz,NULL);\n`;
}
// The normal application insert trigger initializes preparation status; restore the explicit seeded user-reported progress.
for(const app of initial.applications)sql+=`UPDATE public.applications SET status='Submitted' WHERE user_id=${uid} AND id=${q(app.id)}::uuid;\n`;
sql+='COMMIT;';
return sql;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=path.dirname(fileURLToPath(import.meta.url));
 const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));
 const sql=buildResetSQL(read('account.private.json'),read('suite/initial-state.json'));
execFileSync('docker',['exec','-i','supabase_db_lookout-local','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-q'],{input:sql,stdio:['pipe','pipe','pipe'],timeout:60000});
console.log('Dedicated COM3 owner reset; no other account changed.');

}
