export function nextFourHourDelay(now=new Date()){const next=new Date(now);next.setUTCMinutes(0,0,0);next.setUTCHours(Math.floor(next.getUTCHours()/4)*4+4);return next.getTime()-now.getTime();}
export function scheduleIngestion(run:()=>Promise<any>,report:(result:any)=>void,delay=()=>nextFourHourDelay()){
 let stopped=false,timer:ReturnType<typeof setTimeout>;
 const arm=()=>{timer=setTimeout(async()=>{try{report(await run());}catch{report({failed:1,errors:[{code:'SCHEDULED_RUN_FAILED'}]});}finally{if(!stopped)arm();}},delay());};
 arm();return()=>{stopped=true;clearTimeout(timer);};
}
