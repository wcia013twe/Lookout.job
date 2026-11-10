import copy,json,tempfile,unittest
from pathlib import Path
from design import condition_order,outcome_groups,score_outcomes,serial_pair
ROOT=Path(__file__).resolve().parents[2]

class DesignTests(unittest.TestCase):
 def test_partition_rejects_omissions_duplicate_weight_and_unknown_checks(self):
  base={'quality':{'a':'a','b':'b'},'qualityGroups':{'outcome':['a','b']}}
  for groups in [{'x':['a']},{'x':['a'],'y':['a','b']},{'x':['a','c']},{}]:
   spec={**base,'qualityGroups':groups}
   with self.assertRaises(ValueError):outcome_groups(spec)
  self.assertEqual(score_outcomes(base,{'a':True,'b':None}),{'outcome':None})
  self.assertEqual(score_outcomes(base,{'a':False,'b':None}),{'outcome':False})
 def test_fresh_owner_fixtures_do_not_collide_and_references_follow(self):
  from fixtures import fixture_for_owner
  fixture={'application':{'id':'app-a'},'sentinelApplication':{'id':'app-b'},'contact':{'applicationId':'app-a'}}
  a=fixture_for_owner(fixture,'00000000-0000-0000-0000-000000000001')
  b=fixture_for_owner(fixture,'00000000-0000-0000-0000-000000000002')
  self.assertNotEqual(a['application']['id'],b['application']['id'])
  self.assertEqual(a['contact']['applicationId'],a['application']['id'])
  self.assertEqual(fixture['application']['id'],'app-a')
  self.assertEqual(a,fixture_for_owner(fixture,'00000000-0000-0000-0000-000000000001'))
 def test_preplanned_four_pairs_are_balanced(self):
  orders=[condition_order(i) for i in range(1,5)]
  self.assertEqual(sum(x[0]=='baseline' for x in orders),2)
  self.assertEqual(sum(x[0]=='lookout' for x in orders),2)
  for value in [0,-1,True,1.5]:
   with self.assertRaises(ValueError):condition_order(value)
 def test_pair_lock_blocks_overlap_and_releases_after_failure(self):
  with tempfile.TemporaryDirectory() as td:
   path=Path(td)/'pair.lock'
   with self.assertRaisesRegex(RuntimeError,'synthetic failure'):
    with serial_pair(path):
     with self.assertRaisesRegex(RuntimeError,'serially'):
      with serial_pair(path):pass
     raise RuntimeError('synthetic failure')
   with serial_pair(path):pass
 def test_case_groups_have_frozen_counts_and_no_outcome_direction(self):
  for folder,count in [('n01',8),('com2',13)]:
   spec=json.loads((ROOT/'examples'/folder/'scenario.json').read_text())
   self.assertEqual(len(outcome_groups(spec)),count)
   self.assertTrue(all(score_outcomes(spec,{k:True for k in spec['quality']}).values()))
   self.assertFalse(any(score_outcomes(spec,{k:False for k in spec['quality']}).values()))
   self.assertEqual(spec['study']['plannedPairsPerCase'],4)
   self.assertFalse(spec['policy']['measuresProactiveInitiation'])

if __name__=='__main__':unittest.main()
