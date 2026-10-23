# Lookout onboarding

The Next.js `/onboarding/` route introduces background, work preferences, a catalog opportunity, the existing agent connection flow, and an optional Circle story. Its presentation components are in `next-app/components/onboarding-*.tsx`, with scoped styles in `next-app/app/onboarding.css`.

A LinkedIn URL is a profile reference, not an OAuth connection or import. Résumé uploads reuse the private résumé service and its ownership, file-type, size and hash validation. Guests must sign in to upload. Demo mode uses fictional résumé metadata and never opens or uploads private files.

The catalog preview deterministically filters existing roles by the supplied preferences. It is not a live external search or personalized analysis. Only demo cards show illustrative fit bars. A selected role becomes a request for the connected agent to verify the current opening; the browser cannot manufacture the agent's runtime or first-match evidence.

## Existing service and tool boundaries

- Search preferences reuse ApplicationProfileProvider and the versioned search-profile service (`save_search_profile`); agents continue to use the existing scoped profile tools.
- Background references and résumé selection reuse profile and résumé services and their existing scoped tools. File upload remains a human browser action; agents cannot supply human review.
- Connection, intent, first match, policy and preparation reuse the onboarding service and `tasks.create` boundaries. Ownership, revisions, idempotency, prerequisites and uncertain-submission safeguards remain authoritative.
- Saved profile verification is an explicit human-only checkbox using the shared profile-review helper. Unsaved changes disable it; saved edits invalidate it. It is not permission to submit an application. Agent paths cannot forge this review.
- Country changes clear authorization and sponsorship answers through the existing eligibility model. These remain separate from application approval.
- Circle storytelling is a labeled, fictional animation and navigation to the existing Circles page. It creates no message, membership, calendar event or submission and adds no service capability.

The `?demo=1` path exercises the same UI with isolated in-memory fixtures, including a simulated runtime connection and preparation completion. Real connected-agent search, model analysis, upload, notification delivery and external execution require their existing authenticated services; this pass does not claim new deployed MCP capabilities.

The connection scene keeps the call-room preview (including ChatGPT, Claude and Gemini) and a three-item plugin/MCP checklist. These are provider choices, not claims that a plugin is installed or supported by every account. Onboarding fixes access to Prepare jobs and applications and creates a 30-day connection through the existing human-only credential boundary. Successful clipboard copy reveals Next. Full connection management remains in Profile.

Next opens a phone-style status screen polling `onboarding.get_state`; only a runtime connection ID and valid browsing check-in timestamp count as connected. Issuing or copying a credential never counts. The agent must perform the existing agent-only runtime check; the browser never submits that real event. Users can wait or defer. Continue after check-in opens Circles, without claiming the remaining job preparation or notification setup is complete. This phone is an illustration, not SMS verification or a notification channel. Demo copy contains fictional text, and demo runtime confirmation stays inside the existing in-memory fixture.

When catalog matching returns no role, onboarding goes directly to connection setup. The Circle introduction stays two short messages with its invitation immediately available; no booking or message is created. Existing scoped tools, permissions and backend state transitions remain unchanged.
