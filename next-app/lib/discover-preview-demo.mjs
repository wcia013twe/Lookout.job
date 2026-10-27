// UI-only scenarios: fictional employers, candidates and scores; no service calls.
export function discoverPreviewRoles(date) {
  return [
    { id: 'demo-discover-good', company: 'Example Query Labs (demo)', title: 'Backend Engineer, Query Systems', employmentType: 'FT', percent: 76, limited: false },
    { id: 'demo-discover-tradeoff', company: 'Example Compute (demo)', title: 'ML Systems Intern', employmentType: 'Internship', percent: 54, limited: true },
    { id: 'demo-discover-unknown', company: 'Example Search (demo)', title: 'Software Engineer, Distributed Search Infrastructure and Query Performance', employmentType: 'FT' },
  ].map(({ percent, limited, ...role }) => ({
    ...role,
    compensation: percent === 76 ? '$55–$65/hr (fictional demo)' : undefined,
    postingObservation:{checkedAt:`${date}T12:00:00Z`,liveness:'active',postedAt:null,description:'Fictional live posting observation.'},workSetting: 'Remote (demo)', sponsorship: 'Not recorded (demo)',
    reviewPreview: percent === undefined ? [{ question: 'Email', answer: 'candidate@example.com', profileField: 'email' }] : [{ question: 'Can you work onsite three days per week?', required: true, answer: '', reason: 'The work-setting exception needs your decision.' }, ...(limited ? [{ question: 'What is your earliest available start date?', answer: '', reason: 'Confirm your school schedule before answering.' }] : [])],
    location: 'Remote · United States (demo)', category: 'Systems infrastructure',
    priority: 'Strong Consider', applicationUrl: 'https://example.com/demo-only',
    discoveredDate: date, postedDate: null, sourceFreshness: 'Fictional demo listing · not a real opening',
    description: 'Fictional posting for interface review. Build and profile a distributed query service, investigate latency regressions, and document reliability tradeoffs.\n\nWork with engineers on query execution and operational tooling. Production systems experience is preferred; internship eligibility and work setting require confirmation.',
    materialGap: percent === undefined ? '' : 'Fictional assessment: production-scale ownership is not established. Verify team scope and expectations.',
    whyItFits: limited ? 'Potential trade-up in this fictional scenario: systems internship scope could deepen performance-debugging experience. The demo profile has a query-service project, but ML serving experience is not established. Verify mentorship, conversion potential and whether a graduation delay is justified.' : 'The fictional profile describes a SQL-service internship and a query-planning project, which connect to this example’s latency and database work. The material gap is evidence of production-scale ownership; a project alone does not establish that experience.',
    ...(percent === undefined ? {} : { matchPreview: { percent, assessedAt: `${date}T12:00:00Z`,
      skillsExperience: {score: limited ? 50 : 75, reasoning: 'Fictional evidence: Go, PostgreSQL and a query-service project align. Production ownership and ML serving remain unverified.'},
      compensation: {score: limited ? null : 75, reasoning: limited ? 'No compensation evidence is included in this example.' : 'Illustrative assumption only: pay aligns with the demo target. No employer compensation was verified.'},
      wellbeingCulture: {score: 25, reasoning: 'Illustrative concern: on-call expectations are unclear. This is not a factual assessment of employer culture.'},
      locationWorkSetting: {score: limited ? 50 : 100, reasoning: 'The fictional posting allows US remote work. Actual location eligibility and working hours need confirmation.'},
    } }),
  }));
}
