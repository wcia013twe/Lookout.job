import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const origin=process.env.LOOKOUT_UI_URL||'http://localhost:3012';
const directory=process.env.LOOKOUT_UI_ARTIFACTS||'/tmp/circle-appearance-ui';
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:1000},serviceWorkers:'block',recordVideo:{dir:directory,size:{width:1280,height:1000}}});
const errors=[],cloud=[];
await context.route('**/*.supabase.co/**',route=>{cloud.push(route.request().url());return route.abort();});
try{
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin+'/circles/?demo=1&circle=demo-circle');
 await page.getByRole('button',{name:'Customize',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByRole('button',{name:'Choose Todd',exact:true}).click();
 await page.getByLabel('Preview motion').selectOption('walking');
 await page.screenshot({path:directory+'/desktop.png'});
 await dialog.getByRole('button',{name:'Save my avatar',exact:true}).click();
 await dialog.getByRole('status').filter({hasText:'Avatar saved'}).waitFor();
 await dialog.getByRole('button',{name:'Circle theme',exact:true}).click();
 await dialog.getByRole('button',{name:/Lamplit cottage/}).click();
 await dialog.getByRole('button',{name:'Apply Circle theme',exact:true}).click();
 await dialog.getByRole('status').filter({hasText:'Circle theme saved'}).waitFor();
 await page.getByLabel('Close customization').click();
 await page.getByRole('button',{name:'Customize',exact:true}).click();
 assert.equal(await dialog.getByRole('button',{name:/Lamplit cottage/}).getAttribute('aria-pressed'),'true');
 await dialog.getByRole('button',{name:'My avatar',exact:true}).click();
 assert.equal(await dialog.getByRole('button',{name:'Choose Todd',exact:true}).getAttribute('aria-pressed'),'true');
 async function image(sheet){
  const data=await page.evaluate(sheet=>{
   const canvas=document.createElement('canvas');canvas.width=sheet?768:192;canvas.height=sheet?624:208;
   const context=canvas.getContext('2d');
   for(let row=0;row<(sheet?3:1);row++)for(let column=0;column<(sheet?4:1);column++){
    context.fillStyle=['#9c8fd4','#d7b579','#7cbdb3'][row];context.beginPath();context.arc(column*192+96,row*208+105-column*3,45+column*3,0,2*Math.PI);context.fill();
   }
   return canvas.toDataURL('image/png');
  },sheet);
  return {name:sheet?'fictional-sheet.png':'fictional-avatar.png',mimeType:'image/png',buffer:Buffer.from(data.split(',')[1],'base64')};
 }
 const still=await image(false);
 await dialog.locator('input[type=file]').setInputFiles(still);
 await dialog.getByRole('status').filter({hasText:'Preview ready'}).waitFor();
 await dialog.getByRole('button',{name:'Save my avatar',exact:true}).click();
 await dialog.getByRole('status').filter({hasText:'Avatar saved'}).waitFor();
 await page.getByLabel('Upload format').selectOption('sheet');
 await dialog.locator('input[type=file]').setInputFiles(await image(true));
 await dialog.getByRole('status').filter({hasText:'Preview ready'}).waitFor();
 await page.getByLabel('Preview motion').selectOption('celebrating');
 await dialog.getByRole('button',{name:'Save my avatar',exact:true}).click();
 await dialog.getByRole('status').filter({hasText:'Avatar saved'}).waitFor();
 await page.getByLabel('Close customization').click();
 await page.getByRole('button',{name:/See Wesley.*recent activity/}).click();
 assert.equal(await page.locator('#companion-activity [data-kind=sheet]').count(),1);
 await page.getByRole('button',{name:'Close activity',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Customize',exact:true}).click();
 await dialog.evaluate(element=>element.scrollTop=0);
 await page.screenshot({path:directory+'/mobile.png'});
 const bounds=await dialog.evaluate(element=>({width:element.clientWidth,scroll:element.scrollWidth}));
 assert.equal(bounds.width,bounds.scroll);
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await dialog.locator('[data-kind=sheet]').evaluate(element=>getComputedStyle(element).animationName),'none');
 await dialog.getByText('Create your own',{exact:true}).click();
 const template=await page.request.get(origin+'/circles/creator-kit.json');
 assert.equal(template.status(),200);assert.equal((await template.json()).version,1);
 assert.match(await page.getByLabel('Creator AI prompt').inputValue(),/No executable code/);
 await dialog.locator('input[type=file]').setInputFiles(still);
 await dialog.getByRole('alert').waitFor();
 assert.match(await dialog.getByRole('alert').innerText(),/768 × 624/);
 await page.keyboard.press('Escape');
 assert.equal(await dialog.count(),0);
 assert.deepEqual(errors,[]);assert.deepEqual(cloud,[]);
 console.log('Passed: builtin, still and sheet saves; theme persistence; activity identity; template; mobile overflow; reduced motion; invalid upload; Escape; no account traffic.');
 console.log('Recording:',await page.video().path());
}finally{await context.close();await browser.close();}
