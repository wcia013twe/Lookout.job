// Host-only owner snapshot. All required tables must exist; no silent missing telemetry.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
export function buildSnapshotSQL(a){
if(a.status!=='verified'||a.benchmarkTaskId!=='COM4'||a.apiUrl!=='http://127.0.0.1:54321'||!a.email?.endsWith('@example.test')||!/^[-a-f0-9]{36}$/.test(a.userId))throw Error('Dedicated local COM4 owner required');
const q=v=>"'"+String(v).replaceAll("'","''")+"'",uid=q(a.userId)+'::uuid';
const tables=['profiles','preferences','resumes','answer_library','outreach_contacts','applications','application_milestones','activity_events','approvals','career_artifacts','career_artifact_revisions','company_workspaces','agent_audit_runs','agent_audit_events'];
// Include revision history for owned artifacts; private contents remain local.
const selects=tables.map(t=>`'${t}',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM public.${t} x WHERE ${t==='career_artifact_revisions'?`x.artifact_id IN (SELECT id FROM public.career_artifacts WHERE user_id=${uid})`:`x.user_id=${uid}`})`);
const sql=`DO $guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=${uid} AND email=${q(a.email)} AND raw_app_meta_data->>'benchmarkTaskId'='COM4') THEN RAISE EXCEPTION 'COM4 owner mismatch'; END IF; END $guard$; SELECT jsonb_build_object('userId',${uid},'tables',jsonb_build_object(${selects.join(',')}));`;
return sql;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=path.dirname(fileURLToPath(import.meta.url));
 const a=JSON.parse(fs.readFileSync(path.join(root,'account.private.json'),'utf8'));
 const sql=buildSnapshotSQL(a);
const body=execFileSync('docker',['exec','-i','supabase_db_lookout-local','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-t','-A','-q'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:60000});
const snapshot=JSON.parse(body.trim());snapshot.capturedAt=new Date().toISOString();
fs.writeFileSync(process.argv[2],JSON.stringify(snapshot,null,2)+'\n',{mode:0o600});
console.log('COM4 owner state exported.');

}
