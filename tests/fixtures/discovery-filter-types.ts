import type {DiscoveryConstraints,EmploymentType,FilterCheck} from '../../lib/discovery-filter-contract.mjs';
import {discoveryConstraints} from '../../lib/discovery-filter-contract.mjs';
const c:DiscoveryConstraints=discoveryConstraints({filters:{Employment:'Full-time'}});
const type:EmploymentType='FT';
const check:FilterCheck={requirement:'employment',status:'not-applicable',evidence:'Not configured.'};
// @ts-expect-error The normalized employment domain is closed.
const bad:EmploymentType='SWE';
// @ts-expect-error Missing source facts are not a new arbitrary match status.
const invalid:FilterCheck={requirement:'employment',status:'probably',evidence:'Unknown'};
// @ts-expect-error Work arrangements use normalized enum values.
c.workArrangement.values.push('sometimes');
void [c,type,check,bad,invalid];
