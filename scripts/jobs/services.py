"""Durable, fictional JOB03 test-clock and interrupted-preview services, shared equally."""
import contextlib,datetime,json,sqlite3,uuid
from pathlib import Path

def stamp(value):
 d=datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
 if d.tzinfo is None:raise ValueError('An exact offset is required')
 return d.timestamp()

class Services:
 def __init__(self,file):
  self.file=Path(file);self.file.parent.mkdir(parents=True,exist_ok=True)
  with self.db() as db:
   db.execute('CREATE TABLE IF NOT EXISTS reminders (id TEXT PRIMARY KEY, key TEXT UNIQUE, application TEXT, due TEXT, zone TEXT, state TEXT, delivery TEXT)')
   db.execute('CREATE TABLE IF NOT EXISTS previews (application TEXT PRIMARY KEY, fields TEXT, pending TEXT, armed TEXT, failures INTEGER)')
  self.file.chmod(0o600)
 @contextlib.contextmanager
 def db(self):
  db=sqlite3.connect(self.file);db.row_factory=sqlite3.Row
  try:
   with db:yield db
  finally:db.close()
 def schedule(self,key,applicationId,dueAt,timeZone):
  from zoneinfo import ZoneInfo
  stamp(dueAt);ZoneInfo(timeZone)
  with self.db() as db:
   old=db.execute('SELECT * FROM reminders WHERE key=?',(key,)).fetchone()
   if old:
    if (old['application'],old['due'],old['zone'])!=(applicationId,dueAt,timeZone):raise ValueError('Reminder key collision')
    return {**self.reminder(dict(old)),'duplicate':True}
   ident=str(uuid.uuid4());db.execute('INSERT INTO reminders VALUES (?,?,?,?,?,?,NULL)',(ident,key,applicationId,dueAt,timeZone,'scheduled'))
  return self.read(ident)
 def reminder(self,row):return dict(reminderId=row['id'],key=row['key'],applicationId=row['application'],dueAt=row['due'],timeZone=row['zone'],state=row['state'],deliveryReceiptId=row['delivery'],deliveryCount=int(row['delivery'] is not None))
 def read(self,reminderId=None):
  with self.db() as db:
   rows=db.execute('SELECT * FROM reminders'+(' WHERE id=?' if reminderId else '')+' ORDER BY key', (reminderId,) if reminderId else ()).fetchall()
  if reminderId and not rows:raise ValueError('Unknown reminder')
  return self.reminder(dict(rows[0])) if reminderId else [self.reminder(dict(r)) for r in rows]
 def cancel(self,reminderId):
  self.read(reminderId)
  with self.db() as db:db.execute("UPDATE reminders SET state='cancelled' WHERE id=?",(reminderId,))
  return self.read(reminderId)
 def deliver(self,now):
  due=[]
  with self.db() as db:
   for row in db.execute("SELECT * FROM reminders WHERE state='scheduled'").fetchall():
    if stamp(now)>=stamp(row['due']):
     receipt=str(uuid.uuid4());db.execute("UPDATE reminders SET state='delivered',delivery=? WHERE id=? AND state='scheduled'",(receipt,row['id']));due.append({**self.reminder(dict(row)),'state':'delivered','deliveryReceiptId':receipt,'deliveryCount':1})
  return due
 def arm(self,applicationId,eventKey):
  with self.db() as db:
   r=db.execute('SELECT armed,failures FROM previews WHERE application=?',(applicationId,)).fetchone()
   if not r:raise ValueError('Unknown saved preparation')
   if r['armed'] or r['failures']:raise ValueError('Failure already armed/consumed; no silent replay')
   db.execute('UPDATE previews SET armed=? WHERE application=?',(eventKey,applicationId))
  return {'armed':True,'eventKey':eventKey}
 def preview(self,applicationId,answers=None):
  with self.db() as db:
   row=db.execute('SELECT * FROM previews WHERE application=?',(applicationId,)).fetchone()
   if not row:raise ValueError('Unknown saved preparation')
   fields=json.loads(row['fields']);fields.update(answers or {})
   db.execute('UPDATE previews SET fields=? WHERE application=?',(json.dumps(fields),applicationId))
   if row['armed']:
    db.execute('UPDATE previews SET armed=NULL,failures=failures+1 WHERE application=?',(applicationId,))
    return {'status':'preview_timeout','savedFields':fields,'pendingField':row['pending'],'failureKey':row['armed'],'submitted':False}
   return {'status':'prepared' if fields.get('earliest-start-date') else 'saved_partial','savedFields':fields,'pendingField':None if fields.get('earliest-start-date') else row['pending'],'submitted':False}
 def seed(self,jobs):
  with self.db() as db:
   if db.execute('SELECT count(*) FROM reminders').fetchone()[0] or db.execute('SELECT count(*) FROM previews').fetchone()[0]:raise ValueError('Service already seeded; preserve evidence')
  for key,job in jobs.items():
   if job.get('reminder'):self.schedule(applicationId=key,**{k:v for k,v in job['reminder'].items() if k in ['key','dueAt','timeZone']})
   if job.get('preparation'):
    with self.db() as db:db.execute('INSERT INTO previews VALUES (?,?,?,NULL,0)',(key,json.dumps(dict.fromkeys(job['preparation']['completedFields'],'saved')),job['preparation']['pendingField']))
 def snapshot(self):
  with self.db() as db:previews=[dict(x) for x in db.execute('SELECT * FROM previews ORDER BY application')]
  return {'reminders':self.read(),'previews':previews,'service':'fictional-local-test-clock; not a Lookout scheduler or employer form'}
