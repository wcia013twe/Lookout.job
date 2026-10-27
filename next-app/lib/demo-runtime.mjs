import {withApplicationFlowDemo} from './application-flow-demo.mjs';
import {createDemoSimplifyImport} from './simplify-import-demo.mjs';
import {demoPack,demoPackTask} from './card-pack-demo.mjs';
import {demoApiScenario} from './demo-api-scenarios.mjs';
import {demoFixtures} from './network-demo.mjs';
import {withApplicationProfileDemo} from './application-profile-demo.mjs';
import {demoOutreachContacts} from './outreach-demo.mjs';
import {createDemoStore} from './demo-store.mjs';
import {createDemoServices} from './demo.mjs';
// No production store, auth client, cloud sync, account metadata or localStorage.
export function createDetachedDemo({date,models,presets,apiScenario}) {
 const fixtures=withApplicationProfileDemo(demoFixtures(date));
 fixtures.state.network.referrals=[...demoOutreachContacts(),...fixtures.state.network.referrals.filter(r=>r.collection==='companies'||r.collection==='network-demo')];
 fixtures.state.workflow.tierLists=presets.presets.map(p=>models.tierlistModel.seed(p));
 fixtures.state.workflow.activeTierListId=fixtures.state.workflow.tierLists[0]?.id||'';
 fixtures.state.workflow.theme={...fixtures.state.workflow.theme,cardPacks:[structuredClone(demoPack)],cardPacksVersion:1};
 fixtures.state.workflow.searchPreferences.schedule={enabled:false,timezone:'UTC',routines:[structuredClone(demoPackTask)],configVersion:1};
 if(apiScenario==='profile-conflict') {
  const before=structuredClone(fixtures.state.workflow.profile);
  fixtures.state.demo.profileConflict={before,latest:{...structuredClone(before),location:'Fictional agent location',verified:false}};
  fixtures.state.workflow.profile={...before,location:'Fictional browser location',phone:'+1 202-555-0199',verified:false};
  fixtures.state.ui={...fixtures.state.ui,profileConflict:{fields:[]}};
 }
 withApplicationFlowDemo(fixtures,apiScenario);
 const store=createDemoStore(fixtures.state);
 return {store,services:{...demoApiScenario(createDemoServices(store),apiScenario),simplifyImport:createDemoSimplifyImport()}};
}
