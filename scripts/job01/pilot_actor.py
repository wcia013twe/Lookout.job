"""Fixed answers from released user facts only. Never knows expected job IDs."""
import re

def answer(question,stage_index,spec,root=None):
 if not isinstance(question,str) or not question.strip():raise ValueError('A question is required')
 if re.search(r'graduat|start date|start work|availability',question,re.I):
  return 'My saved profile lists May 2027 and July 2027 availability; my resume lists December 2027. That conflict has not been resolved. Flag timing as uncertain rather than certifying eligibility.','clarification'
 if re.search(r'citizen|clearance|export|US.person',question,re.I):
  return 'Citizenship, export-control status and clearance eligibility are not confirmed in my saved facts. Do not infer them from work authorization.','clarification'
 if re.search(r'\bsend\b|submit|approval|permission',question,re.I):
  return 'Only research, analysis and saving results are authorized. Do not send messages, fill forms or submit applications.','approval'
 if re.search(r'priorit|prefer|focus|style|format',question,re.I):
  released=[s['request'] for s in spec['stages'][:stage_index] if s['kind']=='user_update']
  return (' '.join(released) if released else 'Use the career and presentation preferences I supplied at onboarding.'),'context_restatement'
 return 'No additional facts are available. Preserve uncertainty and continue the authorized work where possible.','clarification'
