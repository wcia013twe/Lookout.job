"""Build matching editable diagrams.net, SVG and vector PDF from one geometry model.
Run with Python + reportlab. No network, application imports, or account access.
"""
from pathlib import Path
from xml.etree import ElementTree as ET
from html import escape
from math import hypot
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase.pdfmetrics import stringWidth
import json

OUT=Path(__file__).resolve().parent
W,H=1800,1000
INK='#263442'; MUTED='#4a5662'; LINE='#596671'
PALETTE={'human':('#faf8f5','#8b775f'),'agent':('#f5f8fb','#57758e'),'mcp':('#f6f9f5','#657d61'),'workspace':('#f8f6fb','#77678c'),'infra':('#f8f9fa','#78818a')}
items=[]; regions={}; nodes={}; arrows=[]
def region(id,x,y,w,h,label,key):
 fill,stroke=PALETTE[key];regions[id]=(x,y,w,h)
 items.append(dict(kind='rect',id=id,parent='1',x=x,y=y,w=w,h=h,fill=fill,stroke=stroke,width=1.8,round=12))
 txt(id+'-label',x+22,y+36,label,26,True,parent=id)
def rect(id,x,y,w,h,parent,fill='#ffffff',stroke=LINE,round=8,dash=False):
 items.append(dict(kind='rect',id=id,parent=parent,x=x,y=y,w=w,h=h,fill=fill,stroke=stroke,width=1.6,round=round,dash=dash));nodes[id]=(x,y,w,h)
def txt(id,x,y,text,size=24,bold=False,parent='1',color=INK,anchor='start'):
 items.append(dict(kind='text',id=id,parent=parent,x=x,y=y,text=text,size=size,bold=bold,color=color,anchor=anchor))
def line(id,points,parent='1',width=1.6,color=LINE,dash=False):
 items.append(dict(kind='line',id=id,parent=parent,points=points,width=width,color=color,dash=dash))
def circle(id,cx,cy,r,parent='1'):
 items.append(dict(kind='circle',id=id,parent=parent,cx=cx,cy=cy,r=r,fill='#ffffff',stroke=LINE,width=1.7))
def icon(kind,x,y,parent):
 def ln(s,pts):line(parent+'-icon-'+s,[(x+a,y+b) for a,b in pts],parent)
 if kind=='person':
  circle(parent+'-head',x+17,y+8,7,parent);ln('body',[(17,15),(17,35)]);ln('arms',[(3,24),(17,18),(31,24)]);ln('legs',[(5,44),(17,35),(29,44)])
 elif kind=='browser':
  rect(parent+'-window',x,y,36,29,parent,round=2);ln('bar',[(0,8),(36,8)]);circle(parent+'-dot',x+5,y+4,1.2,parent)
 elif kind=='agent':
  for s,cx,cy in [('a',5,15),('b',28,5),('c',28,27)]:circle(parent+'-node-'+s,x+cx,y+cy,5,parent)
  ln('links',[(9,12),(23,7)]);ln('link2',[(9,18),(23,25)]);ln('link3',[(28,10),(28,22)])
 elif kind=='shield':ln('shield',[(17,0),(33,6),(31,23),(17,35),(3,23),(1,6),(17,0)]);ln('check',[(9,16),(15,22),(25,11)])
 elif kind=='database':
  items.append(dict(kind='cylinder',id=parent+'-cylinder',parent=parent,x=x,y=y,w=34,h=32))
 elif kind=='queue':
  for i in range(3):rect(parent+'-q'+str(i),x,y+i*10,33,6,parent,round=1)
 elif kind=='document':ln('page',[(0,0),(23,0),(33,10),(33,34),(0,34),(0,0)]);ln('fold',[(23,0),(23,10),(33,10)]);ln('text',[(7,18),(26,18)]);ln('text2',[(7,25),(23,25)])
 elif kind=='terminal':rect(parent+'-term',x,y,36,28,parent,round=2);ln('prompt',[(6,8),(12,13),(6,18)]);ln('cursor',[(17,19),(27,19)])
def arrow(id,source,target,points,label='',lx=0,ly=0,dash=False,both=False):
 arrows.append(dict(id=id,source=source,target=target,points=points,label=label,lx=lx,ly=ly,dash=dash,both=both))

txt('title',40,39,'Lookout architecture',32,True)
region('human',40,75,270,835,'Human','human')
region('agent',350,75,360,835,'Personal Agent','agent')
region('interface',750,75,290,450,'Lookout Interface','mcp')
region('workspace',1080,75,680,450,'Lookout Workspace','workspace')
region('infrastructure',750,610,1010,300,'Infrastructure','infra')

rect('user',65,145,220,155,'human',fill='#faecd9');icon('person',80,165,'user')
txt('user-title',125,183,'User',30,True,'user')
txt('user-t0',80,244,'Preferences',26,parent='user')
rect('web',65,365,220,185,'human',fill='#faecd9');icon('browser',80,383,'web')
txt('web-title',126,406,'Web UI',29,True,'web')
txt('web-t0',80,464,'Review and edit',26,parent='web')
txt('web-t1',80,506,'Approve / resolve',24,parent='web')

rect('reason',375,145,310,205,'agent',fill='#e5eef8');icon('agent',392,162,'reason')
txt('reason-title',440,186,'External agent',28,True,'reason')
txt('reason-t0',392,240,'Reasoning + planning',26,parent='reason')
txt('reason-t1',392,286,'Private personal context',24,parent='reason')
rect('host',375,645,310,205,'agent',fill='#e5eef8',dash=True);icon('terminal',392,664,'host')
txt('host-title',440,689,'Agent host',29,True,'host')
txt('host-t0',392,745,'Native schedules',26,parent='host')
txt('host-t1',392,790,'Optional polling + wake',24,parent='host')

rect('mcp',775,145,240,205,'interface');icon('terminal',790,162,'mcp')
txt('mcp-title',837,186,'MCP',29,True,'mcp')
# Inner bands are editable labels within one interface, not services.
for id,y,label,fill in [('tools',208,'Tools','#f9e4d9'),('context',254,'Context','#e1efdc'),('guides',300,'Guides','#deedf5')]:
 rect('mcp-band-'+id,790,y,210,38,'mcp',fill=fill,stroke=fill,round=5)
 txt('mcp-t-'+id,895,y+28,label,26,parent='mcp',anchor='middle')
txt('mcp-note1',775,407,'Auth + scopes',25,True,'interface')

rect('capabilities',1105,145,630,220,'workspace')
txt('cap-title',1126,182,'Career workflows',29,True,'capabilities')
for id,x,label in [('discover',1126,'Discover'),('apply',1430,'Applications')]:
 rect('cap-band-'+id,x,200,285,48,'capabilities',fill='#f9e4d9',stroke='#f9e4d9',round=5)
 txt('cap-t-'+id,x+142.5,233,label,28,parent='capabilities',anchor='middle')
rect('cap-band-review',1126,264,589,48,'capabilities',fill='#e9e1f3',stroke='#e9e1f3',round=5)
txt('cap-t-review',1420,297,'Action Board: review + resolve',28,True,'capabilities',anchor='middle')
txt('cap-t-other',1126,346,'Network + Career Toolkit',25,parent='capabilities')
rect('domain',1105,405,630,92,'workspace',fill='#deedf5');icon('shield',1124,424,'domain')
txt('domain-title',1174,440,'Shared state + policy',29,True,'domain')
txt('domain-sub',1174,477,'Preferences / approvals / progress',26,parent='domain')

rect('worker',775,665,285,90,'infrastructure',fill='#edf0f3');icon('queue',789,683,'worker')
txt('worker-title',835,701,'Workers',28,True,'worker');txt('worker-sub',789,735,'Queued execution',25,parent='worker')
rect('db',1110,665,310,90,'infrastructure',fill='#edf0f3');icon('database',1125,684,'db')
txt('db-title',1173,701,'Postgres',28,True,'db');txt('db-sub',1125,735,'Workflow state',25,parent='db')
rect('storage',1470,665,265,90,'infrastructure',fill='#edf0f3');icon('document',1484,679,'storage')
txt('storage-title',1530,701,'Private files',27,True,'storage');txt('storage-sub',1484,735,'Resumes + documents',23,parent='storage')
rect('browser',775,800,285,90,'infrastructure',fill='#edf0f3');icon('browser',789,818,'browser')
txt('browser-title',835,837,'Browser runner',26,True,'browser');txt('browser-sub',789,870,'Inspect / fill / submit',25,parent='browser')
rect('employer',1470,800,265,90,'infrastructure',fill='#edf0f3');icon('browser',1484,818,'employer')
txt('employer-title',1530,837,'External sites',25,True,'employer');txt('employer-sub',1484,870,'Postings + forms',25,parent='employer')

arrow('A1','user','web',[(175,300),(175,365)])
arrow('A2','user','reason',[(285,222),(375,222)],'Goals',330,207,both=True)
arrow('B1','reason','mcp',[(685,268),(775,268)],'5 Resume',730,252,both=True)
arrow('B2','mcp','capabilities',[(1015,268),(1105,268)],'Tools',1060,252,both=True)
arrow('A3','web','domain',[(285,465),(1105,465)],'1 Review / edit',865,487)
arrow('D1','domain','db',[(1280,497),(1280,665)],'2 Persist',1280,571,both=True)
arrow('D2','domain','storage',[(1605,497),(1605,665)],both=True)
arrow('E1','domain','worker',[(1150,497),(1150,540),(918,540),(918,665)],'Queue',920,589,dash=True)
arrow('E2','worker','browser',[(918,755),(918,800)])
arrow('F1','browser','employer',[(1060,845),(1470,845)],'Inspect / submit',1265,831,both=True)
# Polling coordination, not server push or a direct database subscription.
arrow('G1','domain','host',[(1105,450),(1088,450),(1088,570),(730,570),(730,742),(685,742)],'3 Poll changes',700,554,dash=True)
arrow('G2','host','reason',[(375,700),(360,700),(360,328),(375,328)],'4 Wake',440,594,dash=True)
txt('resume-note1',392,398,'Resume from saved state',25,True,'agent')

line('legend-solid',[(45,947),(110,947)],width=2)
txt('legend-solid-label',124,955,'Calls / results',26)
line('legend-dash',[(750,947),(815,947)],width=2,dash=True)
txt('legend-dash-label',830,955,'Polling / queued work',26)
txt('footnote',45,987,'Logical capabilities, not separate services. Optional wake requires an agent-host integration.',24,color=MUTED)

# Shared vector rendering: PDF and SVG use the same text baselines and paths.
svg=[]
svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="fig-title fig-desc">')
svg.append('<title id="fig-title">Lookout architecture</title><desc id="fig-desc">Human edits and approvals persist in the workspace. An optional polling watcher wakes the external personal agent, which resumes through scoped MCP reads. Workspace capabilities are logical modules.</desc>')
svg.append('<rect width="100%" height="100%" fill="white"/>')
pdf=canvas.Canvas(str(OUT/'lookout-architecture.pdf'),pagesize=(W,H),pageCompression=1)
pdf.setTitle('Lookout architecture');pdf.setAuthor('Lookout project');pdf.setFillColor(HexColor('#ffffff'));pdf.rect(0,0,W,H,stroke=0,fill=1)

def path(points,color=LINE,width=2,dash=False):
 svg.append('<polyline points="'+ ' '.join(f'{x},{y}' for x,y in points)+f'" fill="none" stroke="{color}" stroke-width="{width}"'+(' stroke-dasharray="9 6"' if dash else '')+'/>')
 pdf.setStrokeColor(HexColor(color));pdf.setLineWidth(width);pdf.setDash([9,6] if dash else []);p=pdf.beginPath();p.moveTo(points[0][0],H-points[0][1])
 for x,y in points[1:]:p.lineTo(x,H-y)
 pdf.drawPath(p);pdf.setDash([])
def text_render(i,bg=False):
 x,y,t,sz=i['x'],i['y'],i['text'],i['size'];font='Helvetica-Bold' if i['bold'] else 'Helvetica';tw=stringWidth(t,font,sz)
 if i['anchor']=='middle':x-=tw/2
 if bg:
  svg.append(f'<rect x="{x-5}" y="{y-sz}" width="{tw+10}" height="{sz+6}" fill="white"/>');pdf.setFillColor(HexColor('#ffffff'));pdf.rect(x-5,H-y-6,tw+10,sz+6,stroke=0,fill=1)
 svg.append(f'<text x="{x}" y="{y}" font-family="Arial, Helvetica, sans-serif" font-size="{sz}" font-weight="{700 if i["bold"] else 400}" fill="{i["color"]}">{escape(t)}</text>')
 pdf.setFont(font,sz);pdf.setFillColor(HexColor(i['color']));pdf.drawString(x,H-y,t)
for i in items:
 k=i['kind']
 if k=='text':continue
 if k=='rect':
  x,y,w,h=i['x'],i['y'],i['w'],i['h'];svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{i["round"]}" fill="{i["fill"]}" stroke="{i["stroke"]}" stroke-width="{i["width"]}"'+(' stroke-dasharray="9 6"' if i.get('dash') else '')+'/>');pdf.setFillColor(HexColor(i['fill']));pdf.setStrokeColor(HexColor(i['stroke']));pdf.setLineWidth(i['width']);pdf.setDash([9,6] if i.get('dash') else []);pdf.roundRect(x,H-y-h,w,h,i['round'],stroke=1,fill=1);pdf.setDash([])
 elif k=='cylinder':
  x,y,w,h=i['x'],i['y'],i['w'],i['h'];path([(x,y+5),(x,y+h-5)],LINE,1.7);path([(x+w,y+5),(x+w,y+h-5)],LINE,1.7)
  for cy in [y+5,y+h-5]:
   svg.append(f'<ellipse cx="{x+w/2}" cy="{cy}" rx="{w/2}" ry="5" fill="white" stroke="{LINE}" stroke-width="1.7"/>');pdf.setFillColor(HexColor('#ffffff'));pdf.setStrokeColor(HexColor(LINE));pdf.ellipse(x,H-cy-5,x+w,H-cy+5,stroke=1,fill=1)
 elif k=='circle':
  svg.append(f'<circle cx="{i["cx"]}" cy="{i["cy"]}" r="{i["r"]}" fill="{i["fill"]}" stroke="{i["stroke"]}" stroke-width="{i["width"]}"/>');pdf.setFillColor(HexColor(i['fill']));pdf.setStrokeColor(HexColor(i['stroke']));pdf.setLineWidth(i['width']);pdf.circle(i['cx'],H-i['cy'],i['r'],stroke=1,fill=1)
 else:path(i['points'],i['color'],i['width'],i['dash'])
for a in arrows:
 # White under-stroke makes any unavoidable orthogonal crossings legible.
 path(a['points'],'#ffffff',7)
 path(a['points'],LINE,2,a['dash'])
 def tip(p,q):
  dx,dy=p[0]-q[0],p[1]-q[1];n=hypot(dx,dy);ux,uy=dx/n,dy/n;pts=[p,(p[0]-11*ux-4*uy,p[1]-11*uy+4*ux),(p[0]-11*ux+4*uy,p[1]-11*uy-4*ux),p];path(pts,LINE,1.7)
 tip(a['points'][-1],a['points'][-2])
 if a['both']:tip(a['points'][0],a['points'][1])
for i in items:
 if i['kind']=='text':text_render(i)
for a in arrows:
 if a['label']:text_render(dict(x=a['lx'],y=a['ly'],text=a['label'],size=21,bold=False,color=INK,anchor='middle'),True)
svg.append('</svg>');pdf.showPage();pdf.save()

# Native mxGraph objects: containers, editable labels/icons and connected edges.
mx=ET.Element('mxfile',host='app.diagrams.net',agent='Lookout figure generator',version='24.7.17');dia=ET.SubElement(mx,'diagram',id='lookout-architecture',name='Lookout architecture');model=ET.SubElement(dia,'mxGraphModel',dx=str(W),dy=str(H),grid='1',gridSize='10',guides='1',tooltips='1',connect='1',arrows='1',fold='1',page='1',pageScale='1',pageWidth=str(W),pageHeight=str(H),math='0',shadow='0');root=ET.SubElement(model,'root');ET.SubElement(root,'mxCell',id='0');ET.SubElement(root,'mxCell',id='1',parent='0')
allrect={i['id']:(i['x'],i['y']) for i in items if i['kind']=='rect'}
def origin(parent):return allrect.get(parent,(0,0))
for i in items:
 k=i['kind'];parent=i['parent'];ox,oy=origin(parent)
 if k=='rect':
  style=f'rounded=1;arcSize=8;whiteSpace=wrap;html=0;fillColor={i["fill"]};strokeColor={i["stroke"]};strokeWidth={i["width"]};container=1;collapsible=0;'+('dashed=1;dashPattern=9 6;' if i.get('dash') else '')
  c=ET.SubElement(root,'mxCell',id=i['id'],value='',style=style,vertex='1',parent=parent);ET.SubElement(c,'mxGeometry',x=str(i['x']-ox),y=str(i['y']-oy),width=str(i['w']),height=str(i['h']),attrib={'as':'geometry'})
 elif k=='text':
  tw=stringWidth(i['text'],'Helvetica-Bold' if i['bold'] else 'Helvetica',i['size'])+5
  x=i['x']-(tw/2 if i['anchor']=='middle' else 0)
  c=ET.SubElement(root,'mxCell',id=i['id'],value=i['text'],style=f'text;html=0;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;whiteSpace=nowrap;fontFamily=Helvetica;fontSize={i["size"]};fontColor={i["color"]};fontStyle={1 if i["bold"] else 0};spacing=0;',vertex='1',parent=parent)
  ET.SubElement(c,'mxGeometry',x=str(x-ox),y=str(i['y']-i['size']-oy+2),width=str(tw),height=str(i['size']+4),attrib={'as':'geometry'})
 elif k=='cylinder':
  c=ET.SubElement(root,'mxCell',id=i['id'],value='',style=f'shape=cylinder;html=0;fillColor=#ffffff;strokeColor={LINE};strokeWidth=1.7;',vertex='1',parent=parent);ET.SubElement(c,'mxGeometry',x=str(i['x']-ox),y=str(i['y']-oy),width=str(i['w']),height=str(i['h']),attrib={'as':'geometry'})
 elif k=='circle':
  c=ET.SubElement(root,'mxCell',id=i['id'],value='',style=f'ellipse;html=0;fillColor={i["fill"]};strokeColor={i["stroke"]};strokeWidth={i["width"]};',vertex='1',parent=parent);ET.SubElement(c,'mxGeometry',x=str(i['cx']-i['r']-ox),y=str(i['cy']-i['r']-oy),width=str(i['r']*2),height=str(i['r']*2),attrib={'as':'geometry'})
 else:
  c=ET.SubElement(root,'mxCell',id=i['id'],value='',style=f'endArrow=none;strokeColor={i["color"]};strokeWidth={i["width"]};'+('dashed=1;' if i['dash'] else ''),edge='1',parent=parent);g=ET.SubElement(c,'mxGeometry',relative='1',attrib={'as':'geometry'})
  for name,(x,y) in zip(['sourcePoint','targetPoint'],[i['points'][0],i['points'][-1]]):ET.SubElement(g,'mxPoint',x=str(x-ox),y=str(y-oy),attrib={'as':name})
  if len(i['points'])>2:
   arr=ET.SubElement(g,'Array',attrib={'as':'points'})
   for x,y in i['points'][1:-1]:ET.SubElement(arr,'mxPoint',x=str(x-ox),y=str(y-oy))
for a in arrows:
 st=f'edgeStyle=orthogonalEdgeStyle;rounded=0;html=0;endArrow=block;endFill=0;startArrow={"block" if a["both"] else "none"};startFill=0;strokeWidth=2;strokeColor={LINE};jumpStyle=arc;jumpSize=8;'
 if a['dash']:st+='dashed=1;dashPattern=9 6;'
 for prefix,point,node in [('exit',a['points'][0],a['source']),('entry',a['points'][-1],a['target'])]:
  x,y,w,h=nodes[node];st+=f'{prefix}X={(point[0]-x)/w};{prefix}Y={(point[1]-y)/h};{prefix}Dx=0;{prefix}Dy=0;'
 c=ET.SubElement(root,'mxCell',id=a['id'],value='',style=st,edge='1',parent='1',source=a['source'],target=a['target']);g=ET.SubElement(c,'mxGeometry',relative='1',attrib={'as':'geometry'})
 if len(a['points'])>2:
  arr=ET.SubElement(g,'Array',attrib={'as':'points'})
  for x,y in a['points'][1:-1]:ET.SubElement(arr,'mxPoint',x=str(x),y=str(y))
 if a['label']:
  tw=stringWidth(a['label'],'Helvetica',21)+12
  c=ET.SubElement(root,'mxCell',id=a['id']+'-label',value=a['label'],style=f'text;html=0;fillColor=#ffffff;strokeColor=none;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=21;fontColor={INK};spacing=0;',vertex='1',parent='1');ET.SubElement(c,'mxGeometry',x=str(a['lx']-tw/2),y=str(a['ly']-22),width=str(tw),height='27',attrib={'as':'geometry'})
ET.indent(mx);xml=ET.tostring(mx,encoding='unicode');(OUT/'lookout-architecture.drawio').write_text('<?xml version="1.0" encoding="UTF-8"?>\n'+xml+'\n')
# Embed the editable native source in the SVG as diagrams.net metadata too.
svg[0]=svg[0].replace(' role=',f' content="{escape(ET.tostring(mx,encoding="unicode"),quote=True)}" role=')
(OUT/'lookout-architecture.svg').write_text('\n'.join(svg)+'\n')
# Quiet structural checks; no claim of a diagrams.net editor round-trip.
ids=[c.get('id') for c in root];assert len(ids)==len(set(ids));idset=set(ids)
for c in root:
 for key in ['parent','source','target']:
  if c.get(key):assert c.get(key) in idset
for i in items:
 if i['kind']=='text' and i['parent'] in nodes:
  x,y,w,h=nodes[i['parent']];tw=stringWidth(i['text'],'Helvetica-Bold' if i['bold'] else 'Helvetica',i['size']);
  assert i['x']+tw/(2 if i['anchor']=='middle' else 1)<=x+w+2,(i['id'],'text exceeds box')
print(json.dumps({'components':12,'boundaries':len(regions),'arrows':len(arrows),'editableCells':len(ids),'canvas':[W,H]}))
