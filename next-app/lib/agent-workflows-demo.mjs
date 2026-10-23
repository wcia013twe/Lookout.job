import {buildUserBrief,validateFieldUpdate} from '../../lib/agent-workflows.mjs';
export function createWorkflowDemo(store) {
 if(store.get('demo.fictional')!==true)throw Error('Isolated fictional demo required');
 return {
  async updateFields(operation,payload) {
   if(operation!=='profile.fields.update')throw Error('This demo interaction supports profile fields only');
   validateFieldUpdate(operation,payload);
   const current=store.get('demo.profileUpdatedAt')||store.get('demo.createdAt');
   if(payload.expectedUpdatedAt!==current)throw Error('Profile changed; reload');
   const facts={...store.get('workflow.profile'),...structuredClone(payload.fields)};
   const updated_at=new Date(Math.max(Date.now(),Date.parse(current)+1)).toISOString();
   store.set('workflow.profile',facts);store.set('demo.profileUpdatedAt',updated_at);
   return {fictional:true,facts:structuredClone(facts),updated_at,verified_at:null};
  },
  async readUserBrief(options={}) {
   const now=new Date(store.get('demo.createdAt'));
   const events=[{id:'demo-profile-update',actor:'agent',kind:'profile_saved',occurred_at:store.get('demo.profileUpdatedAt')||now.toISOString(),payload:{text:'Fictional profile headline: '+(store.get('workflow.profile.headline')||'Backend systems engineer (demo)')}}];
   const snapshot={settings:store.get('workflow.searchPreferences.quietMode'),lastDigestAt:now.toISOString(),events,plans:[],applications:[],deliveries:[]};
   return {fictional:true,...buildUserBrief(snapshot,null,options,now)};
  },
 };
}
