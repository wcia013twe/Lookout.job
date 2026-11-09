import {spawnSync} from 'node:child_process';
import {tracingConfig} from '../../backend/runtime/trace-policy.mjs';
export const unwrap=r=>r.body??r.data??r;
export const rows=r=>{const b=unwrap(r);return Array.isArray(b)?b:b.data||[];};
export function call(args,body) {
  const config=tracingConfig();if(!config)throw Error('Langfuse credentials/base URL missing');
  const result=spawnSync(process.env.LANGFUSE_CLI||'langfuse',['api',...args,...(body===undefined?[]:['--body-file','-']),'--json'],{
    input:body===undefined?undefined:JSON.stringify(body),encoding:'utf8',timeout:60000,maxBuffer:20e6,
    env:{...process.env,LANGFUSE_HOST:config.baseUrl,LANGFUSE_BASE_URL:config.baseUrl,LANGFUSE_SECRET_KEY:config.secretKey},
  });
  if(result.status!==0)throw Error('Langfuse '+args.slice(0,2).join(' ')+' failed; response bodies suppressed. Check CLI version/permissions.');
  const reply=JSON.parse(result.stdout),b=unwrap(reply);
  if(reply.ok===false||reply.status>=400||reply.statusCode>=400||reply.status===207||reply.statusCode===207||Number(b.rejected||b.rejectedCount||0)>0||Number(b.partialSuccess?.rejectedSpans||0)>0||b.partialSuccess?.errorMessage)throw Error('Langfuse rejected all/part of '+args.slice(0,2).join(' '));
  return reply;
}
