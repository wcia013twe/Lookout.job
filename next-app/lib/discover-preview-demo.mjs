// UI-only scenarios: fictional employers, candidates and scores; no service calls.
export function discoverPreviewRoles(date) {
  return [
    { id: 'demo-discover-good', company: 'Example Query Labs (demo)', title: 'Backend Engineer, Query Systems', employmentType: 'FT', percent: 76, limited: false },
    { id: 'demo-discover-tradeoff', company: 'Example Compute (demo)', title: 'ML Systems Intern', employmentType: 'Internship', percent: 54, limited: true },
    { id: 'demo-discover-unknown', company: 'Example Search (demo)', title: 'Software Engineer, Distributed Search Infrastructure and Query Performance', employmentType: 'FT' },
  ].map(({ percent, limited, ...role }) => ({
    ...role,
    compensation: percent === 76 ? '$55–$65/hr (fictional demo)' : limited ? '$6,000–$8,000/month (fictional demo)' : undefined,
    postingObservation:{checkedAt:`${date}T12:00:00Z`,liveness:role.id === 'demo-discover-tradeoff' ? 'expired' : role.id === 'demo-discover-unknown' ? 'uncertain' : 'active',postedAt:role.id === 'demo-discover-unknown' ? null : new Date(Date.parse(`${date}T00:00:00`) - (role.id === 'demo-discover-good' ? 0 : 10) * 86400000).toISOString(),description:'Fictional posting observation; no real employer was checked.'},workSetting: 'Remote (demo)', sponsorship: percent === 76 ? 'Visa sponsorship available (fictional demo)' : limited ? 'No visa sponsorship (fictional demo)' : 'Not recorded (demo)',
    reviewPreview: percent === undefined ? [{ question: 'Email', answer: 'candidate@example.com', profileField: 'email' }] : [{ question: 'Can you work onsite three days per week?', required: true, answer: '', reason: 'The work-setting exception needs your decision.' }, ...(limited ? [{ question: 'What is your earliest available start date?', answer: '', reason: 'Confirm your school schedule before answering.' }] : [])],
    location: 'Remote · United States (demo)', category: 'Systems infrastructure',
    priority: 'Strong Consider', applicationUrl: `https://example.com/demo-only/${role.id}`,
    discoveredDate: date, postedDate: null, sourceFreshness: 'Fictional demo listing · not a real opening',
    description: 'Fictional posting for interface review. Build and profile a distributed query service, investigate latency regressions, and document reliability tradeoffs.\n\nWork with engineers on query execution and operational tooling. Production systems experience is preferred; internship eligibility and work setting require confirmation.',
    materialGap: percent === undefined ? '' : limited ? 'Your experience does not yet establish production-scale or ML-serving ownership. Confirm the expected independence and available mentorship before treating this as a strong learning opportunity.' : 'Your query-service experience is relevant, but production-scale ownership is not established. Confirm how much design responsibility you would have and the support available while you learn.',
    whyItFits: limited ? 'Your query-service experience connects to this internship’s performance-debugging work. That scope could deepen the systems skills you want to develop.' : 'Your SQL-service internship and query-planning project connect to this role’s latency and database work. It could deepen the systems experience you want through hands-on performance investigation.',
    ...(percent === undefined ? {} : { matchPreview: { percent, assessedAt: `${date}T12:00:00Z`,
      skillsExperience: {score: limited ? 50 : 75, reasoning: 'Fictional evidence: Go, PostgreSQL and a query-service project align. Production ownership and ML serving remain unverified.'},
      compensation: {score: null, reasoning: limited ? 'Fictional demo: $6,000–$8,000/month is disclosed. An internship benchmark and benefits are unknown; this is not an annual salary.' : 'Fictional demo: the listed range is $55–$65/hr. Your context prioritizes stable pay and health coverage; your minimum and employer benefits are unknown.'},
      wellbeingCulture: {score: null, reasoning: 'Fictional demo: you value regular feedback and sustainable on-call. This posting does not establish management support or rotation frequency; verify both.'},
      locationWorkSetting: {score: limited ? 50 : 100, reasoning: 'Fictional demo: US remote work aligns with your New York base. Eastern working hours and required travel are unconfirmed; relocation remains undecided.'},
    } }),
  }));
}
