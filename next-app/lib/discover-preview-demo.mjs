// UI-only scenarios: fictional employers, candidates and scores; no service calls.
export function discoverPreviewRoles(date) {
  return [
    { id: 'demo-discover-good', company: 'Example Query Labs (demo)', title: 'Backend Engineer, Query Systems', employmentType: 'FT', percent: 76, limited: false },
    { id: 'demo-discover-tradeoff', company: 'Example Compute (demo)', title: 'ML Systems Intern', employmentType: 'Internship', percent: 54, limited: true },
    { id: 'demo-discover-unknown', company: 'Example Search (demo)', title: 'Search Infrastructure Engineer', employmentType: 'FT' },
  ].map(({ percent, limited, ...role }) => ({
    ...role, location: 'Remote · United States (demo)', category: 'Systems infrastructure',
    priority: 'Strong Consider', applicationUrl: 'https://example.com/demo-only',
    discoveredDate: date, postedDate: null, sourceFreshness: 'Fictional demo listing · not a real opening',
    description: 'Fictional posting for interface review. Build and profile a distributed query service, investigate latency regressions, and document reliability tradeoffs.\n\nWork with engineers on query execution and operational tooling. Production systems experience is preferred; internship eligibility and work setting require confirmation.',
    whyItFits: limited ? 'Potential trade-up in this fictional scenario: systems internship scope could deepen performance-debugging experience. The demo profile has a query-service project, but ML serving experience is not established. Verify mentorship, conversion potential and whether a graduation delay is justified.' : 'The fictional profile describes a SQL-service internship and a query-planning project, which connect to this example’s latency and database work. The material gap is evidence of production-scale ownership; a project alone does not establish that experience.',
    ...(percent === undefined ? {} : { matchPreview: { percent, factors: [
      { label: 'Skills & experience', value: limited ? 50 : 75, rating: limited ? 'Partial' : 'Good', reason: 'Fictional evidence: the demo profile includes Go, PostgreSQL and a query-service project. Production ownership and ML serving remain unverified. This bar is a fixed illustration.' },
      { label: 'Compensation', value: limited ? null : 75, rating: limited ? 'Unknown' : 'Good', reason: limited ? 'No compensation evidence is included in this example.' : 'Illustrative assumption only: a salary aligned with the demo candidate’s target. No employer compensation was verified.' },
      { label: 'Wellbeing & culture', value: 25, rating: 'Limited', reason: 'Illustrative concern: on-call expectations are unclear. This is not a factual assessment of an employer’s culture.' },
      { label: 'Location & work setting', value: limited ? 50 : 100, rating: limited ? 'Partial' : 'Excellent', reason: 'The fictional posting allows remote work in the US. Actual location eligibility and working hours would need confirmation.' },
    ] } }),
  }));
}
