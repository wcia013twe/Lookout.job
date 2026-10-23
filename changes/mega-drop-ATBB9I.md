# Mega drops

- Same-company, same-day relevant roles now form Mega drops of up to five cards. Additional roles continue in another drop; skipped roles and different days stay separate.
- A Mega drop starts with the ordinary mystery card. Its first reveal flips extra cards into place to the right and shifts the original left. Reduced-motion preferences remove spatial movement. Reveal all and XP eligibility retain existing behavior.
- Demo mode includes five explicitly fictional NVIDIA roles across full-time and internships. Verified ordinary first-card state, keyboard reveal, pointer reveal, five-card layout, reveal-all and mobile completion layout in Chrome.
- MCP boundary: pack opening is a human-only client presentation of the existing drop feed, with no new backend mutation or agent approval. No tool or deployed parity claim added.
- Validation: all 444 tests passed; data validation passed (147 roles); production static export passed. Grouping regression covers cap, overflow, company/day isolation, skipped roles and demo fixture.
- Limits: mobile Mega expansion and reduced-motion behavior implemented but not visually exercised. Next.js reported an existing dependency security advisory; its one-time interruption cleared on retry. No dependency changes or production deployment.

## Appearance follow-up

- Moved all six pack texture choices out of the opening dialog into Profile → Appearance beside color theme, with a live wrapper preview and a direct profile-menu shortcut. Header and Appearance color controls stay synchronized.
- Demo uses the same picker against its isolated memory store. Verified switching Original to Lagoon in demo and desktop/mobile layout; existing demo reset remains available.
- Existing contract retained: `save_theme_preferences` edits `preferences.theme.pack`; browser changes retain the existing store/cloud preference path and validation. No backend or gateway contract changed. Existing theme tool tests pass in the full suite.
- Validation: 444 tests and 147-role data validation passed; production static export passed. Visual verification used Chrome. Live cloud persistence and the deployed MCP endpoint were not exercised.

## Sequential Mega reveal follow-up

- First activation begins a count-only deal: one face-down card lands per beat, pushing earlier cards left. No role advances during this sequence; cards unlock only after the last landing. On narrow screens the row scrolls toward each arriving card.
- Every unopened/upgrading card is now one native full-surface button with Enter/Space support. Revealed cards retain ordinary posting links and details. Timers clean up on close/group changes, reduced motion keeps the sequential count with shorter, non-spatial steps, and Reveal all is unavailable during dealing.
- Demo retains the five-card fictional fixture. Chrome verification confirmed the initial deal lock, final five face-down cards, and pointer/keyboard opening of individual cards.
- Validation: 444 tests, typecheck, data validation and production export passed. This remains client presentation using the existing feed/preferences contracts; no new backend or MCP action. Mobile horizontal card layout verified; mobile deal animation and reduced-motion timing not visually exercised.
