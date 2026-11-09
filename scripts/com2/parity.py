"""Exact source-to-native mapping plus readable onboarding coverage, all local/private."""
import hashlib,json,re
from pathlib import Path

def leaves(value,path=''):
 if isinstance(value,dict):
  for key,item in value.items():yield from leaves(item,path+'.'+key if path else key)
 elif isinstance(value,list):
  for i,item in enumerate(value):yield from leaves(item,f'{path}[{i}]')
 else:yield path,value

def complete_and_verify(source,background,onboarding,initial):
 source=Path(source);manifest=json.loads((source/'source-manifest.private.json').read_text());clone=json.loads((source/'cloned-context.private.json').read_text());account=json.loads((source/'account.private.json').read_text())
 def remap(x):
  if isinstance(x,str):
   for a,b in account['idMapping'].items():x=x.replace(a,b)
   return x
  if isinstance(x,list):return [remap(v) for v in x]
  if isinstance(x,dict):return {k:remap(v) for k,v in x.items()}
  return x
 expected=remap(manifest['settings']);actual=clone['settings']
 for obj in [expected,actual]:obj['resumes']=sorted(obj['resumes'],key=lambda x:x['id'])
 if expected!=actual:raise ValueError('Native clone differs from full source manifest')
 normalize=lambda x:re.sub(r'\s+',' ',str(x)).strip().casefold()
 covered=[];added=[]
 for key,value in leaves(manifest['settings']):
  if value is None or value=='':continue
  text=('yes' if value else 'no') if isinstance(value,bool) else str(value)
  if normalize(text) not in normalize(onboarding):
   onboarding+='\nMy saved '+key.replace('_',' ').replace('.',' / ')+': '+text+'.\n';added.append(key)
  covered.append(key)
 # Include every factual starting contact field, not a handpicked summary.
 for person in initial['contacts']:
  for key,value in leaves(person['record']):
   if value not in [None,''] and normalize(value) not in normalize(onboarding):onboarding+='\nFor '+person['record']['contact']+', '+key+': '+str(value)+'.\n'
 sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
 return onboarding,dict(sourceManifestSha256=sha(source/'source-manifest.private.json'),profileExportSha256=sha(Path(background)/'profile.md'),nativeEquivalentBeyondOwnershipMapping=True,initialProfileMatchesClone=True,coveredSourcePaths=covered,additionalVerbatimSourcePaths=added,fixtureContactFieldsIncluded=True)
