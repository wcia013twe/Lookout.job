"""Authenticated HTTP-to-stdio transport shared by benchmark cases."""
import select,http.server,json,secrets,subprocess,threading
class WorkspaceBridge:
 def __init__(self,command,*,graceful_close=False):
  self.key=secrets.token_urlsafe(32);self.lock=threading.Lock()
  self.graceful_close=graceful_close
  self.proc=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True)
  owner=self
  class Handler(http.server.BaseHTTPRequestHandler):
   def log_message(self,*args):pass
   def do_POST(self):
    if self.path!='/mcp' or self.headers.get('Authorization')!='Bearer '+owner.key:self.send_error(403);return
    length=int(self.headers.get('Content-Length','0'))
    if not 0<length<1000000:self.send_error(413);return
    try:
     message=json.loads(self.rfile.read(length))
     if 'id' not in message:self.send_error(400);return
     with owner.lock:
      owner.proc.stdin.write(json.dumps(message)+'\n');owner.proc.stdin.flush()
      if not select.select([owner.proc.stdout],[],[],100)[0]:
       owner.proc.kill();raise TimeoutError('Workspace service deadline exceeded')
      reply=owner.proc.stdout.readline().encode()
      if not reply:raise RuntimeError('Workspace service exited')
     self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(reply)));self.end_headers();self.wfile.write(reply)
    except Exception:self.send_error(502)
  self.server=http.server.ThreadingHTTPServer(('0.0.0.0',0),Handler)
  self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
  self.url='http://host.docker.internal:'+str(self.server.server_port)+'/mcp'
 def close(self):
  self.server.daemon_threads=True;self.server.shutdown();self.server.server_close()
  if self.graceful_close:
   if self.proc.stdin:self.proc.stdin.close()
  else:self.proc.terminate()
  try:self.proc.wait(timeout=15 if self.graceful_close else 3)
  except subprocess.TimeoutExpired:self.proc.kill();self.proc.wait()
