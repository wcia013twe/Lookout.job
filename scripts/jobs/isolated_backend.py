"""Isolated native HTTP stack for JOB clock verification; no participant inference."""
import argparse,base64,datetime,hashlib,hmac,json,secrets,subprocess,time,urllib.request,uuid
from pathlib import Path
import isolated_clock_database as database
REPO=Path(__file__).resolve().parents[2]
IMAGES={'rest':'public.ecr.aws/supabase/postgrest:v14.3','edge':'public.ecr.aws/supabase/edge-runtime:v1.70.0','api':'lookout-node:communication-repairs-156','proxy':'lookout-node:communication-repairs-156'}
def jwt(secret):
 b=lambda x:base64.urlsafe_b64encode(json.dumps(x,separators=(',',':')).encode()).decode().rstrip('=')
 message=b({'alg':'HS256','typ':'JWT'})+'.'+b({'role':'service_role','iss':'isolated-job-clock','exp':4102444800})
 return message+'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),message.encode(),hashlib.sha256).digest()).decode().rstrip('=')
def envfile(path,values):
 path.write_text(''.join(k+'='+str(v)+'\n' for k,v in values.items()));path.chmod(0o600)
def save(root,value):database.save(root/'backend.json',value)
def module_payload_fingerprint(container):
 command="set -e; test -d /root/.cache/deno/npm; find /root/.cache/deno/npm -type f -exec sha256sum {} \\; | LC_ALL=C sort | sha256sum"
 digest=database.call(['docker','exec',container,'sh','-c',command],timeout=30).stdout.split()[0]
 if len(digest)!=64 or any(c not in '0123456789abcdef' for c in digest):raise ValueError('Native module payload fingerprint unavailable')
 return digest

def inspect(root,verify_payload=True):
 root=Path(root).resolve();_,db,_=database.load(root);m=json.loads((root/'backend.json').read_text())
 if m.get('root')!=str(root) or m.get('kind')!='isolated-job-clock-http-v1':raise ValueError('Wrong native fixture root')
 if m.get('ingressNetwork'):
  ingress=json.loads(database.call(['docker','network','inspect',m['ingressNetwork']]).stdout)[0]
  if not m['ingressNetwork'].startswith('job-clock-ingress-') or ingress.get('Labels',{}).get(database.LABEL)!=str(root):raise ValueError('Wrong fixture ingress')
 for role,item in m['services'].items():
  info=json.loads(database.call(['docker','inspect',item['name']]).stdout)[0]
  if info['Id']!=item['id'] or info['Image']!=item['imageId'] or info['Config'].get('Labels',{}).get(database.LABEL)!=str(root):raise ValueError('Native service identity changed')
  networks=set(info['NetworkSettings']['Networks'])
  allowed={db['network']}
  if role=='api':allowed.add(m.get('ingressNetwork',db['network']))
  if role=='edge' and m['status'] in ['provisioning','setup_failed']:allowed.add(m.get('ingressNetwork','bridge'))
  if not networks<=allowed:raise ValueError('Native service left isolated network')
 if verify_payload and m.get('edgeModulePayloadSha256') and m['status'] not in ['provisioning','setup_failed']:
  if module_payload_fingerprint(m['services']['edge']['name'])!=m['edgeModulePayloadSha256']:raise ValueError('Native module payload changed')
 return root,m

def prepare(root,initial_at):
 root=Path(root).resolve()
 database.prepare(root,virtual_clock=True,private_network=True,initial_at=initial_at)
 _,db,_=database.load(root)
 # PostgreSQL listens only on the private, internal network; no published DB port.
 database.sql(root,"select pg_reload_conf();")
 ingress=db['network'].replace('job-clock-net-','job-clock-ingress-')
 database.call(['docker','network','create','--label',database.LABEL+'='+str(root),ingress])
 secret=secrets.token_hex(32);key=jwt(secret)
 envfile(root/'rest.private.env',{'PGRST_DB_URI':f"postgresql://postgres@{db['container']}:5432/postgres",'PGRST_DB_SCHEMAS':'public','PGRST_DB_EXTRA_SEARCH_PATH':'public,extensions','PGRST_DB_ANON_ROLE':'anon','PGRST_JWT_SECRET':secret,'PGRST_SERVER_PORT':'3000','PGRST_LOG_LEVEL':'warn'})
 envfile(root/'edge.private.env',{'SUPABASE_URL':'http://kong:8000','SUPABASE_SERVICE_ROLE_KEY':key,'LOOKOUT_JOB_CLOCK_FIXTURE':'1','LOOKOUT_JOB_CLOCK_FILE':'/job-clock/time.rc'})
 envfile(root/'api.private.env',{'SUPABASE_URL':'http://kong:8000','SUPABASE_SERVICE_ROLE_KEY':key,'LOOKOUT_PROCESS':'api','PORT':'8080'})
 m={'kind':'isolated-job-clock-http-v1','root':str(root),'status':'provisioning','ingressNetwork':ingress,'services':{},'participantExecuted':False,'initialAt':initial_at,'sourceFiles':{},'limitations':['Native HTTP verification pending.','No real Auth/Storage service or external employer integration.']};save(root,m)
 def mount(source,target):return ['--mount',f'type=bind,source={source},target={target},readonly']
 common_source=mount(REPO/'supabase/functions','/app/supabase/functions')+mount(REPO/'lib','/app/lib')
 for directory in [REPO/'supabase/functions',REPO/'lib',REPO/'backend/runtime']:
  for p in sorted(directory.rglob('*')):
   if p.is_file() and p.suffix in ['.mjs','.js','.ts','.json','.py']:m['sourceFiles'][str(p.relative_to(REPO))]=database.sha(p.read_bytes())
 for relative in ['scripts/jobs/clock-edge/index.ts','scripts/jobs/clock_proxy.mjs','scripts/jobs/virtual_clock.mjs']:
  m['sourceFiles'][relative]=database.sha((REPO/relative).read_bytes())
 def create(role,args,command):
  name=db['container']+'-'+role;image=json.loads(database.call(['docker','image','inspect',IMAGES[role]]).stdout)[0]
  identity=database.call(['docker','create','--name',name,'--label',database.LABEL+'='+str(root),'--network',ingress if role=='api' else db['network'],'--network-alias',('kong' if role=='proxy' else role),'--memory','512m','--cpus','1','--cap-drop','ALL','--security-opt','no-new-privileges',*args,image['Id'],*command]).stdout.strip()
  m['services'][role]={'name':name,'id':identity,'image':IMAGES[role],'imageId':image['Id']};save(root,m)
  if role=='api':database.call(['docker','network','connect',db['network'],name])
  database.call(['docker','start',name]);return name
 try:
  create('rest',['--env-file',str(root/'rest.private.env')],[])
  create('proxy',mount(REPO/'scripts/jobs/clock_proxy.mjs','/app/clock_proxy.mjs'),['node','/app/clock_proxy.mjs'])
  edge=create('edge',['--env-file',str(root/'edge.private.env'),*common_source,*mount(REPO/'scripts/jobs','/app/scripts/jobs'),*mount(root/'clock','/job-clock')],['start','--main-service','/app/scripts/jobs/clock-edge'])
  # Download only pinned public module dependencies, then remove egress before readiness.
  database.call(['docker','network','connect',ingress,edge])
  api=create('api',['--env-file',str(root/'api.private.env'),*common_source,*mount(REPO/'backend/runtime','/app/backend/runtime'),'-p','127.0.0.1::8080'],['node','backend/runtime/main.ts'])
  info=json.loads(database.call(['docker','inspect',api]).stdout)[0];port=info['NetworkSettings']['Ports']['8080/tcp'][0]['HostPort'];url='http://127.0.0.1:'+port
  for _ in range(100):
   try:
    with urllib.request.urlopen(url+'/healthz',timeout=2) as response:healthy=json.load(response)
    if healthy.get('status')=='ok':break
   except Exception:time.sleep(.2)
  else:raise RuntimeError('Isolated Node API did not become ready')
  # Fictional connection, issued by the unchanged native owner-scoped function.
  owner=str(uuid.uuid4());token='jb_agent_'+secrets.token_hex(32);token_hash=hashlib.sha256(token.encode()).hexdigest()
  payload=json.dumps({'name':'Isolated HTTP readiness','tokenHash':token_hash,'expiresInDays':90,'scopes':['workspace:read','drafts:write','activity:write','tracking:write','answers:write']})
  q=lambda x:"'"+str(x).replace("'","''")+"'"
  database.sql(root,f"insert into auth.users(id,email,raw_app_meta_data) values({q(owner)},'job04-clock-http@example.test','{{\"benchmarkTaskId\":\"JOB04\"}}');insert into public.profiles(user_id,facts) values({q(owner)},'{{}}');insert into public.preferences(user_id) values({q(owner)});select public.manage_agent_connection({q(owner)},'connections.issue',{q(payload)}::jsonb);")
  def rpc(message):
   request=urllib.request.Request(url+'/mcp',data=json.dumps(message).encode(),headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':'Bearer '+token})
   with urllib.request.urlopen(request,timeout=90) as response:return json.load(response)
  startup=rpc({'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'clock-preflight','version':'1'}}})
  listed=rpc({'jsonrpc':'2.0','id':2,'method':'tools/list','params':{}})
  developer=rpc({'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'read_developer_context','arguments':{}}})
  database.save(root/'native-startup.json',{'initialize':startup,'tools':listed,'developer':developer})
  database.save(root/'backend.private.json',{'serviceRoleKey':key,'jwtSecret':secret,'ownerId':owner,'token':token})
  for response in [startup,listed,developer]:
   if response.get('error') or response.get('result',{}).get('isError'):raise ValueError('Actual native startup/gateway call failed')
  database.save(root/'native-startup.json',{'initialize':startup,'tools':listed,'developer':developer})
  database.call(['docker','network','disconnect',ingress,edge])
  m['edgeModulePayloadSha256']=module_payload_fingerprint(edge)
  m.update(status='http_started_unverified',mcpUrl=url+'/mcp',apiUrl=url);save(root,m)
  database.save(root/'backend.private.json',{'serviceRoleKey':key,'jwtSecret':secret,'ownerId':owner,'token':token})
  print(json.dumps({'nativeHttpStarted':True,'verified':False,'participantExecuted':False,'root':str(root)}))
 except Exception as error:
  m.update(status='setup_failed',errorType=type(error).__name__);save(root,m)
  log=root/'http-setup-error.private.log';log.write_text(getattr(error,'stderr','') or str(error));log.chmod(0o600)
  raise RuntimeError('Isolated HTTP setup failed; private evidence retained') from None

def stop(root):
 root,m=inspect(root,verify_payload=False)
 for item in reversed(list(m['services'].values())):database.call(['docker','stop','--time','10',item['name']])
 database.stop(root)
 database.save(root/('http-stop-'+str(time.time_ns())+'.json'),{'stopped':True,'dataPreserved':True,'participantExecuted':False})
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('action',choices=['prepare','stop','inspect']);p.add_argument('--root',type=Path,required=True);p.add_argument('--at',default='2026-11-09T14:00:00Z');a=p.parse_args()
 if a.action=='prepare':prepare(a.root,a.at)
 elif a.action=='stop':stop(a.root)
 else:
  _,m=inspect(a.root);print(json.dumps({'status':m['status'],'participantExecuted':False}))
