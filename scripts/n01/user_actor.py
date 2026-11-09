"""Fixed answers grounded only in already-released scenario facts. No hidden grading hints."""
import re

def answer(question,stage_index,spec):
 if not isinstance(question,str) or not question.strip():raise ValueError('A question is required')
 if re.search(r'\bsend\b|submit|permission|approval',question,re.I):
  return 'Do not send messages or submit anything. Leave drafts for me to review.','approval'
 if re.search(r'priorit|prefer|direction|career goal|focus|interest',question,re.I):
  known=[s['request'] for s in spec['stages'][:stage_index] if s['kind']=='user_update']
  return (known[-1] if known else 'My initial networking preference is inference systems first and backend developer-platform teams second.'),'context_restatement'
 if re.search(r'\bDana\b|\bIvo\b',question,re.I):
  return 'Dana works on inference systems. Ivo works on developer platform infrastructure. I want to understand their work; neither has promised me a referral.','context_restatement'
 if re.search(r'\bLena\b|\bSam\b',question,re.I):
  return 'Do not contact Lena again. Keep my unrelated relationship with Sam unchanged.','context_restatement'
 for rule in spec['userAnswers']:
  if re.search(rule['pattern'],question,re.I):return rule['answer'],rule['category']
 return spec['defaultAnswer'],'clarification'
