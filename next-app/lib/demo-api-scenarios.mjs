import {apiFailure} from '../../lib/api-failure.mjs';
// Only attached by the detached demo runtime. Never intercept account services.
export function demoApiScenario(services,scenario) {
 if(!['empty','unavailable'].includes(scenario))return services;
 const failed=new Set();
 const wrap=action=>async(operation,payload)=>{
  if(scenario==='empty') {
   if(operation==='artifacts.list')return {items:[],nextOffset:null};
   if(operation==='circles.list')return {available:true,circles:[]};
  }
  if(scenario==='unavailable'&&!failed.has(operation)) {
   failed.add(operation);
   throw apiFailure(operation,{code:'PGRST202'},404);
  }
  return action(operation,payload);
 };
 return {...services,artifactAction:wrap((...args)=>services.artifactAction(...args)),knowledge:{...services.knowledge,action:wrap((...args)=>services.knowledge.action(...args))}};
}
