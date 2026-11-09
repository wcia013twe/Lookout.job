"""Fixed public-source search; no evaluator labels or future documents exposed."""
import re

def available(corpus,version):return [d for d in corpus['documents'] if d['releasedVersion']<=version]
def search(corpus,version,query,limit=8,cursor=None):
 if not isinstance(query,str) or not query.strip() or len(query)>500:raise ValueError('Nonempty query of at most 500 characters required')
 if type(limit) is not int or not 1<=limit<=10:raise ValueError('Limit must be 1–10')
 if cursor is not None and (not isinstance(cursor,str) or not cursor.isdigit()):raise ValueError('Invalid cursor')
 offset=int(cursor or 0)
 terms=set(re.findall(r'[a-z0-9]+',query.lower()));ranked=[]
 for d in available(corpus,version):
  title=set(re.findall(r'[a-z0-9]+',d['title'].lower()));body=set(re.findall(r'[a-z0-9]+',d['text'].lower()))
  score=3*len(terms&title)+len(terms&body)
  if score:ranked.append((score,d))
 ranked.sort(key=lambda x:(-x[0],x[1]['id']))
 return {'results':[{'id':d['id'],'title':d['title'],'url':d['url'],'publishedAt':d['publishedAt'],'snippet':d['text'][:240]} for _,d in ranked[offset:offset+limit]],'nextCursor':str(offset+limit) if offset+limit<len(ranked) else None}
def read_source(corpus,version,source_id):
 for d in available(corpus,version):
  if source_id in [d['id'],d['url']]:return {k:v for k,v in d.items() if k!='releasedVersion'}
 raise ValueError('Source not available')
