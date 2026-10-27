# Posting-specific interview intelligence

The platform read operation is `knowledge.interview`; its MCP name is `read_interview_intelligence`. The existing Node API routes it directly to the credential-checked database dispatch. The signed-in website calls the existing `knowledge_action` RPC. Both reach the same `private.interview_intelligence` implementation and return the same evidence packet.

## Input and access

Supply exactly one owned `applicationId` or canonical catalog `jobId`. Optional `stage`, `since`/`until` (reported experience dates), and `limit` (1–10, default 10) constrain the result. Application ownership is checked before resolving the posting. Agents need both `knowledge:read` and `workspace:read`; discovery advertises both. Human requests use `auth.uid()`. No caller-provided owner, company, role, SQL or permission override is accepted.

The server resolves posting metadata from existing applications/jobs. Sources are published top-level discussion/interview/timeline/milestone reports in active Circle memberships, including other members' permitted reports. Current published revisions are read directly; edits awaiting publication cannot replace the published text. Drafts, withdrawn/hidden posts, private application milestones, unrelated postings and former memberships are excluded before the limit. General resources and replies are not used as seed reports.

A source must explicitly reference the canonical posting URL, or the canonical catalog job ID together with its company. Primary fields or one attached context must satisfy the posting and stage predicates together. Employer requisition IDs are not silently equated with internal job IDs; a shared canonical URL can establish the association. No company/title fallback runs when exact posting results are empty. This deliberately favors an empty result over conflating hiring cycles. Older reports without an explicit posting association remain available through the existing company/Circle search.

## Website and Muse

The application Overview adds a compact “From your Circles” section only when reports exist, with dated report text, uncertainty and source-conversation links. The “Check interview reports” action remains available. Automatic empty results have no empty-state message; an explicit check explains that no matching reports were found in accessible Circles. The panel refreshes on focus/manual request, discards stale account/posting responses and reports failures separately from empty results. It currently covers catalog-backed applications; imported-only tracker records without a catalog association are excluded.

The MCP tool returns `status`, `automaticAction`, server-resolved `scope`, `evidence` and bounded `coverage`. The packet follows the source/revision shape used by the local Muse gate and is compatible with `presentMuseInsight` in `backend/intelligence/muse.ts`. A host can read the platform tool, skip interpretation for `no_discussions`, interpret useful source-exact excerpts, then use that presenter to enforce automatic silence and quote/citation checks. Raw external agents receive the same behavioral instructions through developer context; the platform cannot force an external host's rendering behavior. Developer version was incremented for tool/instruction refresh.

There is no server-side model call, new search engine, vector requirement, background message, group creation, count aggregation or global-sharing change. Platform reads use live permitted source revisions rather than the local evaluation staging store. Automatic graph expansion remains off; existing scoped thread reads provide full conversation context. This pass does not deploy the local graph-expansion endpoint as a global service.

## Verification and release boundary

`tests/interview-intelligence-platform.test.mjs` verifies the actual migrated SQL through authenticated human RPC and Node HTTP/MCP: exact posting association, employer-ID distinction, attached contexts, stage/date/limit filtering, private function denial, owner isolation, required scopes, published-versus-draft revisions, withdrawals, membership removal and credential revocation. Existing scope-audit tests check that discovery agrees with SQL authorization.

The detached demo includes an explicitly associated fictional Cedar report and empty postings. `scripts/check-interview-intelligence-ui.mjs` verifies source links, refresh, automatic silence and explicit empty feedback at desktop/mobile sizes, with zero cloud calls. Screenshots are local verification artifacts, not real account evidence.

Code landing alone does not update an already-running checkout or deploy hosted services. Release requires the new migration, updated Node API/registry, gateway developer context and frontend build. This pass verifies those contracts locally and in isolated databases; it does not apply migrations to another session's stack, change hosted data or advertise hosted activation.
