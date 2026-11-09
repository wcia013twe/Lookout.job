import importlib.util,json,tempfile,unittest
from pathlib import Path
from services import Services
from bridge import clean,actor
from audit import audit,clock_alignment,host_observations

class ServicesTest(unittest.TestCase):
 def test_due_timezone_replay_and_cancel(self):
  with tempfile.TemporaryDirectory() as tmp:
   s=Services(Path(tmp)/'state.sqlite');a=s.schedule('followup','A','2026-11-18T14:00:00Z','America/New_York')
   self.assertTrue(s.schedule('followup','A',a['dueAt'],a['timeZone'])['duplicate'])
   self.assertEqual(s.deliver('2026-11-18T13:59:59Z'),[])
   self.assertEqual(len(s.deliver('2026-11-18T14:00:00Z')),1)
   self.assertEqual(Services(s.file).deliver('2026-11-18T14:00:00Z'),[])
   b=s.schedule('other','B',a['dueAt'],a['timeZone']);s.cancel(b['reminderId']);self.assertEqual(s.deliver(a['dueAt']),[])
   with self.assertRaises(ValueError):s.schedule('followup','C',a['dueAt'],a['timeZone'])
 def test_interruption_persists_fields_and_fires_once(self):
  with tempfile.TemporaryDirectory() as tmp:
   s=Services(Path(tmp)/'state.sqlite');s.seed({'B':{'preparation':{'completedFields':['name','email'],'pendingField':'earliest-start-date'}}});s.arm('B','timeout-1')
   result=s.preview('B');self.assertEqual(result['status'],'preview_timeout');self.assertEqual(set(result['savedFields']),{'name','email'})
   result=Services(s.file).preview('B',{'earliest-start-date':'2027-01-19'});self.assertEqual(result['status'],'prepared');self.assertFalse(result['submitted'])
   self.assertEqual(s.snapshot()['previews'][0]['failures'],1)
   with self.assertRaises(ValueError):s.arm('B','timeout-1')
 def test_native_clean_keeps_startup_and_filters_only_scope(self):
  source={'instructions':['Keep native behavior.'],'tools':[{'name':'read_guide','inputSchema':{}},{'name':'forbidden','inputSchema':{}}]}
  result=clean(source,{'read_guide'});self.assertEqual(result['instructions'],source['instructions']);self.assertEqual([x['name'] for x in result['tools']],['read_guide'])
 def test_actor_has_no_future_facts(self):
  self.assertNotIn('January',actor('Birch start date?',[])[0]);self.assertIn('January',actor('Birch start date?',['multi_update'])[0]);self.assertNotIn('migration',actor('What was my feedback?',[])[0])

 def test_session_reports_monotonic_elapsed_and_keeps_wall_jump(self):
  from unittest.mock import patch,MagicMock
  import host
  runtime=host.runtime
  session=runtime.Session.__new__(runtime.Session);session.name='fictional-test';session.condition='baseline';session.bridge=None;session.thread_id=None;session.auth={'tokens':{}}
  proc=MagicMock();proc.stdout=[];proc.wait.return_value=0;proc.poll.return_value=0
  with tempfile.TemporaryDirectory() as tmp:
   stage=Path(tmp)/'stage-1';stage.mkdir()
   fake_clock=MagicMock();fake_clock.startWall=100;fake_clock.finish.return_value={'wallSeconds':600,'monotonicSeconds':3,'valid':False,'invalidReasons':['wall_monotonic_divergence']}
   with patch.object(runtime,'inputs_prompt',create=True,return_value='fictional prompt'),patch.object(runtime.subprocess,'Popen',return_value=proc),patch.object(runtime.threading,'Timer'),patch.object(runtime.cost,'capture',return_value={'error':'unavailable'}),patch.object(runtime,'StageClock',return_value=fake_clock):
    result=session.turn(stage,{'_index':1,'_session':1,'seconds':300})
   self.assertIsNone(result['executionSeconds']);self.assertEqual(result['durationSeconds'],600)
   self.assertEqual(result['timing']['monotonicSeconds'],3);self.assertEqual(result['status'],'artifact_failed')
   self.assertTrue(result['environmentTimingConfounded']);self.assertEqual(result['cost']['status'],'unknown')


 def test_native_clock_gate_rejects_compressed_future_dates(self):
  now='2026-11-09T14:00:00Z'
  spec={'stages':[{'id':'one','at':now},{'id':'two','at':'2026-11-16T14:00:00Z'}]}
  self.assertFalse(clock_alignment(spec,now)['aligned'])
  self.assertTrue(clock_alignment({'stages':[spec['stages'][0]]},now)['aligned'])
  relative={'epoch':now,'stages':[{'id':'one','minute':0},{'id':'two','minute':1440}]}
  self.assertFalse(clock_alignment(relative,now)['aligned'])
  with self.assertRaises(ValueError):clock_alignment(spec,'2026-11-09T14:00:00')

 def test_timeout_observations_preserve_external_failure_and_overrun(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);stage=root/'host-runs/lookout/stage-10';stage.mkdir(parents=True)
   (stage/'stage-run.json').write_text(json.dumps({'status':'timed_out','session':3,'resumed':False,'startedAt':100,'budgetSeconds':300,'durationSeconds':588}))
   (stage/'stderr.log').write_text('failed to lookup address information: Name does not resolve')
   (stage/'trace.jsonl').write_text(json.dumps({'capturedAt':421,'event':{'type':'item.completed'}})+'\n')
   result=host_observations(root,'lookout',[{'stage':'debrief'}])[0]
   self.assertTrue(result['wallBudgetExceeded']);self.assertTrue(result['modelEndpointDnsFailure'])
   self.assertEqual(result['eventsAfterWallDeadline'],1);self.assertFalse(result['terminalTurnEvent'])

 def test_audit_detects_intent_mismatch_without_inventing_quality(self):
  import hashlib
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp)
   def save(relative,value):
    p=root/relative;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(value));return p
   save('suite/scenario.json',{'version':'fixture','stages':[{'id':'initial'},{'id':'failed'}]});save('configuration.json',{'benchmarkTaskId':'JOB03'})
   for relative in ['background/onboarding.md','context-parity.json','host-initial.json']:save(relative,{})
   for c in ['baseline','lookout']:
    save(f'runs/{c}/run.json',{'status':'completed','checkpoints':[{'stage':'initial','status':'completed','executionSeconds':1},{'stage':'failed','status':'timed_out','executionSeconds':7}]})
    files=[save(f'runs/{c}/initial/input.json',{'input':{'message':'same request' if c=='baseline' else 'different request'}}),save(f'runs/{c}/initial/response.json',{'executionSeconds':1,'containerStartupSeconds':2}),save(f'runs/{c}/terminal-confirmation.json',{'status':'confirmed','files':{}})]
    save(f'runs/{c}/failed/input.json',{'input':{'message':'same'}})
    save(f'runs/{c}/evidence-hashes.json',{str(p.relative_to(root/'runs'/c)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files})
   result=audit(root);self.assertFalse(result['pairedIntentEvidenceMatch']);self.assertIsNone(result['qualityPass']);self.assertFalse(result['measuredComparisonReady']);self.assertEqual(result['conditions']['baseline']['participantTurnSeconds'],8);self.assertEqual(result['conditions']['baseline']['missingResponseStages'],['failed'])

if __name__=='__main__':unittest.main()
