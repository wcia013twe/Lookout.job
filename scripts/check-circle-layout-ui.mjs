// Optional browser check against the isolated in-memory Circle preview.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.LOOKOUT_PLAYWRIGHT_MODULE||'../runner/node_modules/playwright/index.mjs');
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/lookout-circle-layout';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 for(const [name,width,height,colorScheme] of [['desktop',1440,1000,'dark'],['mobile',390,844,'light']]){
  const context=await browser.newContext({viewport:{width,height},colorScheme,serviceWorkers:'block'});
  const page=await context.newPage();const errors=[];page.setDefaultTimeout(12000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/same key|unique.*key/i.test(m.text()))errors.push(m.text());});
  await context.route('**/rest/v1/**',route=>route.abort());
  await context.route('**/functions/v1/**',route=>route.abort());
  await page.goto((process.env.LOOKOUT_UI_URL||'http://127.0.0.1:3063')+'/circles/preview/?circle=demo-circle');
  const room=page.getByRole('region',{name:'The cloud cottage',exact:true});
  const feed=page.getByRole('region',{name:'Shared Circle updates',exact:true});
  const chat=page.getByRole('complementary',{name:'Circle chat',exact:true});
  await room.waitFor();await feed.waitFor();await chat.waitFor();
  assert.equal(await page.getByRole('region',{name:'Trophy room',exact:true}).count(),0);
  const r=await room.boundingBox(),f=await feed.boundingBox(),c=await chat.boundingBox();
  assert(r.y+r.height<=f.y,'Room precedes feed');
  if(width>900){assert(c.x>f.x+f.width,'Chat sits to right of feed');assert(Math.abs(c.y-f.y)<120,'Feed and chat start together');}
  else{assert(c.y>f.y,'Chat stacks after feed');await page.getByRole('link',{name:'Jump to chat',exact:true}).waitFor();}
  await feed.getByText('Submitted 3 applications',{exact:true}).waitFor();
  assert.equal(await chat.getByText('Submitted 3 applications',{exact:true}).count(),0);
  await feed.getByText('AI-drafted',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await room.screenshot({path:`${dir}/${name}-room.png`});
  await feed.locator('..').locator('..').screenshot({path:`${dir}/${name}-updates-chat.png`});
  await page.getByRole('button',{name:'Trophy room',exact:true}).click();
  const trophies=page.getByRole('region',{name:'Trophy room',exact:true});await trophies.waitFor();
  await trophies.getByRole('button',{name:'NVIDIA offer: what should I clarify before accepting?',exact:true}).waitFor();
  assert.equal(await trophies.getByText('Submitted 3 applications',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Back to updates',exact:true}).click();await feed.waitFor();
  await page.getByRole('button',{name:'Write an update',exact:true}).click();
  await page.getByRole('button',{name:'Close update',exact:true}).waitFor();
  await page.getByRole('button',{name:'Close update',exact:true}).click();
  await feed.getByRole('button',{name:'Alex is locked in today',exact:true}).click();
  await page.getByRole('heading',{name:'Alex is locked in today',exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log(`${name}: room-first layout, feed/chat placement, optional milestones, composer, thread, labels and console passed`);
  await context.close();
 }
}finally{await browser.close();}
