"""Exercise real local HTTP/subprocess transport without accounts or inference."""
import hashlib,http.client,importlib.util,json,os,subprocess,sys,tempfile,unittest,threading,time
from contextlib import suppress
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch
from workspace_transport import WorkspaceBridge

ROOT=Path(__file__).resolve().parents[2]
CASES=['n01','com2','com3','com4','job01','job02','jobs']

class TransportTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
  (self.root/'run/stage-1').mkdir(parents=True)
  self.script=self.root/'echo.py'
  self.script.write_text('import json,sys\nfrom pathlib import Path\nprint("fictional worker diagnostic",file=sys.stderr,flush=True)\nfor line in sys.stdin:\n m=json.loads(line);print(json.dumps({"id":m["id"],"args":sys.argv[1:]}),flush=True)\nPath(__file__).with_suffix(".closed").touch()\n')
  self.bridges=[]
 def tearDown(self):
  for bridge in self.bridges:
   bridge.close()
   for pipe in [bridge.proc.stdin,bridge.proc.stdout]:
    if pipe and not pipe.closed:
     with suppress(BrokenPipeError):pipe.close()
  self.tmp.cleanup()
 def request(self,bridge,message,key=None,path='/mcp'):
  conn=http.client.HTTPConnection('127.0.0.1',bridge.server.server_port,timeout=5)
  try:
   conn.request('POST',path,json.dumps(message),{'Authorization':'Bearer '+(key or bridge.key)})
   reply=conn.getresponse();return reply.status,reply.read()
  finally:conn.close()
 def start(self,**kwargs):
  bridge=WorkspaceBridge([sys.executable,str(self.script)],**kwargs);self.bridges.append(bridge);return bridge
 def test_case_arguments_and_concurrent_requests(self):
  real_popen=subprocess.Popen
  for case in CASES:
   with self.subTest(case=case):
    path=ROOT/'scripts'/case/'transport.py'
    spec=importlib.util.spec_from_file_location('case_'+case,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    commands=[]
    def launch(command,**kwargs):
     commands.append(command);return real_popen([command[0],str(self.script),*command[2:]],**kwargs)
    with patch('workspace_transport.subprocess.Popen',side_effect=launch):
     bridge=module.Bridge(self.root/'run/stage-1',self.root,'lookout')
    self.bridges.append(bridge)
    expected=['--root',str(self.root),'--capture',str(self.root/'run/stage-1/lookout-trace.jsonl'),'--condition','lookout']
    expected+=['--run',str(self.root/'run')] if case=='job02' else ['--inputs',str(self.root/'run/live-inputs')]
    self.assertEqual(commands[0],[sys.executable,str(path.with_name('bridge.py')),*expected])
    self.assertEqual(bridge.graceful_close,case=='job02')
    with ThreadPoolExecutor(max_workers=4) as pool:
     replies=list(pool.map(lambda i:self.request(bridge,{'id':i}),range(4)))
    self.assertEqual([(status,json.loads(body)['id']) for status,body in replies],[(200,i) for i in range(4)])
    if case=='jobs':
     self.assertTrue(bridge.server.daemon_threads)
     self.assertIn('fictional worker diagnostic',(self.root/'run/stage-1/bridge-stderr.log').read_text())
 def test_rejected_requests_never_reach_worker(self):
  bridge=self.start()
  self.assertEqual(self.request(bridge,{'id':1},key='wrong')[0],403)
  self.assertEqual(self.request(bridge,{'id':1},path='/other')[0],403)
  self.assertEqual(self.request(bridge,{'method':'notification'})[0],400)
  self.assertEqual(self.request(bridge,{'id':2})[0],200)
 def test_worker_exit_and_timeout_are_transport_failures(self):
  bridge=self.start();bridge.proc.kill();bridge.proc.wait()
  self.assertEqual(self.request(bridge,{'id':1})[0],502)
  bridge=self.start()
  with patch('workspace_transport.select.select',return_value=([],[],[])):
   self.assertEqual(self.request(bridge,{'id':2})[0],502)
  bridge.proc.wait(timeout=3)
 def test_new_communication_freezes_bind_shared_transport(self):
  shared=ROOT/'scripts/evals/workspace_transport.py'
  for case in ['n01','com2','com3','com4']:
   with self.subTest(case=case):
    source=self.root/case;source.mkdir();(source/'suite').mkdir()
    facts={'introduction':'Fictional candidate'};resume=b'%PDF fictional'
    settings={'profile':{'facts':facts},'preferences':{},'answers':[],'resumes':[{'id':'resume','content_hash':hashlib.sha256(resume).hexdigest()}]}
    files={'account.private.json':{'status':'verified','apiUrl':'http://127.0.0.1:54321','mcpUrl':'http://127.0.0.1:8080/mcp','email':'fictional@example.test','benchmarkTaskId':case.upper(),'userId':'00000000-0000-0000-0000-000000000001','idMapping':{}},'grader.private.json':{},'cloned-context.private.json':{'settings':settings},'source-manifest.private.json':{'settings':settings},'suite/initial-state.json':{'profileFacts':facts,'contacts':[]},'runtime-config.json':{}}
    if case=='n01':files['suite/initial-state.json']['contacts']=[{'id':'sam','record':{'contact':'Sam Reed','status':'Contacted','message':'Fictional prior message'}}]
    for name,value in files.items():(source/name).write_text(json.dumps(value))
    for name in ['snapshot.mjs','reset.mjs','account.lock']:(source/name).touch()
    (source/'profile.md').write_text('Fictional candidate');(source/'resume.pdf').write_bytes(resume)
    sys.path.insert(0,str(ROOT/'scripts'/case));sys.modules.pop('parity',None)
    spec=importlib.util.spec_from_file_location('prepare_'+case,ROOT/'scripts'/case/'prepare.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    with patch.object(module.subprocess,'run',return_value=subprocess.CompletedProcess([],0,stdout='sha256:fictional')):
     with patch.object(module,'capture_native_contract',return_value={},create=True):
      destination=source/'prepared';module.prepare(source,source,destination)
    if case=='n01':
     note=json.loads((destination/'suite/initial-state.json').read_text())['contacts'][0]['record']['notes']
     self.assertIn('unsent thank-you draft',note);self.assertIn(note,(destination/'background/onboarding.md').read_text())
    freeze=json.loads((destination/'freeze.json').read_text())
    if case in ['n01','com2']:
     self.assertEqual(freeze['files']['suite/grading-contract.md'],hashlib.sha256((destination/'suite/grading-contract.md').read_bytes()).hexdigest())
    self.assertEqual(freeze['files'][os.path.relpath(shared,destination.resolve())],hashlib.sha256(shared.read_bytes()).hexdigest())
 def test_close_stops_worker_before_joining_inflight_response(self):
  # A partial line leaves the HTTP handler blocked in the worker stdout reader.
  self.script.write_text('import sys\nfrom pathlib import Path\nsys.stdin.readline()\nsys.stdout.write("{");sys.stdout.flush()\nPath(__file__).with_suffix(".ready").touch()\nsys.stdin.read()\n')
  for graceful in [False,True]:
   with self.subTest(graceful=graceful):
    marker=self.script.with_suffix('.ready');marker.unlink(missing_ok=True)
    bridge=self.start(graceful_close=graceful)
    with ThreadPoolExecutor(max_workers=1) as pool:
     response=pool.submit(self.request,bridge,{'id':1})
     deadline=time.monotonic()+3
     while not marker.exists() and time.monotonic()<deadline:time.sleep(.01)
     self.assertTrue(marker.exists(),'Fictional worker did not enter partial response')
     closer=threading.Thread(target=bridge.close);closer.start();closer.join(2)
     blocked=closer.is_alive()
     if blocked:bridge.proc.kill();bridge.proc.wait();closer.join(3)
     self.assertFalse(blocked,'Bridge joined an HTTP thread before stopping its worker')
     self.assertEqual(response.result(timeout=3)[0],200)
    self.bridges.remove(bridge)
    for pipe in [bridge.proc.stdin,bridge.proc.stdout]:
     if pipe and not pipe.closed:pipe.close()
 def test_job02_graceful_close_delivers_eof(self):
  bridge=self.start(graceful_close=True);bridge.close();self.bridges.remove(bridge)
  self.assertEqual(bridge.proc.returncode,0)
  self.assertTrue(self.script.with_suffix('.closed').exists())
  bridge.proc.stdout.close()

if __name__=='__main__':unittest.main()
