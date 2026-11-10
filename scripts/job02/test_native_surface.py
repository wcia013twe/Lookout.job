import ast,json,tempfile,unittest,sys
from pathlib import Path
from types import SimpleNamespace
ROOT=Path(__file__).resolve().parents[2]
def functions(names,env):
 tree=ast.parse((ROOT/'scripts/job02/bridge.py').read_text());exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name in names],type_ignores=[]),'job02-surface','exec'),env);return env
class NativeSurface(unittest.TestCase):
 def test_preserves_native_prose_and_default_surface_without_discovery(self):
  calls=[];text='Native startup. Use agent-audit. Verbatim policy.'
  def upstream(msg):
   calls.append(msg)
   return {'result':{'instructions':text,'capabilities':{'tools':{'listChanged':True}},'serverInfo':{'name':'Lookout','version':'fixture'}}}if msg['method']=='initialize'else{'result':{'tools':[{'name':'discover_tools','inputSchema':{}},{'name':'blocked','inputSchema':{}}]}}
  env=functions(['clean','schemas','initialize_result'],{'a':SimpleNamespace(condition='lookout'),'allowed':{'discover_tools'},'json':json,'upstream':upstream,'tools':[{'name':'browser_open'}]})
  initial=env['initialize_result']({'method':'initialize','id':1});self.assertTrue(initial['instructions'].startswith(text+'\n'));self.assertEqual(initial['serverInfo']['name'],'Lookout')
  result=env['schemas'](2);self.assertEqual([m['method']for m in calls],['initialize','tools/list']);self.assertEqual([t['name']for t in result],['discover_tools','browser_open'])
 def test_wrapper_requires_both_scoped_wrapper_and_inner(self):
  env=functions(['permitted_native'],{'a':SimpleNamespace(condition='lookout'),'allowed':{'read_personal_context'}})
  self.assertFalse(env['permitted_native']('call_discovered_tool',{'name':'read_personal_context'}));env['allowed'].add('call_discovered_tool');self.assertTrue(env['permitted_native']('call_discovered_tool',{'name':'read_personal_context'}));self.assertFalse(env['permitted_native']('call_discovered_tool',{'name':'submit_application'}))
 def test_matched_task_prompts_except_first_message_onboarding(self):
  tree=ast.parse((ROOT/'scripts/job02/runner.py').read_text());f=next(n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name=='prompt')
  with tempfile.TemporaryDirectory()as t:
   root=Path(t);(root/'suite').mkdir();(root/'candidate').mkdir();(root/'suite/scenario.json').write_text('{}');(root/'candidate/profile.md').write_text('first-message onboarding')
   env={'ROOT':root,'json':json};exec(compile(ast.Module(body=[f],type_ignores=[]),'prompt','exec'),env)
   orientations={'baseline':'Use your persistent workspace files to retain relevant context, drafts, questions and next steps; verify saved changes. ','lookout':'Lookout is your persistent recruiting workspace. Use Lookout tools to retrieve relevant saved context and save meaningful drafts, questions and next steps; verify saved changes. '}
   for stage in ['continue','prepare']:
    prompts={c:env['prompt']({'id':stage},c)for c in orientations}
    for c,orientation in orientations.items():
     self.assertEqual(prompts[c].count(orientation),1);prompts[c]=prompts[c].replace(orientation,'').replace('\nfirst-message onboarding','')
    self.assertEqual(prompts['baseline'],prompts['lookout'])
 def test_awake_guard_fails_before_attempt_without_participant_retry(self):
  tree=ast.parse((ROOT/'scripts/job02/runner.py').read_text());f=next(n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name=='run');calls=[]
  def guard():calls.append('awake');raise RuntimeError('guard unavailable')
  with tempfile.TemporaryDirectory()as t:
   env={'ROOT':Path(t),'node':lambda action:calls.append(action),'runtime':SimpleNamespace(ensure_awake=guard)};exec(compile(ast.Module(body=[f],type_ignores=[]),'run','exec'),env)
   with self.assertRaisesRegex(RuntimeError,'guard unavailable'):env['run']('fixed-pair')
   self.assertEqual(calls,['check-launch','awake']);self.assertFalse((Path(t)/'pilot-attempt.json').exists())
if __name__=='__main__':unittest.main()
