// Only a tab-scoped mode flag. Never read account storage, identity or credentials.
export const DEMO_MODE_KEY='lookout:detached-demo';
export function resolveDemoMode(href,getStorage=()=>null) {
 const choice=new URL(href).searchParams.get('demo');
 try {
  const storage=getStorage();
  if(choice==='1'){storage?.setItem(DEMO_MODE_KEY,'1');return true;}
  if(choice==='0'){storage?.removeItem(DEMO_MODE_KEY);return false;}
  return storage?.getItem(DEMO_MODE_KEY)==='1';
 }catch{return choice==='1';}
}
export function navigateWorkspaceMode(location,enabled) {
 // A full navigation tears down the other runtime. Carry no account/batch/callback parameters.
 const url=new URL(location.href);url.search='';url.hash='';
 url.searchParams.set('demo',enabled?'1':'0');
 location.assign(url.href);
}
