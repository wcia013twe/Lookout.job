import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,open} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';

const root=process.cwd(),artifacts=process.env.LOOKOUT_UI_ARTIFACTS||'/tmp/material-feedback-ui';
await mkdir(artifacts,{recursive:true});
const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const log=await open(join(artifacts,'server.log'),'w');
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',join(root,'next-app/out')],{stdio:['ignore',log.fd,log.fd]});
let browser;
try{
 const base=`http://127.0.0.1:${port}`;
 for(let attempt=0;attempt<50;attempt++){try{if((await fetch(base+'/career-toolkit/')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,200));}
 browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block',recordVideo:{dir:artifacts,size:{width:1280,height:900}}});
 const errors=[],writes=[];
 await context.route('**/*',async route=>{
  const request=route.request();if(request.url().startsWith(base))return route.continue();
  if(!['GET','HEAD'].includes(request.method()))writes.push(request.url());
  return route.fulfill({status:200,contentType:'application/json',body:'[]'});
 });
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
 const materialId='22222222-aaaa-4000-8000-222222222222';
 await page.goto(base+`/career-toolkit/?demo=1&artifact=${materialId}`);
 const feedback=page.getByRole('region',{name:'Material usefulness'});
 await feedback.getByText('Was this useful?',{exact:true}).waitFor();await feedback.scrollIntoViewIfNeeded();
 await feedback.getByRole('button',{name:'Yes',exact:true}).click();
 await feedback.getByText('Saved for this version',{exact:true}).waitFor();
 const note=feedback.getByRole('textbox');await note.fill('More examples and less setup, please.');
 await feedback.getByRole('button',{name:'Save note',exact:true}).click();await feedback.getByRole('button',{name:'Edit note',exact:true}).waitFor();
 await feedback.screenshot({path:join(artifacts,'feedback-desktop.png')});
 await page.getByText('Material details',{exact:true}).click();await page.getByRole('button',{name:'Archive',exact:true}).click();
 await page.getByText('Archived · still readable',{exact:true}).waitFor({state:'attached'});await feedback.getByText('Was this useful?',{exact:true}).waitFor();
 await page.getByText('Material details',{exact:true}).click();
 await page.getByLabel('Artifact revision').selectOption('1');await feedback.getByRole('button',{name:'Yes ✓',exact:true}).waitFor();
 assert.equal(await feedback.getByText('Was this useful?',{exact:true}).count(),0);
 await feedback.getByRole('button',{name:'Edit note',exact:true}).click();assert.equal(await note.inputValue(),'More examples and less setup, please.');
 await feedback.getByRole('button',{name:'Close',exact:true}).click();await feedback.getByRole('button',{name:'Not really',exact:true}).click();await feedback.getByRole('button',{name:'Not really ✓',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'light'});await feedback.scrollIntoViewIfNeeded();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await feedback.screenshot({path:join(artifacts,'feedback-mobile.png')});
 assert.deepEqual(writes,[],'Demo feedback called account services');assert.deepEqual(errors,[]);
 const video=page.video();await context.close();console.log(JSON.stringify({status:'passed',artifacts,video:await video.path(),checks:['one-click rating','optional note','saved state without repeated question','new version unrated','historical feedback retained','rating change','mobile overflow','demo isolation','no page errors']}));
}finally{await browser?.close();server.kill();await log.close();}
