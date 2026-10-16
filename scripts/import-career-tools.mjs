import { build } from 'esbuild';
import { readdir, readFile, mkdir, copyFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, relative, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
const source=await realpath(resolve(process.argv[2]||''));
if(!process.argv[2])throw Error('Pass the checked-out pinned upstream source directory');
const target=resolve('runner/vendor/career-ops');
const providerFiles=(await readdir(join(source,'providers'))).filter(f=>f.endsWith('.mjs')&&f!=='local-parser.mjs').map(f=>'providers/'+f);
const roots=[...providerFiles,'build-cv-html.mjs','generate-pdf.mjs','generate-cover-letter.mjs','verify-ats.mjs','verify-cv-facts.mjs','verify-cv-structure.mjs','keyword-match.mjs','stats.mjs','analyze-patterns.mjs','calibrate.mjs','upskill.mjs','salary-gap.mjs','funnel-velocity.mjs','detect-reposts.mjs','jd-similarity.mjs','liveness-api.mjs'];
const compiled=await build({entryPoints:roots.map(f=>join(source,f)),outdir:'/tmp/lookout-vendor-index',bundle:true,packages:'external',platform:'node',format:'esm',write:false,metafile:true,logLevel:'silent'});
const files=new Set(Object.keys(compiled.metafile.inputs).map(f=>relative(source,resolve(f))));
files.add('LICENSE');
files.add('tracker-aliases.json');
async function assets(folder,predicate){for(const item of await readdir(join(source,folder),{withFileTypes:true})){const file=folder+'/'+item.name;if(item.isDirectory())await assets(file,predicate);else if(predicate(file))files.add(file);}}
await assets('fonts',()=>true);
await assets('templates',f=>f.endsWith('.html')||['states.yml','ats-rules.yml','benchmarks.yml','discard-reasons.yml'].some(n=>f.endsWith('/'+n)));
const manifest={repository:'https://github.com/career-ops-hq/career-ops',commit:'c78e14cdfd52f18a92e4a67694efab7ddef59385',excluded:['providers/local-parser.mjs (arbitrary configured subprocesses)','upstream web/TUI, installer, self-updater, model runners and user data'],files:[]};
for(const file of [...files].sort()){
 if(file.startsWith('..'))throw Error('Import escaped source root');
 const destination=join(target,file);await mkdir(dirname(destination),{recursive:true});await copyFile(join(source,file),destination);
 const bytes=await readFile(destination);manifest.files.push({path:file,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Imported ${files.size} files, including ${providerFiles.filter(f=>!f.split('/').at(-1).startsWith('_')).length} network providers.`);
