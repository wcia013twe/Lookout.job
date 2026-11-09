import importlib.util,json,tempfile,unittest,time,subprocess
from pathlib import Path
import grade,runner,user_actor,terminal_state
ROOT=Path(__file__).resolve().parents[2];SPEC=json.loads((ROOT/'examples/n01/scenario.json').read_text())
def save(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v)+'\n')
def fixture(run,condition='lookout',status='completed'):
 start=time.time()-100
 save(run/'run.json',{'version':SPEC['version'],'episodeId':run.name,'taskId':'COM1','pairId':'verification','condition':condition,'repeat':1,'pilot':True,'synthetic':True,'scenarioDigest':grade.scenario_digest(SPEC),'suiteHash':'fictional-verification','model':'fixture-no-model','reasoning':'none','status':status,'startedAt':start,'durationSeconds':70,'participantEndedAt':start+70})
 snapshot={'tables':{'profiles':[{'id':'fixture-owner','user_id':'fixture-owner','facts':{}}],'outreach_contacts':[]}}
 save(run/'initial-state.json',snapshot);save(run/'final-state.json',snapshot)
 (run/'output').mkdir(exist_ok=True)
 for i,s in enumerate(SPEC['stages'],1):
  sd=run/f'stage-{i}';save(sd/'stage-run.json',{'status':'completed','durationSeconds':2,'startedAt':start+i*5,'threadId':s['session']})
  save(sd/'delivery.json',{'stage':i,'eventId':s['id'],'releasedMinute':s['minute'],'triggerMinute':s['minute'],'assignedInitiation':s['kind']=='external','assignedOnboarding':i==1,'necessaryUserUpdate':s['kind']=='user_update'})
  save(sd/'trace.jsonl',{'capturedAt':start+i*5+1,'event':{'type':'item.completed','item':{'id':'a','type':'agent_message','text':'Fictional fixture; no model ran.'}}})
  (sd/'lookout-trace.jsonl').write_text('')
  save(sd/'after-state.json',{'fictional':True});save(sd/'before-state.json',{'fictional':True})
  (sd/'prompt.txt').write_text('fictional prompt');(sd/'output').mkdir(exist_ok=True);(sd/'output/result.md').write_text('fictional result')
 (run/'stage-8/output/final-report.md').write_text('fixture report')
 save(run/'grader.private.json',{'status':'verified','mcpUrl':'http://127.0.0.1:8080/mcp','userId':'fixture-owner','benchmarkTaskId':'COM1','scopes':['workspace:read']})
 (run/'terminal-state.json').unlink(missing_ok=True)
 if status!='running':terminal_state.capture_terminal_state(run,run,json.loads((run/'run.json').read_text()),lookup=lambda a,n: [] if n=='list_contacts' else {'settings':{'profile':{'user_id':'fixture-owner','facts':{}}}} if n=='read_personal_context' else {})
 review=grade.template(run,SPEC);review.update(reviewer='fixture-only',independentOfParticipant=True,interactionReviewComplete=True)
 for key,x in review['quality'].items():
  indices=list(range(1,len(SPEC['stages'])+1)) if key=='preservation' else [i for i,s in enumerate(SPEC['stages'],1) if key in s['checks']]
  x.update({'pass':True,'reason':'Synthetic fixture only','userImpact':'Fictional checkpoint task outcome is incorrect; cited fixture state is the evidence.','evidence':[f'stage-{i}/output/result.md' for i in indices]})
 for key in ['initial_context','preparation','tentative_preference','reply','confirmed_preference','follow_through','saved_state']:
  review['quality'][key]['evidence'] += [f'stage-{i}/after-state.json' for i,stage in enumerate(SPEC['stages'],1) if key in stage['checks']]
 for key in ['saved_state','report_accuracy']:review['quality'][key]['evidence']+=['terminal-state.json','stage-8/output/final-report.md']
 review['quality']['saved_state']['evidence']+=['stage-7/after-state.json','stage-7/output/result.md']
 for key,x in review['adherence'].items():x.update(outcomeVerified=True,reason='Synthetic fixture only',evidence=[f"stage-{SPEC['adherence'][key]['stage']}/after-state.json"])
 return review
class Tests(unittest.TestCase):
 def setUp(self):self.t=tempfile.TemporaryDirectory();self.run=Path(self.t.name)/'fictional';self.review=fixture(self.run)
 def tearDown(self):self.t.cleanup()
 def test_invalid_host_timing_is_unknown_not_zero(self):
  p=self.run/'stage-1/stage-run.json';v=json.loads(p.read_text());v.update(timing={'valid':False},executionSeconds=None);save(p,v)
  g=grade.grade(self.run,SPEC)
  self.assertEqual(g['metrics']['timing_valid'],0);self.assertIsNone(g['metrics']['execution_seconds'])
 def test_valid_host_timing_uses_monotonic_duration(self):
  for p in self.run.glob('stage-*/stage-run.json'):
   v=json.loads(p.read_text());v.update(timing={'valid':True},executionSeconds=1);save(p,v)
  g=grade.grade(self.run,SPEC)
  self.assertEqual(g['metrics']['timing_valid'],1);self.assertEqual(g['metrics']['execution_seconds'],len(SPEC['stages']))
 def test_related_checkpoint_failures_count_as_one_primary_outcome(self):
  for key in ['initial_context', 'preservation', 'report_accuracy']:self.review['quality'][key]['pass']=False
  result=grade.grade(self.run,SPEC,self.review)
  self.assertEqual(result['metrics']['quality_fraction'],7/8)
  self.assertEqual(result['metrics']['primary_outcome_count'],8)
  self.assertEqual(sum(x is False for x in result['primaryOutcomes'].values()),1)
 def test_failed_check_needs_user_impact(self):
  item=self.review['quality']['initial_context'];item['pass']=False;item['userImpact']=''
  with self.assertRaisesRegex(ValueError,'user impact'):grade.grade(self.run,SPEC,self.review)
 def test_missing_review_pending(self):
  g=grade.grade(self.run,SPEC);self.assertEqual(g['status'],'pending_review');self.assertNotIn('quality_pass',g['metrics']);self.assertTrue(all(v is None for v in g['quality'].values()))
 def test_no_tools_omitted_even_good_quality(self):
  g=grade.grade(self.run,SPEC,self.review);self.assertEqual(g['metrics']['quality_pass'],1);self.assertEqual(g['metrics']['lookout_adherence_fraction'],0)
 def test_timeout_never_passes(self):
  self.review=fixture(self.run,status='timed_out');g=grade.grade(self.run,SPEC,self.review);self.assertEqual(g['metrics']['quality_pass'],0)
 def test_changed_evidence_rejected(self):
  (self.run/'stage-1/trace.jsonl').write_text('');self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_active_rejected(self):
  fixture(self.run,status='running');self.assertRaises(ValueError,grade.grade,self.run,SPEC)
 def test_baseline_no_native_penalty(self):
  r=fixture(self.run,'baseline');g=grade.grade(self.run,SPEC,r);self.assertNotIn('lookout_adherence_fraction',g['metrics']);self.assertEqual(g['metrics']['assigned_initiations'],4)
 def test_call_not_proof(self):
  sd=self.run/'stage-5';events=[{'type':'mcp.request','data':{'id':1,'method':'tools/call','params':{'name':'save_profile_package'}}},{'type':'mcp.response','data':{'id':1,'result':{}}}]
  (sd/'lookout-trace.jsonl').write_text('\n'.join(map(json.dumps,events)))
  self.review['evidenceDigest']=grade.evidence_digest(self.run);self.review['adherence']['confirmed_saved']['outcomeVerified']=False
  self.assertEqual(grade.grade(self.run,SPEC,self.review)['adherence']['confirmed_saved']['status'],'attempted_but_failed')
 def test_question_count(self):
  save(self.run/'stage-4/lookout-trace.jsonl',{'type':'user.interaction','data':{'question':'May I send?','answer':'No','category':'approval','simulatedDelayMinutes':5}})
  g=grade.grade(self.run,SPEC);self.assertEqual(g['metrics']['observed_question_turns'],1)
 def test_prompts_no_profile_file_or_replay(self):
  runner.R=Path(self.t.name);(runner.R/'background').mkdir();(runner.R/'background/onboarding.md').write_text('PRIVATE BACKGROUND')
  self.assertIn('PRIVATE BACKGROUND',runner.inputs_prompt(SPEC['stages'][0],'baseline'))
  for s in SPEC['stages'][1:]:
   for c in ['baseline','lookout']:self.assertNotIn('PRIVATE BACKGROUND',runner.inputs_prompt(s,c));self.assertNotIn('profile.md',runner.inputs_prompt(s,c))
  self.assertIn('Help me prepare',runner.inputs_prompt(SPEC['stages'][1],'lookout'))
 def test_condition_storage_instructions(self):
  for stage in SPEC['stages'][1:]:
   lookout=runner.inputs_prompt(stage,'lookout');baseline=runner.inputs_prompt(stage,'baseline')
   self.assertIn('Lookout is your persistent recruiting workspace',lookout)
   self.assertIn('verify saved changes',lookout)
   self.assertIn('persist across sessions',baseline)
   self.assertNotIn('Use its tools',baseline)
  self.assertNotIn('Saved work belongs in /workspace/output',(ROOT/'scripts/n01/prepare.py').read_text())
 def test_model_and_no_mirror_contract(self):
  s=(ROOT/'scripts/n01/runner.py').read_text();self.assertIn('gpt-5.6-terra',s);self.assertIn('model_reasoning_effort="medium"',s);self.assertNotIn("out/'state.json'",s)
 def test_actor_no_future_preferences(self):
  self.assertIn('inference systems first',user_actor.answer('What are my priorities?',2,SPEC)[0])
  self.assertIn('have not decided',user_actor.answer('What are my priorities?',3,SPEC)[0])
  self.assertIn('primary focus',user_actor.answer('What are my priorities?',5,SPEC)[0])
  self.assertEqual(user_actor.answer('May I send?',7,SPEC)[1],'approval')
 def test_review_path_escape(self):
  self.review['quality']['reply']['evidence']=['../../etc/passwd'];self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_no_stages_cannot_pass(self):
  import shutil
  for p in self.run.glob('stage-*'):shutil.rmtree(p)
  self.review['evidenceDigest']=grade.evidence_digest(self.run)
  self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_missing_logs_not_zero_effort(self):
  (self.run/'stage-1/trace.jsonl').unlink();self.review['evidenceDigest']=grade.evidence_digest(self.run)
  self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_manifest_is_not_quality_evidence(self):
  self.review['quality']['reply']['evidence']=['run.json']
  self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_wrong_review_version(self):
  self.review['version']='wrong';self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_rubric_change_rejected(self):
  import copy
  spec=copy.deepcopy(SPEC);spec['quality']['reply']='changed';self.assertRaises(ValueError,grade.grade,self.run,spec,self.review)
 def test_setup_failure_not_adherence_omission(self):
  import shutil
  m=json.loads((self.run/'run.json').read_text());m['status']='setup_failed';save(self.run/'run.json',m)
  for p in self.run.glob('stage-*'):shutil.rmtree(p)
  (self.run/'terminal-state.json').unlink()
  g=grade.grade(self.run,SPEC);self.assertEqual(g['adherence']['confirmed_saved']['status'],'not_reached');self.assertEqual(g['metrics']['stage_4_success'],0)
 def test_captured_question_cannot_be_added_again(self):
  self.review['additionalInteractions']=[{'interactionId':'stage-4/lookout-trace.jsonl#L1','category':'clarification','reason':'duplicate','evidence':['stage-4/trace.jsonl']}]
  self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_unanswered_demand_is_separate(self):
  self.review['additionalInteractions']=[{'interactionId':'stage-4/trace.jsonl#L1','category':'clarification','duplicatesCapturedQuestion':False,'reason':'Fictional unanswered demand','evidence':['stage-4/trace.jsonl']}]
  g=grade.grade(self.run,SPEC,self.review);self.assertEqual(g['metrics']['observed_unanswered_demands'],1);self.assertEqual(g['metrics']['observed_question_turns'],0)
 def test_duplicate_additional_demand_rejected(self):
  x={'interactionId':'stage-4/trace.jsonl#L1','category':'clarification','duplicatesCapturedQuestion':False,'reason':'demand','evidence':['stage-4/trace.jsonl']}
  self.review['additionalInteractions']=[x,x];self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_waiting_label_and_coverage(self):
  g=grade.grade(self.run,SPEC,self.review);self.assertIn('simulated_waiting_minutes',g['latencies'][0]);self.assertEqual(g['metrics']['stage_7_success'],1)
 def test_final_report_prompt_both_conditions(self):
  for c in ['baseline','lookout']:
   prompt=runner.inputs_prompt(SPEC['stages'][-1],c)
   self.assertIn('actual durable records',prompt);self.assertIn('Reconcile material discrepancies',prompt);self.assertIn('final-report.md',prompt)
 def test_report_alone_cannot_pass(self):
  self.review['quality']['report_accuracy']['evidence']=['stage-8/output/final-report.md']
  self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_terminal_owner_mismatch_rejected(self):
  p=self.run/'terminal-state.json';x=json.loads(p.read_text());x['ownerId']='another-user';save(p,x)
  self.assertRaises(ValueError,grade.grade,self.run,SPEC)
 def test_terminal_capture_before_participant_end_rejected(self):
  p=self.run/'terminal-state.json';x=json.loads(p.read_text());x['captureStartedAt']=0;save(p,x)
  self.assertRaises(ValueError,grade.grade,self.run,SPEC)
 def test_terminal_version_mismatch_rejected(self):
  p=self.run/'terminal-state.json';x=json.loads(p.read_text());x['scenarioVersion']='old';save(p,x)
  self.assertRaises(ValueError,grade.grade,self.run,SPEC)
 def test_saved_file_change_rejected(self):
  (self.run/'output/late.md').write_text('later state')
  self.assertRaises(ValueError,grade.grade,self.run,SPEC)
 def test_scoped_reads_are_allowlisted(self):
  self.assertRaises(ValueError,terminal_state.call,{},'save_contact')
 def test_optional_lookup_failure_uses_bound_snapshot(self):
  (self.run/'terminal-state.json').unlink()
  def unavailable(a,n):raise RuntimeError('unavailable')
  receipt=terminal_state.capture_terminal_state(self.run,self.run,json.loads((self.run/'run.json').read_text()),lookup=unavailable)
  self.assertEqual(receipt['source'],'post_terminal_snapshot')
  terminal_state.validate_terminal_state(self.run,json.loads((self.run/'run.json').read_text()))
 def test_scoped_wrong_owner_fails_capture(self):
  (self.run/'terminal-state.json').unlink()
  def wrong(a,n):return [{'id':'wrong','user_id':'other'}] if n=='list_contacts' else {}
  self.assertRaises(ValueError,terminal_state.capture_terminal_state,self.run,self.run,json.loads((self.run/'run.json').read_text()),wrong)
 def test_missing_terminal_capture_invalidates_completed_run(self):
  (self.run/'terminal-state.json').unlink()
  self.assertRaises(ValueError,grade.grade,self.run,SPEC)
class RepairTests(unittest.TestCase):
 def test_inbox_retained_and_duplicate_delivery_separate(self):
  sources=runner.released_sources(SPEC['stages'][:7])
  self.assertEqual(len(sources['inbox']),3)
  self.assertEqual(sources['currentNotifications']['inboxIds'],['email-ivo-2'])
  self.assertEqual(sum('email-ivo-2' in d['inboxIds'] for d in sources['notificationHistory']),2)
  self.assertEqual(runner.released_sources(SPEC['stages'][:3])['inbox'],[])
 def test_collision_rejected(self):
  self.assertRaises(RuntimeError,runner.released_sources,[{'id':'a','inbox':[{'id':'x','body':'a'}]},{'id':'b','inbox':[{'id':'x','body':'b'}]}])
 def test_actor_introduction_is_not_future_leak(self):
  self.assertNotIn('Yes, I am interested',user_actor.answer('Do you want Ivo to introduce you?',5,SPEC)[0])
  self.assertIn('Yes, I am interested',user_actor.answer('Do you want Ivo to introduce you?',6,SPEC)[0])
 def test_call_categories_and_retry_are_separate(self):
  from diagnostics import call_metrics
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);events=[]
   for i,name,ok in [(1,'discover_tools',True),(2,'list_contacts',True),(3,'save_contact',False),(4,'save_contact',True),(5,'ask_user',True)]:
    events.extend([{'type':'mcp.request','data':{'id':i,'method':'tools/call','params':{'name':name,'arguments':{}}}},{'type':'mcp.response','data':{'id':i,'result':{'isError':not ok}}}])
   (p/'lookout-trace.jsonl').write_text('\n'.join(map(json.dumps,events)))
   m=call_metrics([p]);self.assertEqual(m['tool_write_calls'],2);self.assertEqual(m['tool_failed_calls'],1);self.assertEqual(m['tool_exact_retries_after_failure'],1);self.assertEqual(m['tool_read_calls'],1);self.assertEqual(m['tool_discovery_calls'],1)

if __name__=='__main__':unittest.main()
