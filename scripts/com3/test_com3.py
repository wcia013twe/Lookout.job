import json,sys,tempfile,unittest,subprocess
from unittest.mock import patch
from pathlib import Path
import search,runner,capture,grade,user_actor
ROOT=Path(__file__).resolve().parents[2]
SPEC=json.loads((ROOT/'examples/com3/scenario.json').read_text())
CORPUS=json.loads((ROOT/'examples/com3/corpus.json').read_text())
class Contracts(unittest.TestCase):
 def test_fresh_owner_fixture_ids_and_references(self):
  from prepare import fixture_for_owner
  original=json.loads((ROOT/'examples/com3/fixture.json').read_text())
  a=fixture_for_owner(original,'00000000-0000-4000-8000-000000000001');b=fixture_for_owner(original,'00000000-0000-4000-8000-000000000002')
  self.assertNotEqual(a['application']['id'],b['application']['id'])
  self.assertNotEqual(a['sentinelApplication']['id'],b['sentinelApplication']['id'])
  self.assertEqual(a,fixture_for_owner(original,'00000000-0000-4000-8000-000000000001'))
  self.assertIn('application:'+a['application']['id'],a['contacts'][0]['record']['tags'])
  self.assertEqual(a['application']['draft'],original['application']['draft'])
 def test_native_timeline_not_filtered(self):
  import ast
  tree=ast.parse((ROOT/'scripts/com3/prepare.py').read_text())
  lists=[ast.literal_eval(k.value) for n in ast.walk(tree) if isinstance(n,ast.Call) for k in n.keywords if k.arg=='allowedTools']
  self.assertEqual(len(lists),1)
  self.assertTrue({'read_application_timeline','record_application_milestone'}<=set(lists[0]))
  self.assertNotIn('submit_application',lists[0])
  self.assertTrue(SPEC['policy']['nativeApplicationTimeline'])
 def test_host_failure_persists_stage_and_unblocks_reader(self):
  from runtime import stop_container_client
  real_popen=subprocess.Popen
  def local_process(*args,**kwargs):
   return real_popen([sys.executable,'-c','import time; time.sleep(60)'],**kwargs)
  def unavailable(*args,**kwargs):raise subprocess.TimeoutExpired('fictional Docker probe',10)
  with tempfile.TemporaryDirectory() as td:
   sd=Path(td)/'stage-1';sd.mkdir()
   session=runner.Session.__new__(runner.Session);session.name='fictional-container';session.condition='baseline';session.bridge=None;session.thread_id=None;session.auth={'tokens':{}}
   with patch.object(runner.subprocess,'Popen',side_effect=local_process),patch.object(runner,'inputs_prompt',return_value='fictional task'),patch.object(runner.cost,'capture',return_value={'error':'unavailable'}),patch.object(runner,'stop_container_client',side_effect=lambda proc,name:stop_container_client(proc,name,unavailable)):
    result=session.turn(sd,{'_index':1,'_session':'test','seconds':1})
   self.assertEqual(result['status'],'artifact_failed');self.assertTrue(result['hostControlFailed']);self.assertIsNone(result['executionSeconds'])
   self.assertIn('container_stop_unconfirmed',result['timing']['invalidReasons'])
   self.assertTrue(json.loads((sd/'termination.json').read_text())['hostClientStopped'])
   self.assertEqual(json.loads((sd/'stage-run.json').read_text())['status'],'artifact_failed')
 def test_cleanup_failure_still_closes_bridge(self):
  from unittest.mock import Mock
  session=runner.Session.__new__(runner.Session);session.name='fictional-container';bridge=Mock();session.bridge=bridge
  with patch.object(runner.subprocess,'run',side_effect=subprocess.TimeoutExpired('fictional Docker probe',10)):
   result=session.close()
  self.assertFalse(result['containerRemoved']);bridge.close.assert_called_once();self.assertIsNone(session.bridge)
 def test_pair_halts_without_grading_after_unconfirmed_termination(self):
  import runpy
  from types import SimpleNamespace
  from unittest.mock import Mock
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);runs=root/'runs';runs.mkdir()
   def write(path,value):path.write_text(json.dumps(value))
   def failed_run(*args):
    run=runs/'fictional-baseline';run.mkdir();write(run/'run.json',{'hostControlFailed':True,'status':'artifact_failed'});return run
   fake_runner=SimpleNamespace(RUNS=runs,configure=Mock(),run=Mock(side_effect=failed_run),write=write)
   fake_grade=SimpleNamespace(grade=Mock());fake_summary=SimpleNamespace(build=Mock())
   args=['orchestrate.py','--task-dir',str(root),'--pair-id','FICTIONAL','--repeat','1','--pilot','--langfuse-env',str(root/'absent.env'),'--receipt-dir',str(root/'receipts')]
   with patch.dict(sys.modules,{'runner':fake_runner,'grade':fake_grade,'summary':fake_summary}),patch.object(sys,'argv',args),self.assertRaises(SystemExit) as stopped:
    runpy.run_path(str(ROOT/'scripts/com3/orchestrate.py'),run_name='__main__')
   self.assertEqual(stopped.exception.code,1);fake_runner.run.assert_called_once_with('baseline',1,'FICTIONAL',True)
   fake_grade.grade.assert_not_called();fake_summary.build.assert_not_called()
   self.assertTrue(json.loads((root/'pair-halted.json').read_text())['remainingConditionNotStarted'])
   self.assertFalse(json.loads((runs/'fictional-baseline/grading-invalid.json').read_text())['scored'])
 def test_shape(self):
  self.assertEqual(len(SPEC['stages']),10);self.assertEqual(len({s['session'] for s in SPEC['stages']}),6)
 def test_future_sources_hidden(self):
  for d in CORPUS['documents']:
   if d['releasedVersion']>1:self.assertRaises(ValueError,search.read_source,CORPUS,1,d['id'])
 def test_source_urls_resolve(self):
  for d in CORPUS['documents']:self.assertEqual(search.read_source(CORPUS,4,d['url'])['id'],d['id'])
 def test_search_has_no_release_metadata(self):
  r=search.search(CORPUS,1,'Linden retrieval');self.assertTrue(r['results']);self.assertNotIn('releasedVersion',json.dumps(r))
 def test_search_invalid_limits(self):
  for n in [0,11,True]:self.assertRaises(ValueError,search.search,CORPUS,1,'Linden',n)
 def test_archive_and_collision(self):
  r=runner.released_sources(SPEC['stages']);self.assertEqual(len(r['inbox']),4)
  self.assertEqual(len(r['notificationHistory']),10)
  self.assertRaises(RuntimeError,runner.released_sources,[{'id':'a','inbox':[{'id':'x','body':'a'}]},{'id':'b','inbox':[{'id':'x','body':'b'}]}])
 def test_actor_no_early_sent_claim(self):
  self.assertIn('not reported',user_actor.answer('Did I send it?',1,SPEC)[0])
 def test_readonly_boundary(self):
  self.assertRaises(ValueError,capture.lookup,{'scopes':['workspace:read'],'token':'writer'},'read_personal_context',{})
  self.assertRaises(ValueError,capture.lookup,{'scopes':['workspace:read']},'save_contact',{})
 def test_missing_capture_fails(self):
  with tempfile.TemporaryDirectory() as t:self.assertRaises(ValueError,capture.validate,Path(t),{'episodeId':'x'})
 def test_missing_telemetry_fails(self):
  with tempfile.TemporaryDirectory() as t:
   p=Path(t);(p/'stage-1').mkdir()
   self.assertRaises(ValueError,grade.validate_evidence,p,SPEC,{'scenarioDigest':grade.scenario_digest(SPEC),'status':'completed'})
 def test_evidence_cannot_escape(self):
  with tempfile.TemporaryDirectory() as t:self.assertRaises(ValueError,grade.verify_refs,Path(t),{'reason':'x','evidence':['../../etc/passwd']})
if __name__=='__main__':unittest.main()
