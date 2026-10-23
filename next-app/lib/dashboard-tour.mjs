export const dashboardTourVersion = 1;
export const dashboardTourSteps = [
 { title:'Discover your next move', text:'Open a card to explore the role and see why it’s worth a look.', targets:['[data-dashboard-tour="roles"] article'] },
 { title:'Know where things stand', text:'Track your applications here. Check Action board when something needs your review.', targets:['[data-dashboard-tour="applications"]','[data-dashboard-tour="needs"]'] },
 { title:'Your agent goes with you', text:'Search, prepare drafts and track progress through your connected agent. You don’t need this dashboard open.', hint:'Manage your connection in Profile → My Agent.', targets:['[data-dashboard-tour="profile"]'] },
];
export function dashboardTourKey(owner) { return `lookout:dashboard-tour:v${dashboardTourVersion}:${owner||'guest'}`; }
export function shouldStartDashboardTour(request, dismissed) {
 return request==='replay' || (request==='dashboard' && !dismissed);
}
