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

The final screen includes device-specific instructions for saving Lookout as a browser app, also covered by demo mode. This is a human browser-menu action, not an agent install capability. The guide is hidden in standalone mode and links to the browser vendor’s help.

Onboarding Circle invites stay inline: the user pastes a code and submits Join Circle through the existing circles.join action and shared authenticated Circle client. The saved preferred/first name is disclosed as their Circle alias; missing names require entry. Retries reuse the same event key for unchanged inputs. Demo membership remains fictional. This replaces navigation to full Circle management during onboarding and adds no backend capability or new MCP scope.

The preferences step always opens the card reveal. If catalog selection returns nothing, the reveal uses a labeled fictional ExampleCo sample with illustrative scores and no application URL; it is not passed as a real opportunity to the agent or submission flow. The next action connects the agent. This replaces the direct no-match bypass.

## Dashboard tour

Open my workspace requests the three-step dashboard tour (`tour=dashboard`); completed/skipped tours do not auto-run again for that account in the browser. The Profile replay link uses `tour=replay`. Launch parameters are removed once consumed. Real dismissal is versioned, account-scoped local browser state; demo dismissal stays in memory. Account changes and navigation unmount the tour. The tour only reads layout anchors and dismisses itself; it performs no domain action and adds no backend/MCP interface. Native dialog focus and Escape are supported, with reduced-motion transitions and a mobile bottom panel. The final step explains that connected-agent search, draft preparation and tracking can be used with the dashboard closed; it does not promise active notifications or automated submission.

The tour now opens with the agent-workspace/no-open-dashboard explanation and covers five compact stops: workspace, Discover, Applications/Action board, Career Toolkit/Network and Circles. It uses decorative shared icons and short motion sequences rather than visiting feature pages. Navigation highlights have larger padding and borders; Profile is no longer a stop. Tour version 2 retains the same automatic/replay and isolated-demo rules.

Signed-in Discover starts empty until its existing private batch loader supplies a batch; it no longer silently shows shared catalog cards as personal work. Explore public roles explicitly opens the shared catalog, and Back to my agent’s finds returns to the personal view. Anonymous public browsing remains available. Demo onboarding marks a new-workspace arrival in memory; regular populated demo fixtures remain available outside that path. This changes presentation only; batch loading and scoped agent services remain unchanged.

The revised sequence now introduces the workspace, then highlights each tab separately in navigation order: Action board, Discover, Applications, Network, Career Toolkit and Circles. Network has a decorative person-to-three-nodes animation; it displays no real contacts and performs no connection or outreach action.

Every tour stop has a small decorative motion sequence. Shared diagram primitives power workspace, application progress, Network and Circles; compact paper/row/card primitives illustrate Toolkit, review and Discover. These contain no real records or simulated live status and render immediately under reduced motion.

## Bring an existing job search

Onboarding’s first screen and Applications reuse a compact Bring your existing search disclosure. It explains exporting CSV from Simplify or Excel and sharing it directly with the connected agent, with a copyable request and manual-copy fallback. The website neither uploads nor parses a file. The request asks the agent to inspect available capabilities, deduplicate, preserve existing statuses, clarify conflicts and report actual saves. Imported progress must remain user-reported, never an employer receipt. Existing batches.publish, drafts.prepare and applications.progress boundaries may be used only where the connected agent supports the relevant operation and scopes; no new import tool or deployed CSV importer is advertised. Sharing a CSV remains an explicit user action in their agent’s chat. Demo copy performs no network or account mutation.
