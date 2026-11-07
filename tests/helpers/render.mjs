import {build} from 'esbuild';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require=createRequire(new URL('../../next-app/package.json',import.meta.url));
export const React=require('react');
export const {renderToStaticMarkup}=require('react-dom/server');

export async function bundleComponent(path, {plugins=[]}={}) {
  const bundle=await build({entryPoints:[path],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',logLevel:'silent',plugins});
  return (globals={})=>{
    const module={exports:{}};
    vm.runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,require,console,process,setTimeout,clearTimeout,...globals});
    return module.exports.default;
  };
}
