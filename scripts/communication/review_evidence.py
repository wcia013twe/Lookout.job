"""Require saved-state evidence for every reviewed durable checkpoint, including failures."""
def require_durable_evidence(item,stage_ids,condition):
 refs=[ref.split('#')[0] for ref in item['evidence']]
 for i in stage_ids:
  prefix=f'stage-{i}/'
  if condition=='lookout':valid=prefix+'after-state.json' in refs
  else:
   valid=any(ref.startswith(prefix+'output/') for ref in refs)
   if not item['pass']:valid=valid or prefix+'output-hashes.json' in refs
  if not valid:raise ValueError('Each durable checkpoint needs saved-state evidence, including negative judgments')
