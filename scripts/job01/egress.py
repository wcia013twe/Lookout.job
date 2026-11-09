"""Container gateway: allowlisted TLS inference and one host-side MCP bridge only."""
import http.server,os,select,socket,urllib.request
ALLOWED={'chatgpt.com','auth.openai.com','api.openai.com'}
class Handler(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_CONNECT(self):
  host,_,port=self.path.rpartition(':')
  if host not in ALLOWED or port!='443':self.send_error(403);return
  try:up=socket.create_connection((host,443),timeout=20)
  except OSError:self.send_error(502);return
  self.send_response(200,'Connection established');self.end_headers()
  try:
   while True:
    ready,_,_=select.select([self.connection,up],[],[],45)
    if not ready:break
    for source in ready:
     data=source.recv(65536)
     if not data:return
     (up if source is self.connection else self.connection).sendall(data)
  finally:up.close()
 def do_GET(self):self.send_error(403)
 def do_POST(self):
  if self.path!='/mcp':self.send_error(403);return
  size=int(self.headers.get('Content-Length','0'))
  if not 0<size<1000000:self.send_error(413);return
  try:
   req=urllib.request.Request(os.environ['BRIDGE_URL'],data=self.rfile.read(size),headers={'Content-Type':'application/json','Authorization':self.headers.get('Authorization','')})
   with urllib.request.urlopen(req,timeout=100) as response:body=response.read()
   self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
  except Exception:self.send_error(502)
if __name__=='__main__':http.server.ThreadingHTTPServer(('0.0.0.0',8787),Handler).serve_forever()
