export const dashboardTourVersion = 2;
export const dashboardTourSteps = [
 { title:'This is your agent’s workspace.', text:'Review their work here, or keep going in your agent’s chat. You don’t need this dashboard open.', illustration:'workspace', targets:[] },
 { title:'Action board', text:'Start here when your agent needs your review or a decision.', illustration:'review', targets:['[data-dashboard-tour="needs"]'] },
 { title:'Discover', text:'Your agent’s finds appear here. Open a role when you want a closer look.', illustration:'discover', targets:['[data-dashboard-tour="discover"]'] },
 { title:'Applications', text:'Follow your applications and keep your progress up to date.', illustration:'applications', targets:['[data-dashboard-tour="applications"]'] },
 { title:'Network', text:'Keep your people, introductions and outreach together.', illustration:'network', targets:['[data-dashboard-tour="network"]'] },
 { title:'Career Toolkit', text:'Prepare your résumé, answers and interview practice in one place.', illustration:'tools', targets:['[data-dashboard-tour="toolkit"]'] },
 { title:'Circles', text:'Share useful experiences with your people. Your agent can help you put those insights to work.', illustration:'circles', targets:['[data-dashboard-tour="circles"]'] },
];
export function dashboardTourKey(owner) { return `lookout:dashboard-tour:v${dashboardTourVersion}:${owner||'guest'}`; }
export function shouldStartDashboardTour(request, dismissed) {
 return request==='replay' || (request==='dashboard' && !dismissed);
}
