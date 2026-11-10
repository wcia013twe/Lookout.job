import importlib.util,json,tempfile,unittest,time,subprocess
from pathlib import Path
import grade,runner,user_actor
ROOT=Path(__file__).resolve().parents[2];SPEC=json.loads((ROOT/'examples/com2/scenario.json').read_text())
def save(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v)+'\n')
def fixture(run,condition='lookout',status='completed'):
 import capture
 start=time.time()-100
 save(run/'run.json',{'version':SPEC['version'],'episodeId':run.name,'taskId':'COM2','pairId':'verification','condition':condition,'repeat':1,'pilot':True,'synthetic':True,'scenarioDigest':grade.scenario_digest(SPEC),'suiteHash':'fictional-verification','model':'fixture-no-model','reasoning':'none','status':status,'ownerId':'fictional-owner','participantEndedAt':start+70,'startedAt':start,'durationSeconds':70})
 save(run/'initial-state.json',{'fictional':True})
 for i,s in enumerate(SPEC['stages'],1):
  sd=run/f'stage-{i}';save(sd/'stage-run.json',{'status':'completed','durationSeconds':2,'startedAt':start+i*5,'threadId':s['session']})
  save(sd/'delivery.json',{'stage':i,'kind':s['kind'],'eventId':s['id'],'releasedMinute':s['minute'],'triggerMinute':s['minute'],'assignedInitiation':s['kind']=='external','assignedOnboarding':i==1,'necessaryUserUpdate':s['kind']=='user_update'})
  save(sd/'trace.jsonl',{'capturedAt':start+i*5+1,'event':{'type':'item.completed','item':{'id':'a','type':'agent_message','text':'Fictional fixture; no model ran.'}}})
  (sd/'lookout-trace.jsonl').write_text('')
  save(sd/'after-state.json',{'fictional':True});save(sd/'before-state.json',{'fictional':True})
  (sd/'prompt.txt').write_text('fictional prompt');(sd/'output').mkdir(exist_ok=True);(sd/'output/result.md').write_text('fictional result');save(sd/'output-hashes.json',capture.files(sd/'output'))
 import capture,shutil
 save(run/'final-state.json',{'userId':'fictional-owner','tables':{'profiles':[],'applications':[],'application_milestones':[],'outreach_contacts':[],'career_artifacts':[]}})
 if (run/'final-files').exists():shutil.rmtree(run/'final-files')
 (run/'final-files').mkdir();(run/'final-files/result.md').write_text('fictional saved result')
 receipt={'version':1,'episodeId':run.name,'ownerId':'fictional-owner','condition':condition,'participantEndedAt':start+70,'startedAt':start+71,'completedAt':start+72,'files':capture.files(run/'final-files'),'nativeSnapshotSha256':capture.sha(run/'final-state.json'),'verification':'bound_terminal_state','nativeLookups':[],'limitations':[]}
 save(run/'terminal-capture.json',receipt)
 review=grade.template(run,SPEC);review.update(reviewer='fixture-only',independentOfParticipant=True,interactionReviewComplete=True)
 for key,x in review['quality'].items():
  indices=list(range(1,len(SPEC['stages'])+1)) if key=='preservation' else [i for i,s in enumerate(SPEC['stages'],1) if key in s['checks']]
  x.update({'pass':True,'reason':'Synthetic fixture only','userImpact':'Fictional checkpoint task outcome is incorrect; cited fixture state is the evidence.','evidence':[ref for i in indices for ref in [f'stage-{i}/output/result.md',f'stage-{i}/after-state.json']]+(['terminal-capture.json'] if key in ['final_state','final_report'] else [])})
 for key,x in review['adherence'].items():x.update(outcomeVerified=True,reason='Synthetic fixture only',evidence=[f"stage-{SPEC['adherence'][key]['stage']}/after-state.json"])
 return review
class Tests(unittest.TestCase):
 def test_run_does_not_seal_unconfirmed_participant(self):
  from unittest.mock import patch,Mock
  from contextlib import ExitStack
  import capture
  for turn_failed,removed in [(True,True),(False,False)]:
   with self.subTest(turn_failed=turn_failed,removed=removed),tempfile.TemporaryDirectory() as td,ExitStack() as stack:
    root=Path(td);suite=root/'suite';suite.mkdir();(root/'background').mkdir();(root/'background/resume.pdf').write_bytes(b'fictional')
    save(suite/'scenario.json',SPEC);(suite/'contract.md').write_text('fictional');save(root/'grader.private.json',{'userId':'fictional'})
    stage={'_index':1,'_session':'one','seconds':10,'id':'one','kind':'onboarding','minute':0}
    session=Mock();session.turn.return_value={'hostControlFailed':turn_failed,'status':'artifact_failed' if turn_failed else 'completed'};session.close.return_value={'containerRemoved':removed}
    for key,val in {'R':root,'S':suite,'RUNS':root/'runs','CONFIG':{'version':SPEC['version']},'TASK':'COM2'}.items():stack.enter_context(patch.object(runner,key,val))
    for key,val in {'ensure_awake':{},'verify':('hash','image'),'packets':[stage],'released_sources':{},'command':None,'validate_initial':None,'Session':session}.items():stack.enter_context(patch.object(runner,key,return_value=val))
    snapshots=stack.enter_context(patch.object(runner,'snapshot'));terminal=stack.enter_context(patch.object(capture,'capture'));stack.enter_context(patch.object(runner.cost,'persist',return_value={}))
    run=runner.run('baseline',1,'fictional',True);meta=json.loads((run/'run.json').read_text())
    self.assertTrue(meta['hostControlFailed']);self.assertFalse(meta['participantTerminationConfirmed']);self.assertNotIn('participantEndedAt',meta)
    self.assertFalse(meta['finalStateCaptured']);terminal.assert_not_called()
    self.assertNotIn('final-state.json',[call.args[0].name for call in snapshots.call_args_list])

 def test_pair_halts_without_grading_after_unconfirmed_termination(self):
  import runpy,sys
  from unittest.mock import patch
  from contextlib import nullcontext
  from types import SimpleNamespace
  from unittest.mock import Mock
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);runs=root/'runs';runs.mkdir()
   def write(path,value):path.write_text(json.dumps(value))
   def failed_run(*args):
    run=runs/'fictional-baseline';run.mkdir();write(run/'run.json',{'hostControlFailed':True,'status':'artifact_failed'});return run
   fake_runner=SimpleNamespace(RUNS=runs,S=root,configure=Mock(),run=Mock(side_effect=failed_run),write=write)
   write(root/'scenario.json',SPEC)
   fake_grade=SimpleNamespace(grade=Mock());fake_summary=SimpleNamespace(build=Mock())
   args=['orchestrate.py','--task-dir',str(root),'--pair-id','FICTIONAL','--repeat','1','--pilot','--langfuse-env',str(root/'absent.env'),'--receipt-dir',str(root/'receipts')]
   with patch('design.serial_pair',return_value=nullcontext()),patch.dict(sys.modules,{'runner':fake_runner,'grade':fake_grade,'summary':fake_summary}),patch.object(sys,'argv',args),self.assertRaises(SystemExit) as stopped:
    runpy.run_path(str(ROOT/'scripts/com2/orchestrate.py'),run_name='__main__')
   self.assertEqual(stopped.exception.code,1);fake_runner.run.assert_called_once_with('baseline',1,'FICTIONAL',True)
   fake_grade.grade.assert_not_called();fake_summary.build.assert_not_called()
   self.assertTrue(json.loads((root/'pair-halted.json').read_text())['remainingConditionNotStarted'])
   self.assertFalse(json.loads((runs/'fictional-baseline/grading-invalid.json').read_text())['scored'])

 def setUp(self):self.t=tempfile.TemporaryDirectory();self.run=Path(self.t.name)/'fictional';self.review=fixture(self.run)
 def tearDown(self):self.t.cleanup()
 def test_terminal_capture_reads_application_timeline_without_writes(self):
  import capture,shutil
  from unittest.mock import patch
  root=Path(self.t.name)/'source';root.mkdir()
  save(root/'grader.private.json',{'userId':'fictional-owner','taskId':'COM2','apiUrl':'http://127.0.0.1:54321','mcpUrl':'http://127.0.0.1:8080/mcp','readToken':'fictional','scopes':['workspace:read']})
  save(self.run/'final-state.json',{'userId':'fictional-owner','tables':{'profiles':[],'applications':[{'id':'fictional-app'}],'application_milestones':[],'outreach_contacts':[],'career_artifacts':[]}})
  (self.run/'output').mkdir();(self.run/'terminal-capture.json').unlink();shutil.rmtree(self.run/'final-files')
  calls=[]
  def lookup(config,name,args):
   calls.append((name,args));self.assertEqual(config['scopes'],['workspace:read'])
   return {'settings':{'profile':{'user_id':'fictional-owner'}}} if name=='read_personal_context' else {'current':'fixture'}
  with patch.object(capture,'lookup',side_effect=lookup):result=capture.capture(self.run,root)
  self.assertIn(('read_application_timeline',{'applicationId':'fictional-app'}),calls)
  self.assertTrue(all(name in capture.READS for name,args in calls))
  self.assertTrue(any(x['tool']=='read_application_timeline' for x in result['nativeLookups']))
 def test_missing_saved_file_can_fail(self):
  import capture
  review=fixture(self.run,'baseline')
  (self.run/'stage-3/output/result.md').unlink();save(self.run/'stage-3/output-hashes.json',{})
  review['quality']['availability_draft'].update({'pass':False,'reason':'Draft only in chat; no file saved','evidence':['stage-3/trace.jsonl','stage-3/output-hashes.json']})
  review['quality']['preservation']['evidence']=[x for x in review['quality']['preservation']['evidence'] if x!='stage-3/output/result.md']
  review['evidenceDigest']=grade.evidence_digest(self.run)
  result=grade.grade(self.run,SPEC,review);self.assertFalse(result['quality']['availability_draft'])
  review['quality']['availability_draft']['pass']=True
  self.assertRaises(ValueError,grade.grade,self.run,SPEC,review)
 def test_identity_question_does_not_get_completion_answer(self):
  answer,category=user_actor.answer('I completed the read but cannot find the application UUID. Which identifier?',7,SPEC)
  self.assertIn('AS-417',answer);self.assertNotIn('finished',answer)
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
  for key in ['terminal_reconciliation', 'final_state', 'final_report']:self.review['quality'][key]['pass']=False
  result=grade.grade(self.run,SPEC,self.review)
  self.assertEqual(result['metrics']['quality_fraction'],12/13)
  self.assertEqual(result['metrics']['primary_outcome_count'],13)
  self.assertEqual(sum(x is False for x in result['primaryOutcomes'].values()),1)
 def test_failed_check_needs_user_impact(self):
  item=self.review['quality']['terminal_reconciliation'];item['pass']=False;item['userImpact']=''
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
  r=fixture(self.run,'baseline');g=grade.grade(self.run,SPEC,r);self.assertNotIn('lookout_adherence_fraction',g['metrics']);self.assertEqual(g['metrics']['assigned_initiations'],7)
 def test_call_not_proof(self):
  sd=self.run/'stage-6';events=[{'type':'mcp.request','data':{'id':1,'method':'tools/call','params':{'name':'record_application_milestone'}}},{'type':'mcp.response','data':{'id':1,'result':{}}}]
  (sd/'lookout-trace.jsonl').write_text('\n'.join(map(json.dumps,events)))
  self.review['evidenceDigest']=grade.evidence_digest(self.run);self.review['adherence']['reschedule_saved']['outcomeVerified']=False
  self.assertEqual(grade.grade(self.run,SPEC,self.review)['adherence']['reschedule_saved']['status'],'attempted_but_failed')
 def test_question_count(self):
  save(self.run/'stage-4/lookout-trace.jsonl',{'type':'user.interaction','data':{'question':'May I send?','answer':'No','category':'approval','simulatedDelayMinutes':5}})
  g=grade.grade(self.run,SPEC);self.assertEqual(g['metrics']['observed_question_turns'],1)
 def test_prompts_no_profile_file_or_replay(self):
  runner.R=Path(self.t.name);runner.S=ROOT/'examples/com2';(runner.R/'background').mkdir();(runner.R/'background/onboarding.md').write_text('PRIVATE BACKGROUND')
  self.assertIn('PRIVATE BACKGROUND',runner.inputs_prompt(SPEC['stages'][0],'baseline'))
  for s in SPEC['stages'][1:]:
   for c in ['baseline','lookout']:self.assertNotIn('PRIVATE BACKGROUND',runner.inputs_prompt(s,c));self.assertNotIn('profile.md',runner.inputs_prompt(s,c))
  self.assertIn('Help me respond',runner.inputs_prompt(SPEC['stages'][1],'lookout'))
 def test_condition_storage_instructions(self):
  for stage in SPEC['stages'][1:]:
   lookout=runner.inputs_prompt(stage,'lookout');baseline=runner.inputs_prompt(stage,'baseline')
   self.assertIn('Lookout is your persistent recruiting workspace',lookout)
   self.assertIn('verify saved changes',lookout)
   self.assertIn('persist across sessions',baseline)
   self.assertNotIn('Use its tools',baseline)
  self.assertNotIn('Saved work belongs in /workspace/output',(ROOT/'scripts/com2/prepare.py').read_text())
 def test_model_and_no_mirror_contract(self):
  s=(ROOT/'scripts/com2/runner.py').read_text();self.assertIn('gpt-5.6-terra',s);self.assertIn('model_reasoning_effort="medium"',s);self.assertNotIn("out/'state.json'",s)
 def test_actor_no_future_preferences(self):
  self.assertIn('check my calendar',user_actor.answer('What is my availability?',2,SPEC)[0])
  self.assertIn('Tuesday',user_actor.answer('What is my availability?',3,SPEC)[0])
  self.assertNotIn('January',user_actor.answer('What is my earliest start date?',9,SPEC)[0])
  self.assertIn('January 19',user_actor.answer('What is my earliest start date?',10,SPEC)[0])
  self.assertEqual(user_actor.answer('May I send?',7,SPEC)[1],'approval')
 def test_review_path_escape(self):
  self.review['quality']['availability_draft']['evidence']=['../../etc/passwd'];self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_no_stages_cannot_pass(self):
  import shutil
  for p in self.run.glob('stage-*'):shutil.rmtree(p)
  self.review['evidenceDigest']=grade.evidence_digest(self.run)
  self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_missing_logs_not_zero_effort(self):
  (self.run/'stage-1/trace.jsonl').unlink();self.review['evidenceDigest']=grade.evidence_digest(self.run)
  self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_manifest_is_not_quality_evidence(self):
  self.review['quality']['availability_draft']['evidence']=['run.json']
  self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_wrong_review_version(self):
  self.review['version']='wrong';self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_rubric_change_rejected(self):
  import copy
  spec=copy.deepcopy(SPEC);spec['quality']['availability_draft']='changed';self.assertRaises(ValueError,grade.grade,self.run,spec,self.review)
 def test_setup_failure_not_adherence_omission(self):
  import shutil
  m=json.loads((self.run/'run.json').read_text());m['status']='setup_failed';save(self.run/'run.json',m)
  for p in self.run.glob('stage-*'):shutil.rmtree(p)
  g=grade.grade(self.run,SPEC);self.assertEqual(g['adherence']['reschedule_saved']['status'],'not_reached');self.assertEqual(g['metrics']['stage_4_success'],0)
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
 def test_milestone_write_requires_after_state(self):
  sd=self.run/'stage-6'
  events=[{'type':'mcp.request','data':{'id':1,'method':'tools/call','params':{'name':'record_application_milestone'}}},{'type':'mcp.response','data':{'id':1,'result':{}}}]
  (sd/'lookout-trace.jsonl').write_text('\n'.join(map(json.dumps,events)))
  self.review['evidenceDigest']=grade.evidence_digest(self.run)
  self.review['adherence']['reschedule_saved'].update(evidence=['stage-6/output/result.md'])
  self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_terminal_history_and_no_action_rubrics(self):
  self.assertIn('status-column change is not required',SPEC['quality']['terminal_reconciliation'])
  self.assertIn('No reply',SPEC['quality']['reschedule'])
  self.assertIn('scheduled',SPEC['quality']['technical_invitation'])
 def test_seven_sessions_incremental_sources(self):
  self.assertEqual(len(set(s['session'] for s in SPEC['stages'])),7)
  self.assertEqual(len(SPEC['stages']),13)
  for stage in SPEC['stages'][:10]:self.assertNotIn('alder-rejected',json.dumps(stage))
  self.assertEqual(SPEC['stages'][4]['calendar'][0]['relatedMessageId'],SPEC['stages'][4]['inbox'][0]['id'])
 def test_shared_summary_binding_and_pending(self):
  import summary
  pending=summary.build(self.run,SPEC,grade.grade(self.run,SPEC),'verification')
  self.assertIsNone(pending['evaluation']['taskSuccess'])
  self.assertEqual(pending['evaluation']['wakesUsed'],13)
  g=grade.grade(self.run,SPEC,self.review)
  r=summary.build(self.run,SPEC,g,'verification');self.assertTrue(r['evaluation']['taskSuccess'])
  g['evidenceDigest']='0'*64;self.assertRaises(ValueError,summary.build,self.run,SPEC,g,'verification')
 def test_dedicated_account_required_before_setup(self):
  import prepare
  source=Path(self.t.name)/'source';source.mkdir()
  save(source/'account.private.json',{'status':'verified','apiUrl':'http://127.0.0.1:54321','mcpUrl':'http://127.0.0.1:8080/mcp','email':'demo@example.test','benchmarkTaskId':'COM1'})
  self.assertRaises(ValueError,prepare.prepare,source,source,Path(self.t.name)/'new')
  self.assertFalse((Path(self.t.name)/'new').exists())
 def test_actor_send_history_is_not_permission(self):
  self.assertIn('have not reported',user_actor.answer('Did I send a reply?',3,SPEC)[0])
  self.assertIn('have not sent a start-date',user_actor.answer('Have I sent my earliest start date?',10,SPEC)[0])
 def test_wrong_task_identity_rejected(self):
  m=json.loads((self.run/'run.json').read_text());m['taskId']='COM1';save(self.run/'run.json',m)
  self.assertRaises(ValueError,grade.grade,self.run,SPEC)
 def test_unfinished_wrapped_native_call_is_failed_attempt(self):
  sd=self.run/'stage-6'
  save(sd/'lookout-trace.jsonl',{'type':'mcp.request','data':{'id':1,'method':'tools/call','params':{'name':'call_discovered_tool','arguments':{'name':'record_application_milestone','arguments':{}}}}})
  g=grade.grade(self.run,SPEC)
  self.assertEqual(g['adherence']['reschedule_saved']['status'],'attempted_but_failed')
 def test_durable_checkpoint_rejects_chat_only(self):
  self.review['quality']['reschedule']['evidence']=['stage-6/trace.jsonl']
  self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_missing_terminal_capture_is_unverified(self):
  (self.run/'terminal-capture.json').unlink()
  self.assertRaises(ValueError,grade.grade,self.run,SPEC)
 def test_foreign_terminal_owner_rejected(self):
  c=json.loads((self.run/'terminal-capture.json').read_text());c['ownerId']='other';save(self.run/'terminal-capture.json',c)
  self.assertRaises(ValueError,grade.grade,self.run,SPEC)
 def test_final_state_file_tamper_rejected(self):
  (self.run/'final-files/result.md').write_text('changed')
  self.assertRaises(ValueError,grade.grade,self.run,SPEC)
 def test_final_report_requires_terminal_evidence(self):
  self.review['quality']['final_report']['evidence']=['stage-13/trace.jsonl']
  self.assertRaises(ValueError,grade.grade,self.run,SPEC,self.review)
 def test_business_time_supplied_equally(self):
  runner.S=ROOT/'examples/com2'
  for condition in ['baseline','lookout']:
   prompt=runner.inputs_prompt(SPEC['stages'][5],condition)
   self.assertIn('2026-11-17T14:00:00+00:00',prompt)
   self.assertNotIn('2026-11-23',prompt)
 def test_cumulative_sources_hide_future_and_keep_delivery_duplicates(self):
  a={'id':'one','inbox':[{'id':'mail','body':'original'}]}
  b={'id':'two','inbox':[{'id':'mail','body':'original'}]}
  result=runner.released_sources([a,b])
  self.assertEqual(len(result['inbox']),1)
  self.assertEqual(len(result['notificationHistory']),2)
  self.assertEqual(result['currentNotifications']['eventId'],'two')
  self.assertRaises(RuntimeError,runner.released_sources,[a,{'id':'bad','inbox':[{'id':'mail','body':'changed'}]}])
if __name__=='__main__':unittest.main()
