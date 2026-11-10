// Host-only identity checks for a dedicated isolated native endpoint.
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export function isolatedEndpoint(root){
 root=fs.realpathSync(root);const db=read(path.join(root,'database.json')),backend=read(path.join(root,'backend.json'));
 if(db.kind!=='isolated-job-clock-database-v1'||backend.kind!=='isolated-job-clock-http-v1'||db.root!==root||backend.root!==root||!['http_started_unverified','native_verified'].includes(backend.status)||!db.container.startsWith('job-clock-db-'))throw Error('Dedicated isolated native endpoint required');
 const info=name=>JSON.parse(execFileSync('docker',['inspect',name],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000,maxBuffer:4*1024*1024}))[0];
 for(const item of [{name:db.container,id:db.containerId},...Object.values(backend.services)]){
  const c=info(item.name);if(c.Id!==item.id||c.Config.Labels?.['lookout.job-clock-root']!==root||!c.State.Running)throw Error('Isolated native service ownership/liveness changed');
 }
 const api=info(backend.services.api.name),binding=api.NetworkSettings.Ports['8080/tcp']?.[0];
 if(!binding||binding.HostIp!=='127.0.0.1'||backend.mcpUrl!==`http://127.0.0.1:${binding.HostPort}/mcp`)throw Error('Isolated native loopback endpoint changed');
 return {root,db,backend};
}
export function isolatedSql(root,text){const {db}=isolatedEndpoint(root);return execFileSync('docker',['exec','-i',db.container,'psql','-h','/tmp','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],{input:text,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:60000,maxBuffer:32*1024*1024});}

const errorStatus=reply=>{try{return JSON.parse(reply.result.content.find(c=>c.type==='text').text).status;}catch{return null;}};
export const isScopeDenial=reply=>reply.result?.isError===true&&(errorStatus(reply)===403||reply.result.content?.some(c=>c.type==='text'&&c.text.startsWith('Missing required scope: ')));
export const isOwnershipDenial=reply=>reply.result?.isError===true&&[403,404].includes(errorStatus(reply));
