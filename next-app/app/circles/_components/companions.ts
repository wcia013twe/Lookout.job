export const companions = [
 {id:'alfred',name:'Alfred',task:'type',station:'Application desk',action:'Preparing applications',detail:'One thoughtful application at a time.',greeting:'Alfred straightens his bow tie. Ready when you are.',member:'demo-self',alias:'Wesley',value:67},
 {id:'iggy',name:'Iggy',task:'music',station:'Music nook',action:'Taking a music break',detail:'A little rhythm between big things.',greeting:'Iggy turns up the good vibes. Take a tiny break.',member:'demo-jordan',alias:'Jordan',value:null},
 {id:'felipe',name:'Felipe',task:'write',station:'Practice board',action:'Sketching a plan',detail:'Making room for the next good idea.',greeting:'Felipe tips his beret. A fresh idea is taking shape.',member:'demo-sam',alias:'Sam',value:50},
 {id:'todd',name:'Todd',task:'read',station:'Reading table',action:'Reading up',detail:'Big eyes. One small chapter.',greeting:'Todd gives a happy wobble, bow tie and all.',member:'demo-alex',alias:'Alex',value:null},
 {id:'jojo',name:'Jojo',task:'celebrate',station:'Celebration rug',action:'Cheering you on',detail:'There is always room in your corner.',greeting:'Jojo sends a little love your way.',member:'demo-peer',alias:'Maya',value:null},
] as const;
export function companionForMember(name:string){
 const first=name.replace(' (demo)','').split(' ')[0];
 return companions.find(companion=>companion.alias===first)||companions[0];
}
