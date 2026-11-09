import importlib.util,json,tempfile,unittest
from pathlib import Path
from services import Services
from bridge import clean,actor

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

if __name__=='__main__':unittest.main()
