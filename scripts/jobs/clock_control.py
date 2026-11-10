"""Owned fixture clock control. No participant tools or task-state reads."""
import datetime,json,secrets,subprocess,time
from pathlib import Path
import isolated_backend as backend
import isolated_clock_database as database

def observe(root):
 root,m=backend.inspect(root)
 sql=json.loads(database.sql(root,"select json_build_object('now',now());"))['now']
 code="Promise.all([fetch('http://edge:9000',{signal:AbortSignal.timeout(10000)}),fetch('http://127.0.0.1:8080/healthz',{signal:AbortSignal.timeout(10000)})]).then(([r,n])=>console.log(JSON.stringify({status:r.status,now:r.headers.get('x-job-fixture-now'),nodeStatus:n.status,nodeNow:n.headers.get('x-job-fixture-node-now')}))).catch(()=>process.exit(1))"
 edge=json.loads(database.call(['docker','exec',m['services']['api']['name'],'node','-e',code],timeout=15).stdout)
 if edge['status']!=405 or not edge['now'] or edge.get('nodeStatus')!=200 or not edge.get('nodeNow'):raise ValueError('Native Edge clock observation unavailable')
 stamp=lambda x:datetime.datetime.fromisoformat(x.replace('Z','+00:00')).timestamp()
 if max(abs(stamp(edge['now'])-stamp(sql)),abs(stamp(edge['nodeNow'])-stamp(sql)))>5:raise ValueError('SQL/JavaScript fixture clocks differ')
 return {'sqlNow':sql,'javascriptNow':edge['now'],'nodeApiNow':edge['nodeNow'],'aligned':True,'clockMode':'ticking_isolated_backend','nativeTaskReads':0,'participantExecuted':False}

def move(root,at):
 database.advance(root,at);result=observe(root)
 target=datetime.datetime.fromisoformat(at.replace('Z','+00:00')).timestamp()
 actual=datetime.datetime.fromisoformat(result['javascriptNow'].replace('Z','+00:00')).timestamp()
 if not 0<=actual-target<10:raise ValueError('Native clock not aligned to stage')
 result['requestedAt']=at
 return result

def restore_preflight(root,pilot_root,at):
 # Explicit fixture restoration is allowed only before any participant attempt.
 pilot_root=Path(pilot_root)
 if (pilot_root/'runs').exists() or (pilot_root/'host-runs').exists():raise ValueError('Never restore a clock after participant setup/attempt')
 root,m=backend.inspect(root)
 binding=json.loads((root/'pilot-binding.json').read_text())
 if Path(binding['pilotRoot']).resolve()!=pilot_root.resolve():raise ValueError('Wrong pilot clock binding')
 target=datetime.datetime.fromisoformat(at.replace('Z','+00:00'))
 if target.tzinfo is None:raise ValueError('Explicit offset required')
 offset=target.timestamp()-time.time();p=root/'clock/time.rc';tmp=p.with_name('restore-'+secrets.token_hex(4));tmp.write_text(f'{offset:+.6f}\n');tmp.chmod(0o644);tmp.replace(p)
 database.save(root/'clock-state.json',{'lastBusinessTarget':target.isoformat(),'offsetSeconds':offset})
 receipt=observe(root);receipt.update(requestedAt=at,preflightFixtureRestore=True,pilotRoot=str(pilot_root),participantExecuted=False)
 database.save(root/('preflight-clock-restore-'+str(time.time_ns())+'.json'),receipt)
 return receipt
