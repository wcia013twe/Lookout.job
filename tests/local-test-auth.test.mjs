import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localTestCredentials} from '../next-app/lib/local-test-auth.ts';

test('test account sign-in requires explicit opt-in and both origins on loopback',()=>{
 const get=(site='http://127.0.0.1:3048',api='http://127.0.0.1:54321',flag='1',email='test@example.test',password='fictional')=>localTestCredentials(site,api,flag,email,password);
 assert.deepEqual(get(),{email:'test@example.test',password:'fictional'});
 assert.ok(get('http://localhost:3000','http://[::1]:54321'));
 for(const site of ['https://lookout.example','http://127.0.0.1.evil.test','file:///tmp/test','invalid'])assert.equal(get(site),null);
 for(const api of ['https://project.supabase.co','http://localhost.evil.test','http://user:pass@localhost:54321'])assert.equal(get(undefined,api),null);
 assert.equal(get(undefined,undefined,'0'),null);
 assert.equal(get(undefined,undefined,'1',''),null);
 assert.equal(get(undefined,undefined,'1','test@example.test',''),null);
});
