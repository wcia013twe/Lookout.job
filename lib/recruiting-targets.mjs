export const recruitingTargetsHeading='Recruiting targets';
export const recruitingTargetsKey='Targets';
// Stored inside the existing owned, versioned profile narrative; no parallel store.
export function parseRecruitingTargets(value, {requireNames=false}={}) {
 if(!value.trim()) return [];
 let targets;
 try {targets=JSON.parse(value);} catch {throw Error('Recruiting targets could not be read. Repair the Targets field in Advanced instructions before editing.');}
 const allowed=['id','name','active','roles','timeline','resumeId','conditions'];
 if(!Array.isArray(targets)||targets.length>30||targets.some(t=>!t||typeof t!=='object'||Array.isArray(t)||Object.keys(t).some(k=>!allowed.includes(k))||!['id','name','roles','timeline','resumeId','conditions'].every(k=>typeof t[k]==='string')||!t.id.trim()||(requireNames&&!t.name.trim())||t.name.length>80||typeof t.active!=='boolean')||new Set(targets.map(t=>t.id)).size!==targets.length) throw Error('Recruiting targets need unique IDs, a name, active status, roles, timeline, resume ID and conditions. Up to 30 targets are supported.');
 return targets;
}

// Migration is an explicit copy. Later edits never read from a global override.
export function copyLegacyRules(current,legacy) {
 const prior=legacy.trim();
 if(!prior||current.includes(prior)) return current;
 return [prior,current].filter(text=>text.trim()).join('\n\n');
}
