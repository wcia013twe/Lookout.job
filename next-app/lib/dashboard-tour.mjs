export const dashboardTourVersion = 2;
export const dashboardTourSteps = [
 { title:'This is your agent’s workspace.', text:'Review their work here, or keep going in your agent’s chat. You don’t need this dashboard open.', illustration:'workspace', targets:[] },
 { title:'Discover what’s next.', text:'Your agent’s finds appear here. Open a role when you want to take a closer look.', illustration:'discover', targets:['[data-dashboard-tour="discover"]'] },
 { title:'Review, then keep moving.', text:'Applications keeps track of your progress. Action board shows what needs your attention.', illustration:'review', targets:['[data-dashboard-tour="applications"]','[data-dashboard-tour="needs"]'] },
 { title:'Build your next opportunity.', text:'Prepare your materials in Career Toolkit. Keep contacts and outreach together in Network.', illustration:'tools', targets:['[data-dashboard-tour="toolkit"]','[data-dashboard-tour="network"]'] },
 { title:'Better with your people.', text:'Share useful experiences in Circles. Your agent can turn a shared tip into your next step.', illustration:'circles', targets:['[data-dashboard-tour="circles"]'] },
];
export function dashboardTourKey(owner) { return `lookout:dashboard-tour:v${dashboardTourVersion}:${owner||'guest'}`; }
export function shouldStartDashboardTour(request, dismissed) {
 return request==='replay' || (request==='dashboard' && !dismissed);
}
