const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function profileFacts(profile={}) {const {verified,...facts}=profile;return facts;}
export function profileChanges(before,after) {return Object.fromEntries(Object.entries(profileFacts(after)).filter(([key,value])=>!same(value,before?.[key])));}
export function reconcileProfileChanges(before,local,latest,choice='review') {
 const fields=profileChanges(before,local),conflicts=Object.keys(fields).filter(key=>!same(before?.[key],latest?.[key])&&!same(fields[key],latest?.[key]));
 if(conflicts.length&&choice==='review')return {conflicts};
 if(choice==='latest')for(const key of conflicts)delete fields[key];
 return {conflicts:[],profile:{...latest,...fields,verified:Object.keys(fields).length?false:latest.verified}};
}
