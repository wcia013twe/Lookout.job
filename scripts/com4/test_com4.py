import json,tempfile,unittest,time,copy,sys,subprocess
from unittest.mock import patch
from pathlib import Path
import grade,runner,user_actor,terminal_state,summary
ROOT=Path(__file__).resolve().parents[2];SPEC=json.loads((ROOT/'examples/com4/scenario.json').read_text())
def save(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x)+'\n')
def fixture(run,condition='lookout',status='completed'):
 start=time.time()-100;profile={'user_id':'fixture-owner','facts':{'introduction':'fixture'}};snapshot={'userId':'fixture-owner','tables':{'profiles':[profile],'outreach_contacts':[]}}
 m={'version':SPEC['version'],'episodeId':run.name,'taskId':'COM4','pairId':'verification','condition':condition,'repeat':1,'pilot':True,'synthetic':True,'scenarioDigest':grade.scenario_digest(SPEC),'suiteHash':'fictional-verification','model':'fixture-no-model','reasoning':'none','status':status,'startedAt':start,'durationSeconds':70,'participantEndedAt':start+70};save(run/'run.json',m)
 save(run/'initial-state.json',snapshot);save(run/'final-state.json',snapshot);(run/'output').mkdir(exist_ok=True);(run/'output/final-report.md').write_text('fictional saved state report')
 for i,s in enumerate(SPEC['stages'],1):
  sd=run/f'stage-{i}';save(sd/'stage-run.json',{'status':'completed','durationSeconds':2,'startedAt':start+i*5,'threadId':s['session']});save(sd/'delivery.json',{'stage':i,'eventId':s['id'],'releasedMinute':s['minute'],'triggerMinute':s['minute'],'assignedInitiation':s['kind']=='external','assignedOnboarding':i==1,'necessaryUserUpdate':s['kind']=='user_update'});save(sd/'trace.jsonl',{'capturedAt':start+i*5+1,'event':{'type':'item.completed','item':{'id':'a','type':'agent_message','text':'Fictional fixture; no model ran.'}}});(sd/'lookout-trace.jsonl').write_text('');save(sd/'before-state.json',snapshot);save(sd/'after-state.json',snapshot);(sd/'prompt.txt').write_text('fictional');(sd/'output').mkdir(exist_ok=True);(sd/'output/final-report.md').write_text('fictional')
 save(run/'grader.private.json',{'status':'verified','mcpUrl':'http://127.0.0.1:8080/mcp','userId':'fixture-owner','scopes':['workspace:read'],'benchmarkTaskId':'COM4'})
 terminal_state.capture_terminal_state(run,run,m,lookup=lambda a,n:[] if n=='list_contacts' else {'settings':{'profile':profile}} if n=='read_personal_context' else {})
 review=grade.template(run,SPEC);review.update(reviewer='fixture-only',independentOfParticipant=True,interactionReviewComplete=True)
 for key,x in review['quality'].items():
  ids=list(range(1,13)) if key=='preservation' else [i for i,s in enumerate(SPEC['stages'],1) if key in s['checks']];x.update({'pass':True,'reason':'Synthetic fixture only','evidence':[f'stage-{i}/output/final-report.md' for i in ids]})
 for key in SPEC.get('durableChecks',[]):
  review['quality'][key]['evidence'] += [f'stage-{i}/after-state.json' for i,s in enumerate(SPEC['stages'],1) if key in s['checks']]
 for key in ['saved_state','report_accuracy']:review['quality'][key]['evidence']+=['terminal-state.json','stage-12/before-state.json']
 for key,x in review['adherence'].items():i=SPEC['adherence'][key]['stage'];x.update(outcomeVerified=True,reason='Fixture',evidence=[f'stage-{i}/after-state.json',f'stage-{i}/trace.jsonl'])
 return review
class ExecutionContainment(unittest.TestCase):
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
    runpy.run_path(str(ROOT/'scripts/com4/orchestrate.py'),run_name='__main__')
   self.assertEqual(stopped.exception.code,1);fake_runner.run.assert_called_once_with('baseline',1,'FICTIONAL',True)
   fake_grade.grade.assert_not_called();fake_summary.build.assert_not_called()
   self.assertTrue(json.loads((root/'pair-halted.json').read_text())['remainingConditionNotStarted'])
   self.assertFalse(json.loads((runs/'fictional-baseline/grading-invalid.json').read_text())['scored'])

class Tests(unittest.TestCase):
 def setUp(self):self.t=tempfile.TemporaryDirectory();self.run=Path(self.t.name)/'fixture';self.review=fixture(self.run)
 def tearDown(self):self.t.cleanup()
 def test_pending_not_pass(self):self.assertNotIn('quality_pass',grade.grade(self.run,SPEC)['metrics'])
 def test_complete_fixture(self):self.assertEqual(grade.grade(self.run,SPEC,self.review)['metrics']['quality_pass'],1)
 def test_missing_stage_invalid(self):(self.run/'stage-5/trace.jsonl').unlink();self.assertRaises(ValueError,grade.grade,self.run,SPEC)
 def test_report_alone_not_proof(self):self.review['quality']['report_accuracy']['evidence']=['stage-12/output/final-report.md'];self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_baseline_final_report_legitimate(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);r=fixture(p,'baseline');g=grade.grade(p,SPEC,r);self.assertEqual(g['metrics']['quality_pass'],1);self.assertNotIn('lookout_adherence_fraction',g['metrics'])
 def test_native_omissions_not_quality(self):g=grade.grade(self.run,SPEC,self.review);self.assertEqual(g['metrics']['lookout_adherence_fraction'],0);self.assertEqual(g['metrics']['quality_pass'],1)
 def test_snapshot_tamper_invalid(self):save(self.run/'final-state.json',{});self.assertRaises(ValueError,grade.grade,self.run,SPEC)
 def test_terminal_owner_invalid(self):p=self.run/'terminal-state.json';x=json.loads(p.read_text());x['ownerId']='other';save(p,x);self.assertRaises(ValueError,grade.grade,self.run,SPEC)
 def test_empty_contacts_do_not_prove_profile_owner(self):
  p=self.run/'terminal-state.json';x=json.loads(p.read_text());x['reads']['personal_context']['settings']['profile']['user_id']='other';save(p,x);self.assertRaises(ValueError,grade.grade,self.run,SPEC)
 def test_receipt_time_invalid(self):p=self.run/'terminal-state.json';x=json.loads(p.read_text());x['captureStartedAt']=0;save(p,x);self.assertRaises(ValueError,grade.grade,self.run,SPEC)
 def test_receipt_version_invalid(self):p=self.run/'terminal-state.json';x=json.loads(p.read_text());x['scenarioVersion']='other';save(p,x);self.assertRaises(ValueError,grade.grade,self.run,SPEC)
 def test_live_later_files_rejected(self):(self.run/'output/later.txt').write_text('later');self.assertRaises(ValueError,grade.grade,self.run,SPEC)
 def test_optional_read_failure_keeps_snapshot(self):
  (self.run/'terminal-state.json').unlink()
  def unavailable(a,n):raise RuntimeError('not available')
  m=json.loads((self.run/'run.json').read_text());x=terminal_state.capture_terminal_state(self.run,self.run,m,unavailable);self.assertEqual(x['source'],'post_terminal_snapshot');terminal_state.validate_terminal_state(self.run,m)
 def test_missing_capture_invalid(self):(self.run/'terminal-state.json').unlink();self.assertRaises(ValueError,grade.grade,self.run,SPEC)
 def test_actor_cannot_supply_future_availability(self):self.assertIn('not provided',user_actor.answer('What availability?',8,SPEC)[0]);self.assertIn('November 24',user_actor.answer('What availability?',9,SPEC)[0])
 def test_actor_never_send_permission(self):self.assertIn('Do not send',user_actor.answer('May I send this?',12,SPEC)[0])
 def test_prompt_date_and_no_future(self):
  for stage in SPEC['stages'][1:]:
   for c in ['lookout','baseline']:
    p=runner.inputs_prompt(stage,c);self.assertIn(stage['date'],p);self.assertNotIn('quality',p);self.assertNotIn('experiment',p)
 def test_same_final_request(self):
  for c in ['lookout','baseline']:self.assertIn(SPEC['stages'][-1]['request'],runner.inputs_prompt(SPEC['stages'][-1],c))
 def test_summary_contract(self):g=grade.grade(self.run,SPEC,self.review);self.assertEqual(summary.build(self.run,SPEC,g,'fixture')['scenarioId'],'COM4')
 def test_prior_checkpoint_not_erased(self):self.review['quality']['promise_tracking']['pass']=False;g=grade.grade(self.run,SPEC,self.review);self.assertTrue(g['quality']['saved_state']);self.assertEqual(g['metrics']['quality_pass'],0)
 def test_no_unreleased_questions(self):self.assertNotIn('November18',user_actor.answer('What was promised?',2,SPEC)[0])
 def test_durable_quality_rejects_trace_only(self):
  self.review['quality']['conditional_bio']['evidence']=['stage-2/trace.jsonl']
  self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_terminal_contact_tamper_rejected(self):
  p=self.run/'terminal-state.json';x=json.loads(p.read_text());x['reads']['contacts']=[{'id':'extra','user_id':'fixture-owner','record':{}}];save(p,x)
  self.assertRaises(ValueError,grade.grade,self.run,SPEC)
 def test_profile_renderer_keeps_nested_facts(self):
  from prepare import readable_facts
  text='\n'.join(readable_facts({'introduction':'initial priority','education':[{'degree':'MS','endDate':'2027'}]}))
  self.assertIn('initial priority',text);self.assertIn('MS',text);self.assertIn('2027',text)
if __name__=='__main__':unittest.main()

class RetainedInboxTests(unittest.TestCase):
 def test_released_archive_and_collision(self):
  import runner
  a={'id':'a','inbox':[{'id':'m','body':'hello'}]};b={'id':'b','inbox':a['inbox']}
  visible=runner.released_sources([a,b])
  self.assertEqual(len(visible['inbox']),1)
  self.assertEqual(len(visible['notificationHistory']),2)
  self.assertEqual(visible['currentNotifications']['eventId'],'b')
  self.assertEqual(runner.released_sources([a])['currentNotifications']['eventId'],'a')
  with self.assertRaises(RuntimeError):runner.released_sources([a,{'id':'c','inbox':[{'id':'m','body':'changed'}]}])
