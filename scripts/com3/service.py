import json,os,sys,urllib.request
for line in sys.stdin:
 try:
  obj=json.loads(line)
  if 'id' not in obj:continue
  req=urllib.request.Request(os.environ['WORKSPACE_SERVICE_URL'],data=line.encode(),headers={'Authorization':'Bearer '+os.environ['WORKSPACE_SERVICE_KEY'],'Content-Type':'application/json'})
  with urllib.request.urlopen(req,timeout=95) as r:print(r.read().decode(),flush=True)
 except Exception as e:print(json.dumps({'jsonrpc':'2.0','id':obj.get('id'),'error':{'code':-32603,'message':type(e).__name__}}),flush=True)
