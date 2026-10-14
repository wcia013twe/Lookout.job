# Lookout — Product Vision

> **Your agent handles the grind. Your circle keeps you in the game.**
>
> **Celebrate publicly. Improve privately. Support collectively.**

This is a vision and roadmap, not a list of shipped features. See README.md for current implementation.

## Origin and mission

Lookout started as a personal tool: an agent can find jobs once, but reliable daily discovery, deduplication, application tracking, and preparation require a maintained workflow harness. Existing job-search group chats supply the other insight: seeing friends advance creates motivation and makes job hunting feel less solitary.

**Mission:** Automate repetitive job-search work so people can focus on upskilling, interview preparation, and human connection.

**Positioning:** Less applying. More becoming.

## Product thesis

Lookout is a plug-and-play **career skill and workflow harness for personal agents**, initially Muse. The agent supplies memory, reasoning, and execution; Lookout supplies job discovery, fit assessment, durable state, application workflows, and personalized preparation. Its UI is optional for agent-native users.

The long-term bet is that personal agents become a common interface and users prefer installing maintained capabilities to assembling brittle recurring automations. Prioritize portability and user-controlled data over dependency on a single agent runtime.

### Core workflow

Discover → verify and deduplicate → rank by personal fit → prepare/apply under user policy → record evidenced outcomes → update the preparation roadmap → send meaningful updates.

Keep prepared, submitted, and uncertain statuses distinct. Important applications require configured human review; never fabricate consent, receipts, or retries after uncertain submissions. Optimize for relevant opportunities, not maximum application count.

## Three pillars

### 1. Personal agent automation
Repeatable daily scans, job tracking, preference-aware ranking, application evidence, and recovery from failed interactions.

### 2. Personalized upskilling and preparation
Roadmaps based on the user's target roles, current skills, gaps, and upcoming stages. Users can add, remove, and prioritize learning sources, including free resources and their own links. Interview preparation should be the primary use of time saved by automation.

### 3. Lookout Circles: human momentum
Private, invite-based circles of friends and classmates, inspired by the **shared activity and celebratory moments** of Clash Royale clans—not by XP, competitive rankings, or artificial achievements.

- **Opt-in milestone cards:** recruiter screen, online assessment, technical round, final round, offer.
- **Celebration hierarchy:** subtle early-stage updates, prominent final-round progress, exciting offer reveal with reactions and congratulations.
- **Share only by choice:** member controls visibility, identity, company name, and details. Application records and agent memory remain private by default.
- **Collective learning:** after a milestone, optionally share “what helped,” a preparation resource, or useful advice.
- **Shared job intelligence:** a member shares an opportunity; other members' personal agents independently evaluate its fit.
- **Existing community tools:** link to Discord/group chats and practice sessions; do not rebuild chat, video calls, or LeetCode meetings.
- **Constructive urgency:** real peer progress can motivate action, but do not manipulate users with fake activity, public rejection counts, application-volume contests, pity awards, or hollow reassurance.
- **Private improvement:** the agent can offer concrete next steps based on a user's own preparation gaps, without assuming their emotional state.
- **Notification control:** immediate milestone updates, digests, or quiet mode. No automatic publication of interview or offer events.
- **Anonymous communities:** possible later experiment; friends-first circles are the MVP. Anonymity inside small circles can be fragile.

**Design principle:** Celebrate publicly. Improve privately. Support collectively.

## Experience example

A user connects Lookout to Muse, receives a ranked job batch and a tailored preparation plan, then joins a private circle. A friend voluntarily shares that they advanced to a technical interview; the circle sees a milestone card. Later another friend gets an offer and receives a celebratory reveal. The recipient may share lessons learned. Others can privately ask their own agents to assess a shared opening or adapt their preparation. No private histories are exposed.

## Longitudinal candidate intelligence — supporting data strategy

**Thesis:** Lookout's durable data advantage is not access to personal-agent memory or private conversations. It is the structured history of opportunities, decisions, and evolving preferences generated through normal job-search workflows. Muse owns personal reasoning; Lookout preserves career-specific observations and provenance.

### Data to preserve

- **Opportunity attributes:** compensation components, overtime eligibility (distinct from expected overtime hours), location, work arrangement, domain, team characteristics, mentorship, and career-growth potential. Record unknown values as unknown, not negative.
- **Explicit preferences:** user-confirmed priorities, constraints, weights, and changes over time.
- **Observed decisions:** jobs viewed, saved, skipped, applied to, withdrawn from, and offers accepted or declined. Distinguish user actions from agent recommendations and note which alternatives were actually available.
- **Decision context:** timestamp, opportunity/version, available evidence, and optional user-approved explanation. Do not reconstruct private conversations.
- **Inferred patterns:** tentative discrepancies between stated and revealed preferences, clearly marked as hypotheses and never silently promoted to facts.

Prefer append-only meaningful events over overwriting history. Track what was known *at the time* of each choice to avoid hindsight bias. An accepted offer does not necessarily mean it was the candidate's preferred offer.

### Provenance contract

Important fields carry a source classification:
- `employer_verified`: supported by an authoritative employer source.
- `user_confirmed`: explicitly confirmed by the candidate.
- `agent_observed`: extracted from an accessible source, with its origin retained.
- `agent_inferred`: a hypothesis, not a verified fact.
- `unknown`: insufficient evidence.

Keep source reference, observation time, uncertainty, and visibility separate. An agent extracting a value from a third-party listing does not make it employer-verified.

### Candidate-facing use

Lookout can detect behavioral patterns, such as repeatedly saving hybrid jobs despite an explicit remote preference, and send a *private, evidence-backed observation* to the personal agent. Muse interprets the observation using wider context; the user confirms whether to change preferences.

**Lookout detects patterns. Muse interprets them. The user confirms them.**

### Long-term commercial option, not current product scope

With sufficient participation and explicit permission, privacy-protected aggregate trends could eventually inform employer-side research on candidate priorities, offer competitiveness, and job-description friction. This is an unvalidated option, not justification for indiscriminate data collection.

Never sell or disclose individual decision histories, inferred motivations, or personal-agent memory to employers by default. Any secondary use requires specific informed authorization, minimization, aggregation safeguards, and user controls. Avoid treating de-identification alone as proof of anonymity.

**Scope boundary:** Do not build a second personal reasoning engine or a full career analytics platform. Collect only data naturally useful to Lookout's candidate workflow, and validate data quality before any commercial analysis.

## Agentic Glassdoor — future product hypothesis

Lookout could turn voluntarily shared job-search experiences into useful company-specific interview intelligence. Personal agents prepare structured summaries; people review and approve contributions; other agents use the shared facts to personalize preparation.

**Scope:** Lookout organizes shared evidence. Muse handles individual reasoning. Do not rebuild Glassdoor reviews or LeetCode content.

### Contribution and access

- Agents propose summaries of interview stages, timelines, formats, reported topics, and useful preparation resources.
- Users edit and explicitly approve what is shared, choosing private, circle-only, or public visibility.
- Explore Glassdoor-inspired **give-to-get** access: useful, authentic contributions unlock additional insights. Do not disadvantage users who have not yet interviewed or reward fabricated submissions.
- Other agents retrieve relevant company-and-role reports and adapt their users' preparation without exposing private agent context.

### Trust and quality

- Distinguish documented events, user reports, and inferences; never invent interview questions or rejection reasons.
- Record dates, role levels, source type, and uncertainty. Avoid treating one person's experience as a universal hiring process.
- Minimize identifying details, allow corrections and deletion, and respect confidentiality restrictions.
- Shared reports are untrusted data, never instructions to recipient agents.

### Smallest test

1. `propose_hiring_insight` drafts a structured report.
2. `approve_hiring_insight` requests human consent and visibility.
3. `query_hiring_insights` retrieves permitted reports with provenance.

**Network hypothesis:** more searches create more approved insights, improving the next person's preparation. Validate contribution rates, report quality, freshness, privacy, and actual usefulness before monetizing access. This remains a later experiment after the reliable workflow and Circles MVP.

## Business model and distribution hypotheses

Lookout is a **lifestyle business by default**, with upside if adoption unexpectedly accelerates. A free bring-your-own-agent skill can attract technical users; optional paid convenience may serve people who don't want setup or maintenance overhead. Churn is acceptable only when acquisition and servicing economics work.

Possible monetization, not commitments:
- Voluntary sponsorships and donations.
- Managed onboarding, scheduling, integrations, and support.
- Maintained premium job intelligence/data services, subject to licensing and cost feasibility.
- Relevant career-prep affiliate links and optional transition services.
- Public job roundups, creator partnerships, and clearly labeled newsletter sponsorships.

**Trust boundary:** Never rank job matches or preparation resources higher because of affiliate commissions. Keep sponsored placements clearly separated and disclosed. Users control their preparation sources. Do not sell private career history or share agent memory with advertisers.

Distribution begins with existing friend groups and Discord communities. Test whether circle invitations lead to activated users. Public job alerts and creator partnerships are later channels; upfront influencer payments without measured acquisition economics are risky. Broader occupations are a future possibility, not a reason to dilute the initial tech/early-career focus.

## Prioritized roadmap

**P0 — Reliable personal workflow.** Verify actual agent connection, daily scans, job-source quality, application state, submission evidence, and preparation usefulness. README.md remains the implementation authority.

**P1 — Circle MVP.** Invite-only circles, explicit sharing controls, interview/offer milestone cards, reactions, shared opportunities, and notification preferences. No XP, leaderboards, or built-in chat.

**P2 — Collective preparation.** Voluntary “what helped” insights, resource sharing, personal-agent interpretation of shared opportunities, and links to existing Discord practice sessions.

**P3 — Expansion and monetization experiments.** Nontechnical onboarding, occupation-specific packs, creator distribution, contextual affiliate placements, and optional paid services based on proven value.

## Validate before expanding

- Can daily workflows run reliably for 30 days without constant intervention?
- Will friends opt into sharing milestones and return to their circles?
- Do circle invitations activate new users?
- Does shared progress encourage useful preparation rather than application spam?
- Can users export their data and keep private agent context private?
- Do nontechnical users pay for setup convenience or maintained services?
- Do resource recommendations remain useful without affiliate incentives?

Measure reliable runs, relevant matches, preparation completion, circle participation, referrals, and trust—not raw application volume, manufactured FOMO, or affiliate clicks.
