import json,sys,tempfile,unittest
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
