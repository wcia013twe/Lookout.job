"""Actual no-inference SQL/JavaScript clock proof; native HTTP remains unconnected."""
import json,sys,pathlib,uuid,hashlib,time,subprocess,os
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from isolated_clock_database import sql,advance,save
root=pathlib.Path(sys.argv[1]).resolve()
if (root/'source-native-clock-proof.json').exists():raise ValueError('Preserve existing proof')
if int(sql(root,'select count(*) from auth.users;').strip())!=0:raise ValueError('Fresh empty isolated fixture required')
owner=str(uuid.uuid4());artifact=str(uuid.uuid4());h=hashlib.sha256(uuid.uuid4().bytes).hexdigest()
def q(s):return "'"+str(s).replace("'","''")+"'"
issue={'name':'Isolated clock fixture','tokenHash':h,'expiresInDays':7,'scopes':['workspace:read','drafts:write']}
sql(root,f"insert into auth.users(id,email,raw_app_meta_data) values({q(owner)},'job04-clock-fixture@example.test','{{\"benchmarkTaskId\":\"JOB04\"}}');select public.manage_agent_connection({q(owner)},'connections.issue',{q(json.dumps(issue))}::jsonb);")
def dispatch(op,payload):return json.loads(sql(root,f"select public.agent_dispatch({q(h)},{q(op)},{q(json.dumps(payload))}::jsonb);"))
payload={'id':artifact,'expectedVersion':0,'title':'Fictional clock brief','purpose':'No-inference isolated clock probe','kind':'interview_brief','format':'markdown','body':'Fictional preparation only. No candidate evidence or external action.','preparedFor':'2026-11-17','sources':[],'links':[]}
saved=dispatch('artifacts.save',payload)
before=dispatch('artifacts.list',{'shelf':'prepared'})
start=time.monotonic();sql(root,'select pg_sleep(0.2);');elapsed=time.monotonic()-start
advance(root,'2026-11-18T14:00:00Z')
after=dispatch('artifacts.list',{'shelf':'prepared'})
back=dispatch('artifacts.list',{'shelf':'saved'})
def contains(v):return artifact in json.dumps(v)
assert contains(before) and not contains(after) and contains(back),(before,after,back)
assert .15<=elapsed<15,elapsed
try:advance(root,'2026-11-17T14:00:00Z')
except ValueError:rewind=True
else:raise AssertionError('Clock rewound')
result={'participantExecuted':False,'nativeMcpReady':False,'sourceSqlWriterAndShelfReadVerified':True,'preparedBeforeDatePasses':contains(before),'preparedAfterDatePasses':contains(after),'savedAfterDatePasses':contains(back),'realMonotonicSleepSeconds':elapsed,'rewindRejected':rewind,'sharedClockChanged':False,'limitations':['Native HTTP/MCP and JavaScript business-clock alignment remain unconnected.','No candidate profile or external Auth/Storage service was used.']}
save(root/'source-native-clock-proof.json',result)
print(json.dumps(result))

repo=pathlib.Path(__file__).resolve().parents[2]
env={**os.environ,'LOOKOUT_JOB_CLOCK_FIXTURE':'1','LOOKOUT_JOB_CLOCK_FILE':str(root/'clock/time.rc')}
result=subprocess.run(['node','--import',str(repo/'scripts/jobs/virtual_clock.mjs'),str(repo/'scripts/jobs/probe_clock_preparation.mjs'),str(root)],env=env,capture_output=True,text=True,timeout=30)
log=root/'javascript-probe.private.log';log.write_text(result.stdout+result.stderr);log.chmod(0o600)
if result.returncode:raise RuntimeError('JavaScript clock probe failed; private log retained')
print(result.stdout.strip())
