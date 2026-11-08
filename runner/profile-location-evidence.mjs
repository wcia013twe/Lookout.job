import {countryName} from './vendor/career-ops/providers/_country.mjs';
// This only softens missing evidence for a US-wide profile, never explicit city,
// block-list or scanner location rules. No geocoding or citizenship inference.
const foreignCountries=new Set(['uk','united kingdom','england','scotland','wales']);
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
 const code=String.fromCharCode(a,b),name=countryName(code);
 if(name&&code!=='US'&&name!=='Georgia')foreignCountries.add(name.toLowerCase());
}
export function isUsWideProfile(locations){return locations.length>0&&locations.every(value=>/^(?:remote[ (]+)?(?:united states(?: of america)?|usa|u\.?s\.?)\)?$/i.test(value.trim()));}
export function usLocationEvidence(location,usStateMatch){
 const value=String(location||'').trim();
 const parts=value.toLowerCase().split(/[,;|·]/).map(x=>x.trim().replace(/\s*\((?:remote|hybrid|on[- ]?site)\)\s*$/,''));
 if(/\b(?:united states(?: of america)?|usa)\b|(?:^|[,;\s])u\.?s\.?(?:$|[\s,)])/i.test(value))return 'met';
 if(parts.some(part=>foreignCountries.has(part)))return 'unmet';
 if(usStateMatch(value,'',''))return 'met';
 return 'unknown';
}
