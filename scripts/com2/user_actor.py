"""Controlled answers use only facts already released; no hidden future help."""
import re

def answer(question,stage_index,spec):
 if not isinstance(question,str) or not question.strip():raise ValueError('A question is required')
 if not 1<=stage_index<=len(spec['stages']):raise ValueError('Unknown release index')
 released=spec['stages'][:stage_index]
 known={s['id']:s for s in released}
 if re.search(r'\bsent\b|did I send|have I sent|did.*reply|responded',question,re.I):
  if 'sent_report' in known:return known['sent_report']['request'],'context_restatement'
  return 'I have not reported sending any reply to these new messages. Leave drafts for review.','clarification'
 if re.search(r'\bsend\b|submit|permission|approval',question,re.I):
  return 'Do not send messages or submit anything. Leave messages as drafts; do not prepare interview materials.','approval'
 if re.search(r'start date|start work|earliest|when.*start|availability.*start',question,re.I):
  if 'start_date_answer' in known:return known['start_date_answer']['request'],'context_restatement'
  return 'I need to confirm my earliest start date. I will let you know shortly.','clarification'
 if re.search(r'availab|which time|what time|time.?zone|calendar|free on',question,re.I):
  if 'availability_answer' in known:return known['availability_answer']['request'],'context_restatement'
  return 'I use America/New_York time. I will check my calendar and send my availability shortly.','clarification'
 if re.search(r'completed|finished|interview.*happen',question,re.I):
  if 'screen_completed' in known:return known['screen_completed']['request'],'context_restatement'
  return 'I have not reported completing an interview.','clarification'
 if re.search(r'resume|background|experience|qualification',question,re.I):return 'Use my provided resume and initial background. I have no additional experience to add.','clarification'
 return spec['defaultAnswer'],'clarification'
