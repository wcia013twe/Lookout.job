// Deployment packaging only: stamp build identity after checking exact source.
// This creates no repository evidence record and grants no runtime permissions.
export const VERSION_PATH='supabase/functions/agent-gateway/runtime-version.json';
export function stampRuntimeBundle({files,sourceCommit,readSource}) {
 if(!/^[a-f0-9]{40}$/.test(sourceCommit??''))throw Error('Exact reviewed source commit required');
 if(new Set(files.map(f=>f.name)).size!==files.length)throw Error('Duplicate bundle files');
 for(const f of files){
  if(f.name===VERSION_PATH)continue;
  if(readSource(sourceCommit,f.name)!==f.content)throw Error(`Source mismatch: ${f.name}`);
 }
 return [...files.filter(f=>f.name!==VERSION_PATH),{name:VERSION_PATH,content:JSON.stringify({sourceCommit})+'\n'}];
}
