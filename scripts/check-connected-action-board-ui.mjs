import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.LOOKOUT_UI_URL||'http://localhost:3107';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Use an isolated local preview.');
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/tmp/connected-action-board-ui';await mkdir(dir,{recursive:true});
const browser=await chromium.launch();const errors=[];
const attach=page=>{page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\/(rest|functions)\/v1\//.test(r.url()))errors.push('Detached demo attempted backend access');});};
const path='/needs-you/?demo=1&demoApi=action-board';
const card=(page,kind)=>page.locator(`.action-board-row[data-kind="${kind}"]`);
const accept=row=>row.getByRole('button',{name:/^Accept:/});
const reject=row=>row.getByRole('button',{name:/^Reject:/});
try{
 const desktop=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await desktop.newPage();attach(page);
 await page.goto(base+path);const application=card(page,'review_application').first();await application.waitFor();
 const left=await page.locator('.needs-you-priority').boundingBox(),right=await page.locator('.prep-widget').boundingBox();assert(right.x>=left.x+left.width,'Desktop keeps its two columns');
 for(const row of await page.locator('.action-board-row[data-kind]').all()){assert.equal(await accept(row).count(),1);assert.equal(await reject(row).count(),1);assert(await row.locator('a').first().innerText());}
 assert.equal(await page.getByText('Imported',{exact:true}).count(),0);
 const phoneContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),phone=await phoneContext.newPage();attach(phone);await phone.goto(base+path);await card(phone,'review_application').first().waitFor();
 assert(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
 if(process.env.LOOKOUT_UI_CAPTURE!=='0'){await page.screenshot({path:`${dir}/desktop.png`,fullPage:true});await phone.screenshot({path:`${dir}/mobile.png`,fullPage:true});}
 assert(await accept(application).isDisabled());await application.getByRole('checkbox',{name:'I reviewed this exact application revision.'}).click();await accept(application).waitFor();await page.waitForFunction(()=>{const row=document.querySelector('[data-kind="review_application"]');return !row?.querySelector('button[aria-label^="Accept:"]')?.disabled;},null,{timeout:10000});await accept(application).focus();await accept(application).press('Enter');await page.getByText('This version is approved. It has not been submitted.',{exact:true}).waitFor();
 const blocker=card(page,'resolve_blocker').filter({hasText:'Your start date is needed'});assert(await accept(blocker).isDisabled());await blocker.getByLabel('When can you start?',{exact:false}).fill('June 2027 (fictional)');await blocker.getByRole('checkbox',{name:'I have checked the answers shown above.'}).check();await accept(blocker).click();await page.getByText('Answers saved. The updated application is ready for review.',{exact:true}).waitFor();
 const missing=card(page,'missing_answer').filter({hasText:'What is your preferred work location?'});assert(await accept(missing).isDisabled());await missing.getByLabel('What is your preferred work location?',{exact:true}).fill('Remote in the US (fictional)');await accept(missing).click();await missing.waitFor({state:'detached'});
 const message=card(page,'review_outreach').first();await message.getByText('Accept makes this message ready for you to send.',{exact:true}).waitFor();assert(await accept(message).isDisabled());await message.getByRole('checkbox',{name:'I reviewed this exact message.'}).click();await accept(message).click();await page.getByText('Ready for you to send. Nothing was sent.',{exact:true}).waitFor();
 const task=card(page,'imported_action');await task.getByText('Choose an interview time',{exact:true}).waitFor();await accept(task).click();await task.waitFor({state:'detached'});
 const interview=card(page,'confirm_interview').first();await accept(interview).click();await page.getByText('Interview details confirmed. Weekly prep is updated.',{exact:true}).waitFor();
 // A mobile vertical drag must remain scroll; an intentional horizontal drag rejects.
 const pending=card(phone,'review_application').first(),cdp=await phoneContext.newCDPSession(phone);
 async function swipe(dx,dy){await pending.scrollIntoViewIfNeeded();const box=await pending.boundingBox(),x=box.x+box.width*.7,y=box.y+24;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/8,y:y+dy*i/8,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 await swipe(0,-130);assert.equal(await pending.count(),1);await swipe(-145,0);await phone.getByText('Application saved. Agent work stopped until you resume it.',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);await desktop.close();await phoneContext.close();console.log(`Inline action cards verified: distinct content, references, no imported label, guarded forms, exact review, keyboard decisions, manual outreach and mobile scrolling/swipes. Screenshots: ${dir}`);
}finally{await browser.close();}
