import importlib.util,json,tempfile,unittest,time,subprocess
from pathlib import Path
import grade,runner,user_actor
ROOT=Path(__file__).resolve().parents[2];SPEC=json.loads((ROOT/'examples/n01/scenario.json').read_text())
def save(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v)+'\n')
def fixture(run,condition='lookout',status='completed'):
 start=time.time()-100
 save(run/'run.json',{'version':SPEC['version'],'episodeId':run.name,'taskId':'N01','pairId':'verification','condition':condition,'repeat':1,'pilot':True,'synthetic':True,'scenarioDigest':grade.scenario_digest(SPEC),'suiteHash':'fictional-verification','model':'fixture-no-model','reasoning':'none','status':status,'startedAt':start,'durationSeconds':70})
 save(run/'initial-state.json',{'fictional':True})
 for i,s in enumerate(SPEC['stages'],1):
  sd=run/f'stage-{i}';save(sd/'stage-run.json',{'status':'completed','durationSeconds':2,'startedAt':start+i*5,'threadId':s['session']})
  save(sd/'delivery.json',{'stage':i,'eventId':s['id'],'releasedMinute':s['minute'],'triggerMinute':s['minute'],'assignedInitiation':condition=='baseline' and s['kind']=='external','assignedOnboarding':i==1,'necessaryUserUpdate':s['kind']=='user_update'})
  save(sd/'trace.jsonl',{'capturedAt':start+i*5+1,'event':{'type':'item.completed','item':{'id':'a','type':'agent_message','text':'Fictional fixture; no model ran.'}}})
  (sd/'lookout-trace.jsonl').write_text('')
  save(sd/'after-state.json',{'fictional':True});save(sd/'before-state.json',{'fictional':True})
  (sd/'prompt.txt').write_text('fictional prompt');(sd/'output').mkdir(exist_ok=True);(sd/'output/result.md').write_text('fictional result')
 review=grade.template(run,SPEC);review.update(reviewer='fixture-only',independentOfParticipant=True,interactionReviewComplete=True)
 for key,x in review['quality'].items():
  indices=list(range(1,8)) if key=='preservation' else [i for i,s in enumerate(SPEC['stages'],1) if key in s['checks']]
  x.update({'pass':True,'reason':'Synthetic fixture only','evidence':[f'stage-{i}/output/result.md' for i in indices]})
 for key,x in review['adherence'].items():x.update(outcomeVerified=True,reason='Synthetic fixture only',evidence=[f"stage-{SPEC['adherence'][key]['stage']}/after-state.json"])
 return review
class Tests(unittest.TestCase):
 def setUp(self):self.t=tempfile.TemporaryDirectory();self.run=Path(self.t.name)/'fictional';self.review=fixture(self.run)
 def tearDown(self):self.t.cleanup()
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
  self.assertNotIn('Help me prepare',runner.inputs_prompt(SPEC['stages'][1],'lookout'))
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
if __name__=='__main__':unittest.main()
