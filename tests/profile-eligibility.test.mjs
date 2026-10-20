import test from 'node:test';
import assert from 'node:assert/strict';
import {setEligibilityCountry,eligibilityHeading,countryEligibilityFields} from '../lib/profile-eligibility.mjs';
import {readField,updateField,profileFromPrompt,promptFromProfile} from '../lib/search-profile.mjs';
test('changing eligibility country clears country-specific answers and preserves availability and prose',()=>{
 let prompt=setEligibilityCountry('Keep this custom prose.','United States');
 for(const key of countryEligibilityFields) prompt=updateField(prompt,eligibilityHeading,key,'No');
 prompt=updateField(prompt,eligibilityHeading,'Notice period','Two weeks');
 const changed=setEligibilityCountry(prompt,'Canada');
 for(const key of countryEligibilityFields) assert.equal(readField(changed,eligibilityHeading,key).value,'');
 assert.equal(readField(changed,eligibilityHeading,'Notice period').value,'Two weeks');
 assert.ok(changed.includes('Keep this custom prose.'));
 assert.equal(readField(setEligibilityCountry(prompt,' united states '),eligibilityHeading,countryEligibilityFields[0]).value,'No');
});
test('eligibility survives the website/MCP profile narrative with unknowns left unspecified',async()=>{
 const {validateRequest}=await import('../supabase/functions/agent-gateway/contract.mjs');
 let prompt=setEligibilityCountry('','United States');
 for(const [key,value] of [['Sponsorship required now','No'],['Earliest start date','2027-06-01'],['Expected graduation','2027-05'],['Enrollment status','Currently enrolled']]) prompt=updateField(prompt,eligibilityHeading,key,value);
 const profile=profileFromPrompt(prompt,{id:'internships',name:'Internships'});
 validateRequest({operation:'preferences.profile.save',payload:{expectedVersion:0,profile}});
 const restored=promptFromProfile(profile);
 assert.equal(readField(restored,eligibilityHeading,'Sponsorship required now').value,'No');
 assert.equal(readField(restored,eligibilityHeading,'Sponsorship required in the future').value,'');
 assert.equal(readField(restored,eligibilityHeading,'Expected graduation').value,'2027-05');
});
