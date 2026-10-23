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
 const store=createDemoStore(fixtures.state);
 return {store,services:demoApiScenario(createDemoServices(store),apiScenario)};
}
