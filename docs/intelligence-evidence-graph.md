# Bounded evidence graph retrieval

The Node module `backend/intelligence/evidence-graph.ts` implements the minimal relationship-expansion portion of the proposed Lavish flow. It starts from permitted cleaned reports and follows their explicit post references and attached public resource links. It does not infer relationships from embeddings, build a separate graph database, fetch resource pages, generate answers or enable global sharing.

## Integration contract

- `GRAPH_TOOL_DESCRIPTOR` describes `expand_demo_intelligence_evidence` with typed seeds `{sourceType, sourceId}`. `validateGraphArgs` rejects unknown fields, duplicate seeds, invalid source types/IDs and out-of-range limits. Defaults are one hop and 30 nodes; at most 10 seeds and two hops are accepted.
- The caller authenticates/selects the owner and loads only current, permitted seed reports. Caller-provided IDs are requests to look up a report, not authorization.
- `expandEvidenceGraph(seeds, resolvePostReference, options)` takes cleaned report projections in the existing database row shape. The resolver receives `{circleId, postId, revision, label}` and must validate the actual Circle identity plus current publication, ownership/access and source fingerprint. Return `null` for unavailable, withdrawn, private or mismatched targets. Resolver failure rejects the entire operation rather than returning a partially authorized graph.
- The module additionally checks the returned source type/ID and any pinned revision before including the target. A null revision means an unpinned pointer resolved to the current eligible revision. Inconsistent versions of the same report in one expansion fail closed.

The local Node service registers this descriptor and routes HTTP and MCP through the same validated operation. Its resolver reloads permitted sources, verifies the actual source Circle and stored content fingerprint, and applies the account owner boundary before returning evidence. This is not a hosted deployment.

## Evidence packet

`nodes` contains explicit allowlisted report fields (cleaned text, source type/ID/revision, title, company, role, stage, experience date, provenance and uncertainty) or resource URLs/labels. It never copies arbitrary resolver properties, raw `post_references`, embedding text, vectors or ownership metadata.

`edges` uses only `references_post` and `attached_resource`, with the originating source type/ID/revision as evidence. A mention or attachment is **not** labeled as a recommendation, endorsement, same-person relationship or verified claim. Linked-post labels and target IDs appear only after the target passes the resolver and revision checks. Resource URLs must pass the existing public-context validator plus local/IP/signed-query checks; no page content is retrieved.

Nodes and edges deduplicate; cycles terminate without repeated expansion. The packet is bounded to 30 nodes, 50 edges, 100 resolver calls and two hops. `truncated` indicates only operational depth/node/edge/lookup bounds. It provides no private-target diagnostic, target identity or unavailable-target count. Report nodes at the depth boundary remain readable evidence but their outgoing links are not expanded.

## Verification and limits

The isolated fictional tests cover explicit provenance, uncertainty preservation, deduplication, cycles, depth limits, all size/lookup budgets, missing/private/withdrawn targets, source and revision mismatches, unsafe resource URLs, resolver failure, strict tool arguments and projection against accidental embedding/owner/reference leakage. These are backend fixture states, not an admin UI or external service activation.

This module relies on the caller's source-access checks. It does not independently authenticate users or create a transactional snapshot of source permissions. Service integration tests cover owner isolation, actual Circle mismatches, missing and withdrawn sources, pinned revisions, no embedding calls, and MCP over HTTP parity. Only explicit outgoing links are traversed; reply ingestion, inverse relationships, inferred topics, global-sharing policy and answer generation remain outside this implementation.
