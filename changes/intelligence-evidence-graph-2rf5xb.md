# Bounded intelligence evidence graph

- Added a small Node module for one/two-hop traversal of explicit post references and attached public resources. No graph database, inferred edges, model calls, resource fetching or sharing changes. Typed seed validation and a narrowly scoped tool descriptor are exported for the parent service integration.
- Report projections omit raw references, embeddings and ownership metadata; rejected/private/withdrawn/pinned-mismatch targets do not expose IDs or labels. Every retained edge carries source revision evidence and uses references_post or attached_resource rather than inventing a recommendation.
- Deduplication and cycle handling bound expansion to 10 seeds, 30 nodes, 50 edges and 100 lookups; truncation flags identify operational caps only. Added six fictional backend tests for lifecycle/privacy, provenance, projection, strict validation and bounds.
- Validation: six focused graph tests and intelligence type checking passed; catalog validation runs before commit. Parent integration runs the full suite and HTTP/MCP parity checks after cherry-pick.
- Limits: this module does not authenticate callers or register/deploy its tool. The resolver must verify current eligibility and actual Circle identity. No frontend/admin demo interaction, graph persistence, inverse links, reply ingestion, global-sharing policy or answer generation is claimed.
