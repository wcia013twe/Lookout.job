"""Provision an isolated PostgreSQL substrate for JOB simulated-clock work.

Never targets an existing container/database. This is preparation, not a ready
participant host: native HTTP and cross-runtime clock alignment remain required.
"""
import argparse,datetime,hashlib,json,secrets,subprocess,time
from pathlib import Path
REPO=Path(__file__).resolve().parents[2]
LABEL='lookout.job-clock-root'
IMAGE='public.ecr.aws/supabase/postgres:17.6.1.071'
BOOTSTRAP='''
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
grant usage on schema storage to authenticated;
grant all on storage.objects to authenticated;
create schema extensions;
'''
def call(argv,**kw):return subprocess.run(argv,check=True,capture_output=True,text=True,timeout=kw.pop('timeout',120),**kw)
def save(path,value):
 path.write_text(json.dumps(value,indent=2)+'\n');path.chmod(0o600)
def sha(value):return hashlib.sha256(value).hexdigest()
def load(root):
 root=Path(root).resolve();manifest=json.loads((root/'database.json').read_text())
 if manifest.get('root')!=str(root) or manifest.get('kind')!='isolated-job-clock-database-v1':raise ValueError('Wrong isolated database root')
 if not manifest['container'].startswith('job-clock-db-'):raise ValueError('Wrong container prefix')
 info=json.loads(call(['docker','inspect',manifest['container']]).stdout)[0]
 if info['Config'].get('Labels',{}).get(LABEL)!=str(root) or info['Id']!=manifest['containerId']:raise ValueError('Container owner/identity changed')
 if info['HostConfig']['NetworkMode']!='none' or info['HostConfig'].get('PortBindings'):raise ValueError('Clock database unexpectedly network-exposed')
 return root,manifest,info

def sql(root,text):
 _,m,_=load(root)
 return call(['docker','exec','-i',m['container'],'psql','-h','/tmp','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],input=text,timeout=180).stdout

def prepare(root,virtual_clock=False):
 root=Path(root).resolve()
 if root.exists():raise ValueError('New root required; preserve every earlier preparation')
 root.mkdir(parents=True,mode=0o700)
 suffix=secrets.token_hex(6);name='job-clock-db-'+suffix;volume=name+'-data';label=LABEL+'='+str(root)
 image_name='lookout-job-clock-postgres:0.1' if virtual_clock else IMAGE
 image=json.loads(call(['docker','image','inspect',image_name]).stdout)[0]
 migrations=sorted((REPO/'supabase/migrations').glob('*.sql'))
 manifest={'kind':'isolated-job-clock-database-v1','root':str(root),'container':name,'volume':volume,'image':image_name,'clockMode':'process_local_ticking_offset' if virtual_clock else 'real','imageId':image['Id'],'status':'provisioning','participantExecuted':False,'migrations':{p.name:sha(p.read_bytes()) for p in migrations},'bootstrapSha256':sha(BOOTSTRAP.encode()),'limitations':['No native HTTP endpoint or aligned virtual clock yet.','Minimal isolated Auth/Storage SQL bootstrap; no actual Supabase Auth/Storage server is claimed.']}
 save(root/'database.json',manifest)
 try:
  call(['docker','volume','create','--label',label,volume])
  call(['docker','run','--rm','--user','root','--network','none','--label',label,'--mount','type=volume,source='+volume+',target=/job-data','--entrypoint','sh',image['Id'],'-c','chown postgres:postgres /job-data'])
  clock_args=[]
  if virtual_clock:
   clock_dir=root/'clock';clock_dir.mkdir(mode=0o755);clock_dir.chmod(0o755)
   initial=datetime.datetime(2026,11,16,14,tzinfo=datetime.timezone.utc)
   offset=initial.timestamp()-time.time()
   (clock_dir/'time.rc').write_text(f'{offset:+.6f}\n');(clock_dir/'time.rc').chmod(0o644)
   save(root/'clock-state.json',{'lastBusinessTarget':initial.isoformat(),'offsetSeconds':offset})
   clock_args=['--mount','type=bind,source='+str(clock_dir)+',target=/job-clock,readonly','-e','LD_PRELOAD=/usr/local/lib/job-clock.so.1','-e','FAKETIME_TIMESTAMP_FILE=/job-clock/time.rc','-e','FAKETIME_NO_CACHE=1','-e','FAKETIME_DONT_FAKE_MONOTONIC=1','-e','TZ=UTC']
  command='if [ ! -f /job-data/data/PG_VERSION ]; then initdb -D /job-data/data -U postgres -A trust --no-locale >/tmp/initdb.log || exit 1; fi; exec postgres -D /job-data/data -c listen_addresses= -c unix_socket_directories=/tmp'
  ident=call(['docker','create','--name',name,'--label',label,'--network','none','--user','postgres','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','1g','--cpus','1','--mount','type=volume,source='+volume+',target=/job-data','--entrypoint','sh',*clock_args,image['Id'],'-c',command]).stdout.strip()
  manifest['containerId']=ident;save(root/'database.json',manifest);call(['docker','start',name])
  for _ in range(100):
   ready=subprocess.run(['docker','exec',name,'pg_isready','-h','/tmp','-U','postgres'],capture_output=True,timeout=5)
   if ready.returncode==0:break
   time.sleep(.1)
  else:raise RuntimeError('Isolated PostgreSQL did not become ready')
  sql(root,BOOTSTRAP)
  # Execute exact source migrations; no schema dump, clock rewrite or shared data.
  migration_sql='\n'.join(p.read_text() for p in migrations)
  sql(root,migration_sql)
  probe=json.loads(sql(root,"select json_build_object('serverVersion',current_setting('server_version'),'nativeNow',now(),'publicTables',(select count(*) from information_schema.tables where table_schema='public'),'authUsers',(select count(*) from auth.users),'privateFunctions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'));"))
  if probe['authUsers']!=0 or probe['publicTables']<20:raise ValueError('Unexpected initial isolated schema/data')
  manifest.update(status='migration_replay_verified',probe=probe,completedAt=datetime.datetime.now(datetime.timezone.utc).isoformat());save(root/'database.json',manifest)
  print(json.dumps({'root':str(root),'status':manifest['status'],'migrations':len(migrations),'participantExecuted':False,'nativeClockReady':False,'databaseVirtualClock':virtual_clock}))
 except Exception as error:
  manifest.update(status='setup_failed',errorType=type(error).__name__);save(root/'database.json',manifest)
  detail=getattr(error,'stderr','') or str(error);(root/'setup-error.private.log').write_text(detail);(root/'setup-error.private.log').chmod(0o600)
  raise RuntimeError('Isolated setup failed; private receipt retained') from None

def advance(root,at):
 root,m,_=load(root)
 if m.get('clockMode')!='process_local_ticking_offset':raise ValueError('This fixture has no isolated virtual clock')
 d=datetime.datetime.fromisoformat(at.replace('Z','+00:00'))
 if d.tzinfo is None:raise ValueError('Explicit offset required')
 target=d.astimezone(datetime.timezone.utc)
 p=root/'clock/time.rc';previous=datetime.datetime.fromisoformat(json.loads((root/'clock-state.json').read_text())['lastBusinessTarget'])
 if target<previous:raise ValueError('Clock cannot rewind; preserve prior state')
 offset=target.timestamp()-time.time()
 temp=p.with_name('time-'+secrets.token_hex(4)+'.tmp');temp.write_text(f'{offset:+.6f}\n');temp.chmod(0o644);temp.replace(p)
 save(root/'clock-state.json',{'lastBusinessTarget':target.isoformat(),'offsetSeconds':offset})
 result=json.loads(sql(root,"select json_build_object('now',now(),'currentDate',current_date,'clockTimestamp',clock_timestamp());"))
 actual=datetime.datetime.fromisoformat(result['now'])
 if not 0<=(actual-target).total_seconds()<5:raise ValueError('Native SQL clock did not follow isolated fixture')
 save(root/('clock-receipt-'+str(time.time_ns())+'.json'),{'requested':at,'nativeReadback':result,'sharedClockChanged':False})
 return result

def stop(root):
 root,m,info=load(root)
 if info['State']['Running']:call(['docker','stop','--time','10',m['container']])
 # Preserve container, volume, migration fingerprints and any partial state.
 save(root/('stop-'+str(time.time_ns())+'.json'),{'containerId':m['containerId'],'stopped':True,'dataPreserved':True})
 print(json.dumps({'stopped':True,'dataPreserved':True}))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('action',choices=['prepare','stop','inspect']);p.add_argument('--root',type=Path,required=True);p.add_argument('--virtual-clock',action='store_true');a=p.parse_args()
 if a.action=='prepare':prepare(a.root,a.virtual_clock)
 elif a.action=='stop':stop(a.root)
 else:
  _,m,info=load(a.root);print(json.dumps({'status':m['status'],'running':info['State']['Running'],'networkMode':info['HostConfig']['NetworkMode'],'participantExecuted':False}))
