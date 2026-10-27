import {trackerProgress} from './tracker-display.mjs';
export function roleApplication(role,applications={}) {return Object.values(applications).find(app=>app.id===role.id||[app.url,app.applicationUrl].includes(role.applicationUrl));}
export function roleApplied(role,applications={},trackerItems={}) {
 const app=roleApplication(role,applications);
 return trackerProgress(app||{id:role.id},trackerItems[app?.id]||trackerItems[role.id]||{}).level>=1;
}
export function trackedApplications({roles=[],publicRoles=[],applications={},trackerIds=[],trackerItems={}}) {
 const catalog=new Map([...publicRoles,...roles].map(role=>[role.id,role]));
 const rows=[...new Set([...trackerIds,...Object.keys(applications)])].map(id=>({...catalog.get(id),...applications[id],id,status:applications[id]?.status||trackerItems[id]?.status||'New',questions:applications[id]?.questions||[]})).filter(app=>app.company&&app.title);
 const unique=new Map();
 for(const row of rows){const key=row.url||row.applicationUrl||row.id,old=unique.get(key);if(!old||row.backendId&&!old.backendId)unique.set(key,row);}
 return [...unique.values()];
}
