// Harness-only Node preload. Native source and response bodies stay unchanged.
import './virtual_clock.mjs';
import {Server} from 'node:http';
const emit=Server.prototype.emit;
Server.prototype.emit=function(event,...args) {
 if(event==='request')args[1].setHeader('x-job-fixture-node-now',new Date().toISOString());
 return Reflect.apply(emit,this,[event,...args]);
};
