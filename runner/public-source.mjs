import {isIP} from 'node:net';
export function publicUrl(value) {
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||u.hostname==='localhost'||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal')||isIP(u.hostname.replace(/^\[|\]$/g,'')))throw Error('Public HTTPS source required');return u.href;
}
