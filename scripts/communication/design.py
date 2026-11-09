"""Shared prospective outcome scoring and serial, counterbalanced pair execution."""
from contextlib import contextmanager
import fcntl,os,tempfile
from pathlib import Path

def outcome_groups(spec):
 groups=spec.get('qualityGroups')
 if groups is None:return {key:[key] for key in spec['quality']}
 if not isinstance(groups,dict) or not groups:raise ValueError('Nonempty primary outcome groups required')
 members=[]
 for name,keys in groups.items():
  if not isinstance(name,str) or not name or not isinstance(keys,list) or not keys:raise ValueError('Invalid primary outcome group')
  if any(not isinstance(key,str) for key in keys):raise ValueError('Invalid outcome checkpoint')
  members.extend(keys)
 if len(members)!=len(set(members)) or set(members)!=set(spec['quality']):raise ValueError('Each checkpoint must belong to exactly one primary outcome')
 return groups

def score_outcomes(spec,quality):
 groups=outcome_groups(spec)
 if set(quality)!=set(spec['quality']):raise ValueError('Outcome checkpoint mismatch')
 if any(value is not None and type(value) is not bool for value in quality.values()):raise ValueError('Checkpoint must be boolean or unresolved')
 return {name:False if any(quality[key] is False for key in keys) else None if any(quality[key] is None for key in keys) else True for name,keys in groups.items()}

def require_user_impact(spec,item):
 if spec.get('study',{}).get('requiresUserImpact') and item.get('pass') is False:
  if not isinstance(item.get('userImpact'),str) or not item['userImpact'].strip():raise ValueError('Failed checkpoint requires evidence-grounded user impact, not raw storage difference alone')

def condition_order(repeat):
 if type(repeat) is not int or repeat<1:raise ValueError('Positive pair repetition required')
 return ['baseline','lookout'] if repeat%2 else ['lookout','baseline']

@contextmanager
def serial_pair(lock_path=None):
 # Common across checkouts; this coordinates participating harnesses, not all host load.
 path=Path(lock_path) if lock_path is not None else Path(tempfile.gettempdir()).resolve()/f'lookout-communication-pair-{os.getuid()}.lock'
 with path.open('a') as lock:
  try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError:raise RuntimeError('Another revised communication pair is running; run pairs serially') from None
  try:yield
  finally:fcntl.flock(lock,fcntl.LOCK_UN)
