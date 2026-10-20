import {readField,updateField} from './search-profile.mjs';
export const eligibilityHeading='Eligibility & availability';
export const countryEligibilityFields=['Authorized to work in this country','Sponsorship required now','Sponsorship required in the future'];
export function setEligibilityCountry(prompt,country) {
 const old=readField(prompt,eligibilityHeading,'Work authorization country').value.trim().toLowerCase();
 let next=updateField(prompt,eligibilityHeading,'Work authorization country',country);
 if(old!==country.trim().toLowerCase()) for(const key of countryEligibilityFields) next=updateField(next,eligibilityHeading,key,'');
 return next;
}
