// Validate the complete reset in one rolled-back transaction before any participant starts.
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildResetSQL} from './reset.mjs';
const root=path.resolve(process.argv[2]);
const read=name=>JSON.parse(readFileSync(path.join(root,name),'utf8'));
const account=read('account.private.json'),initial=read('suite/initial-state.json');
let sql=buildResetSQL(account,initial);
if(!sql.endsWith('COMMIT;'))throw Error('Expected transactional reset');
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const checks=initial.applications.map(app=>`IF NOT EXISTS(SELECT 1 FROM public.applications WHERE user_id=${q(account.userId)}::uuid AND id=${q(app.id)}::uuid AND status='Submitted' AND receipt IS NULL) THEN RAISE EXCEPTION 'Seeded application mismatch'; END IF;`).join('\n');
const hash=createHash('sha256').update(account.token).digest('hex');
const app=initial.applications[0];
const milestone={applicationId:app.id,eventKey:'preflight-submitted-report',kind:'submitted',label:'Fictional user-reported application',phase:'completed',occurredAt:null,source:{kind:'user_reported',note:'Fictional candidate reports having applied; no employer receipt.'}};
const timelineProbe=`
 r:=public.agent_dispatch(${q(hash)},'applications.timeline',jsonb_build_object('applicationId',${q(app.id)}));
 IF r->'application'->>'user_id' IS DISTINCT FROM ${q(account.userId)} THEN RAISE EXCEPTION 'Timeline owner mismatch'; END IF;
 PERFORM public.agent_dispatch(${q(hash)},'applications.milestone',${q(JSON.stringify(milestone))}::jsonb);
 r:=public.agent_dispatch(${q(hash)},'applications.timeline',jsonb_build_object('applicationId',${q(app.id)}));
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'milestones') x WHERE x->>'event_key'='preflight-submitted-report' AND x->'source'->>'kind'='user_reported') THEN RAISE EXCEPTION 'Timeline readback mismatch'; END IF;
 ${checks}
`;
sql=sql.slice(0,-7)+`DO $probe$ DECLARE r jsonb; BEGIN ${checks} ${timelineProbe} END $probe$; ROLLBACK;`;
const result=spawnSync('docker',['exec','-i','supabase_db_lookout-local','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],{input:sql,encoding:'utf8',timeout:60000});
if(result.status!==0){console.error('COM03 reset probe failed; rolled back. '+(result.stderr||'').split('\n').filter(x=>x.startsWith('ERROR:')).join('\n'));process.exitCode=1;}
else console.log(JSON.stringify({resetProbe:true,timelineWriterReadback:true,rolledBack:true,applications:initial.applications.length}));
