import json,tempfile,unittest,time,copy
from pathlib import Path
import grade,runner,user_actor,terminal_state,summary
ROOT=Path(__file__).resolve().parents[2];SPEC=json.loads((ROOT/'examples/com4/scenario.json').read_text())
def save(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x)+'\n')
def fixture(run,condition='lookout',status='completed'):
 start=time.time()-100;profile={'user_id':'fixture-owner','facts':{'introduction':'fixture'}};snapshot={'userId':'fixture-owner','tables':{'profiles':[profile],'outreach_contacts':[]}}
 m={'version':SPEC['version'],'episodeId':run.name,'taskId':'COM4','pairId':'verification','condition':condition,'repeat':1,'pilot':True,'synthetic':True,'scenarioDigest':grade.scenario_digest(SPEC),'suiteHash':'fictional-verification','model':'fixture-no-model','reasoning':'none','status':status,'startedAt':start,'durationSeconds':70,'participantEndedAt':start+70};save(run/'run.json',m)
 save(run/'initial-state.json',snapshot);save(run/'final-state.json',snapshot);(run/'output').mkdir(exist_ok=True);(run/'output/final-report.md').write_text('fictional saved state report')
 for i,s in enumerate(SPEC['stages'],1):
  sd=run/f'stage-{i}';save(sd/'stage-run.json',{'status':'completed','durationSeconds':2,'startedAt':start+i*5,'threadId':s['session']});save(sd/'delivery.json',{'stage':i,'eventId':s['id'],'releasedMinute':s['minute'],'triggerMinute':s['minute'],'assignedInitiation':condition=='baseline' and s['kind']=='external','assignedOnboarding':i==1,'necessaryUserUpdate':s['kind']=='user_update'});save(sd/'trace.jsonl',{'capturedAt':start+i*5+1,'event':{'type':'item.completed','item':{'id':'a','type':'agent_message','text':'Fictional fixture; no model ran.'}}});(sd/'lookout-trace.jsonl').write_text('');save(sd/'before-state.json',snapshot);save(sd/'after-state.json',snapshot);(sd/'prompt.txt').write_text('fictional');(sd/'output').mkdir(exist_ok=True);(sd/'output/final-report.md').write_text('fictional')
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
