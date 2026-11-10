"""Synthetic metadata fixture only; no model, native writes or network."""
import json,sys,time,unittest,tempfile,copy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts/com3'))
import grade,capture,summary
SPEC=json.loads((ROOT/'examples/com3/scenario.json').read_text())
def save(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v)+'\n')
def fixture(run,condition):
 start=1800000000
 meta={'version':SPEC['version'],'episodeId':run.name,'taskId':'COM3','pairId':'synthetic','condition':condition,'repeat':1,'pilot':True,'synthetic':True,'scenarioDigest':grade.scenario_digest(SPEC),'suiteHash':'synthetic-only','model':'fixture-no-model','reasoning':'none','status':'completed','ownerId':'fictional-owner','participantEndedAt':start+70,'startedAt':start,'durationSeconds':70}
 save(run/'run.json',meta)
 state={'userId':'fictional-owner','tables':{'profiles':[],'applications':[],'application_milestones':[],'outreach_contacts':[],'career_artifacts':[],'company_workspaces':[]}}
 save(run/'initial-state.json',state)
 for i,s in enumerate(SPEC['stages'],1):
  sd=run/f'stage-{i}';save(sd/'stage-run.json',{'status':'completed','durationSeconds':2,'startedAt':start+i*5,'threadId':s['session']})
  save(sd/'delivery.json',{'stage':i,'kind':s['kind'],'eventId':s['id'],'releasedMinute':s['minute'],'triggerMinute':s['minute'],'assignedInitiation':s['kind']=='external','assignedOnboarding':i==1,'necessaryUserUpdate':s['kind']=='user_update'})
  save(sd/'trace.jsonl',{'capturedAt':start+i*5+1,'event':{'type':'item.completed','item':{'id':'message','type':'agent_message','text':'PRIVATE_SYNTHETIC_CONTENT'}}})
  events=[]
  if condition=='lookout':
   for rule in SPEC['adherence'].values():
    if rule['stage']==i:
     ident=len(events)+1;events += [{'type':'mcp.request','data':{'id':ident,'method':'tools/call','params':{'name':rule['tools'][0],'arguments':{}}}},{'type':'mcp.response','data':{'id':ident,'result':{}}}]
  (sd/'lookout-trace.jsonl').write_text('\n'.join(map(json.dumps,events)))
  save(sd/'after-state.json',state);save(sd/'before-state.json',state)
  (sd/'prompt.txt').write_text('PRIVATE_SYNTHETIC_CONTENT');(sd/'output').mkdir();(sd/'output/result.md').write_text('PRIVATE_SYNTHETIC_CONTENT')
 for phase in ['prefinal','terminal']:
  statefile='final-state.json' if phase=='terminal' else 'prefinal-state.json';save(run/statefile,state)
  folder=run/(phase+'-files');folder.mkdir();(folder/'result.md').write_text('PRIVATE_SYNTHETIC_CONTENT')
  save(run/(phase+'-capture.json'),{'version':1,'phase':phase,'episodeId':run.name,'ownerId':meta['ownerId'],'condition':condition,'participantEndedAt':meta['participantEndedAt'] if phase=='terminal' else None,'startedAt':start+(71 if phase=='terminal' else 48),'completedAt':start+(72 if phase=='terminal' else 49),'files':capture.files(folder),'nativeSnapshotSha256':capture.sha(run/statefile),'nativeLookups':[],'limitations':[]})
 review=grade.template(run,SPEC);review.update(reviewer='synthetic-reviewer',independentOfParticipant=True,interactionReviewComplete=True)
 for key,item in review['quality'].items():
  ids=[i for i,s in enumerate(SPEC['stages'],1) if key in s['checks']]
  item.update({'pass':True,'reason':'Synthetic validation only','evidence':[f'stage-{i}/'+('after-state.json' if condition=='lookout' else 'output/result.md') for i in ids]})
 for key,item in review['adherence'].items():item.update(outcomeVerified=True,reason='Synthetic validation only',evidence=[f"stage-{SPEC['adherence'][key]['stage']}/after-state.json"])
 for phase,checks in review['finalStates'].items():
  for key,item in checks.items():item.update({'pass':True,'reason':'Synthetic validation only','durableStateVerified':True,'evidence':[phase+'-capture.json',('final-state.json' if phase=='terminal' else 'prefinal-state.json') if condition=='lookout' else phase+'-files/result.md']+(['stage-10/trace.jsonl'] if key=='report_fidelity' else [])})
 return review
class Integration(unittest.TestCase):
 def test_both_conditions_pending_reviewed_and_rejections(self):
  for condition in ['baseline','lookout']:
   with self.subTest(condition=condition),tempfile.TemporaryDirectory() as t:
    p=Path(t)/condition;r=fixture(p,condition)
    pending=grade.grade(p,SPEC);self.assertEqual(pending['status'],'pending_review');self.assertNotIn('quality_pass',pending['metrics']);self.assertIsNone(summary.build(p,SPEC,pending,'synthetic')['evaluation']['quality'])
    reviewed=grade.grade(p,SPEC,r);self.assertEqual(reviewed['metrics']['quality_pass'],1);self.assertTrue(summary.build(p,SPEC,reviewed,'synthetic')['evaluation']['taskSuccess'])
    if condition=='lookout':self.assertEqual(reviewed['metrics']['lookout_adherence_fraction'],1)
    else:self.assertTrue(all(x['status']=='not_applicable' for x in reviewed['adherence'].values()))
    bad=copy.deepcopy(r);bad['independentOfParticipant']=False;self.assertRaises(ValueError,grade.grade,p,SPEC,bad)
    bad=copy.deepcopy(r);bad['finalStates']['terminal']['state_accuracy']['durableStateVerified']=False;self.assertRaises(ValueError,grade.grade,p,SPEC,bad)
    bad=copy.deepcopy(r);bad['quality']['discovery']['evidence']=['stage-2/trace.jsonl'];self.assertRaises(ValueError,grade.grade,p,SPEC,bad)
    bad=copy.deepcopy(r);bad['finalStates']['prefinal']['continuity']['pass']=False
    separate=grade.grade(p,SPEC,bad);self.assertEqual(separate['metrics']['prefinal_continuity'],0);self.assertEqual(separate['metrics']['terminal_continuity'],1)
    (p/'stage-1/prompt.txt').write_text('changed');self.assertRaises(ValueError,grade.grade,p,SPEC,r);self.assertRaises(ValueError,summary.build,p,SPEC,reviewed,'synthetic')
if __name__=='__main__':
 if len(sys.argv)>1 and sys.argv[1]=='build':
  run=Path(sys.argv[2]);r=fixture(run,sys.argv[3]);reviewed=grade.grade(run,SPEC,r);pending=grade.grade(run,SPEC)
  save(run/'review.json',r);save(run/'grade.json',reviewed);save(run/'pending.json',pending);save(run/'summary.json',summary.build(run,SPEC,reviewed,'synthetic'));save(run/'pending-summary.json',summary.build(run,SPEC,pending,'synthetic'))
 else:unittest.main()
