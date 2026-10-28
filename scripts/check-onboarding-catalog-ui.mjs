// Explicit local-only UI proof; uses disposable fictional Auth accounts and cleans up.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {chromium} from 'playwright';
import {initialPrompt,updateField,profileFromPrompt,readField,promptFromProfile} from '../lib/search-profile.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.env.LOOKOUT_UI_URL||'http://127.0.0.1:3059';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Local test frontend required');
const cfg=JSON.parse(execFileSync(process.env.SUPABASE_CLI||'/opt/homebrew/bin/supabase',['status','-o','json'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(new URL(cfg.API_URL).hostname,'127.0.0.1');
const options={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(cfg.API_URL,cfg.SERVICE_ROLE_KEY,options),client=createClient(cfg.API_URL,cfg.ANON_KEY,options);
const ok=r=>{if(r.error)throw Error('Local fixture failure: '+r.error.code);return r.data;};
const dir=process.env.LOOKOUT_UI_ARTIFACTS||'/private/tmp/onboarding-catalog-review';await mkdir(dir,{recursive:true});let user,browser;
try{
 const email='onboarding-preview-'+randomUUID()+'@example.test',password=randomUUID()+'aA!9';user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
 const session=ok(await client.auth.signInWithPassword({email,password})).session;
 let prompt=initialPrompt();for(const [h,k,v] of [['Role preferences','Roles','Backend engineering'],['Search Filters','Employment','Full-time'],['Search Filters','Location','Remote']])prompt=updateField(prompt,h,k,v);
 ok(await client.rpc('save_search_profile',{expected_version:0,next_profile:profileFromPrompt(prompt,{id:'general',name:'General',active:true})}));
 browser=await chromium.launch({executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
 await context.addInitScript(({session,key,owner})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(session));if(!localStorage.getItem('lookout:onboarding-progress:v1:'+owner))localStorage.setItem('lookout:onboarding-progress:v1:'+owner,'preferences');},{session,key:client.auth.storageKey,owner:user.id});
 const page=await context.newPage();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/onboarding/');
 await page.getByRole('heading',{name:'What’s your next move?',exact:true}).waitFor();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('heading',{name:'A role to explore.',exact:true}).waitFor();
 assert.equal(await page.getByText('Agent review comes next.',{exact:true}).count(),0);
 assert.equal(await page.getByText('Why it’s here',{exact:true}).count(),0);
 const jobTitle=await page.locator('.catalog-preview h2').innerText();
 const pref=ok(await admin.from('preferences').select('search').eq('user_id',user.id).single());
 const saved=promptFromProfile(pref.search.profiles[0]);const selectedAt=readField(saved,'First opportunity','Selected at').value;assert(selectedAt);assert(readField(saved,'First opportunity','Catalog role ID').value);
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:dir+'/match-'+width+'.png',fullPage:true});}
 await page.reload();await page.getByRole('heading',{name:'A role to explore.',exact:true}).waitFor();assert.equal(await page.locator('.catalog-preview h2').innerText(),jobTitle);
 const after=ok(await admin.from('preferences').select('search').eq('user_id',user.id).single());assert.equal(readField(promptFromProfile(after.search.profiles[0]),'First opportunity','Selected at').value,selectedAt);
 await page.getByRole('button',{name:'Adjust filters',exact:true}).click();
 await page.getByRole('button',{name:'Remove Backend engineering',exact:true}).click();
 await page.getByRole('button',{name:'Marketing Specialist',exact:true}).click();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('heading',{name:'No role matches yet.',exact:true}).waitFor();
 await page.screenshot({path:dir+'/no-match-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Continue setup',exact:true}).click();await page.getByRole('heading',{name:'Meet your agent.',exact:true}).waitFor();
 assert.equal((ok(await admin.from('applications').select('id').eq('user_id',user.id))).length,0);
 assert.deepEqual(errors,[]);console.log('PASS: real local UI saves a tiny preview reference before agent connection, restores it on refresh, handles changed filters/no match, continues setup, and creates no applications; desktop/mobile captures saved.');
}finally{if(browser)await browser.close();if(user)ok(await admin.auth.admin.deleteUser(user.id));console.log('Disposable local account removed.');}
