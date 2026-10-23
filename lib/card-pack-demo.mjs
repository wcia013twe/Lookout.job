export const DEMO_PACK_ID='66666666-6666-4666-8666-666666666666';
export const DEMO_PACK_CONNECTION='77777777-7777-4777-8777-777777777777';
export const demoPack={id:DEMO_PACK_ID,title:'My discovery pack (demo)',enabled:true,taskId:'demo-discovery',archive:'none'};
export const demoPackConnections=[{id:DEMO_PACK_CONNECTION,name:'Personal agent (demo)',scopes:['workspace:read','batches:write'],expires_at:'2099-01-01T00:00:00Z',revoked_at:null}];

export const demoPackTask={id:'demo-discovery',title:'Discovery task (demo)',description:'Find fictional roles for my discovery pack. Use the fictional search profile’s company tier list as a baseline; team, technical scope and personal fit can outweigh it. Investigate unranked companies and keep full-time and internship judgments separate.',enabled:true,mode:'manual',time:'',sourceIds:['demo-social'],connectionIds:[DEMO_PACK_CONNECTION]};
