// Validate the complete reset in one rolled-back transaction before any participant starts.
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {buildResetSQL} from './reset.mjs';
const root=path.resolve(process.argv[2]);
const read=name=>JSON.parse(readFileSync(path.join(root,name),'utf8'));
const account=read('account.private.json'),initial=read('suite/initial-state.json');
let sql=buildResetSQL(account,initial);
if(!sql.endsWith('COMMIT;'))throw Error('Expected transactional reset');
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const checks=initial.applications.map(app=>`IF NOT EXISTS(SELECT 1 FROM public.applications WHERE user_id=${q(account.userId)}::uuid AND id=${q(app.id)}::uuid AND status='Submitted' AND receipt IS NULL) THEN RAISE EXCEPTION 'Seeded application mismatch'; END IF;`).join('\n');
sql=sql.slice(0,-7)+`DO $probe$ BEGIN ${checks} END $probe$; ROLLBACK;`;
const result=spawnSync('docker',['exec','-i','supabase_db_lookout-local','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],{input:sql,encoding:'utf8',timeout:60000});
if(result.status!==0){console.error('COM03 reset probe failed; rolled back. '+(result.stderr||'').split('\n').filter(x=>x.startsWith('ERROR:')).join('\n'));process.exitCode=1;}
else console.log(JSON.stringify({resetProbe:true,rolledBack:true,applications:initial.applications.length}));
