import test from 'node:test';
import assert from 'node:assert/strict';
import {passwordSignIn,requestPasswordSetup,savePassword} from '../next-app/lib/password-auth.mjs';
test('password login uses the existing email identity and preserves password characters',async()=>{
 const calls=[];const client={auth:{async signInWithPassword(input){calls.push(input);return {error:null};}}};
 await passwordSignIn(client,' person@example.com ',' secret pass ');
 assert.deepEqual(calls,[{email:'person@example.com',password:' secret pass '}]);
});
test('login failures disclose no account existence or provider details',async()=>{
 for(const message of ['User not found','Google only','Invalid password']){
  await assert.rejects(passwordSignIn({auth:{async signInWithPassword(){return {error:{message}};}}},'person@example.com','wrong'),/^Error: Could not sign in\./);
 }
 await assert.rejects(passwordSignIn(null,'person@example.com','wrong'),/still loading/);
});
test('password setup returns to recovery and never creates a second user',async()=>{
 const calls=[];const client={auth:{async resetPasswordForEmail(...args){calls.push(args);return {error:null};}}};
 await requestPasswordSetup(client,' person@example.com ','https://example.com/Lookout/reset-password/');
 assert.deepEqual(calls,[['person@example.com',{redirectTo:'https://example.com/Lookout/reset-password/'}]]);
});
test('password changes require a matching strong-enough pair and use the authenticated user',async()=>{
 const calls=[];const client={auth:{async updateUser(input){calls.push(input);return {error:null};}}};
 await assert.rejects(savePassword(client,'short','short'),/at least 8/);
 await assert.rejects(savePassword(client,'long-password','other-password'),/do not match/);
 assert.equal(calls.length,0);
 await savePassword(client,'long-password','long-password');
 assert.deepEqual(calls,[{password:'long-password'}]);
 await assert.rejects(savePassword({auth:{async updateUser(){return {error:{message:'expired'}};}}},'long-password','long-password'),/new setup link/);
});
