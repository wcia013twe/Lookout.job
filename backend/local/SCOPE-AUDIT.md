# MCP and SQL scope audit

The audit compared each MCP tool's advertised mandatory scopes with the owning
SQL authorization path in a disposable migrated database. Existing metadata
omitted mandatory read scopes on several write tools and the preference scope
on resume-source replacement. Discovery could expose those tools to credentials
which SQL then rejected. The correction adds required scopes to discovery and
call validation; SQL authorization is retained.

`tests/mcp-scope-audit.test.mjs` exercises every current tool using only its
advertised scopes, including payload-known conditional requirements. It routes
outreach, backend jobs, submission and gateway-derived authorization to their
actual SQL entry points. Each call runs in a rolled-back transaction. Empty or
minimal arguments may reach argument or owned-record validation; an
insufficient-privilege error means the advertised scope contract is incomplete.
Row-dependent requirements, valid writes, web/MCP transport behavior and deployed
availability require their separate scenarios and checks.

The new backend execution boundary keeps browser ownership, opaque agent
credentials and service-role worker authority separate. Its five MCP operations
match the queue RPC's mandatory scopes. Worker dispatch accepts only the bounded
search operations, checks the live lease and credential, and pins writes to the
job's profile and search run. Human cancellation invalidates the lease, and
workspace reset includes queue records with the existing write guard.

A confirmed lifecycle defect left a cancelled or exhausted job's pinned search
run active, preventing a later job for the same profile from starting. Terminal
queue cleanup now closes only that owned pinned active run, retaining existing
evidence; tests cover cancellation, partial completion and retry exhaustion.
This does not restore a production database, enable worker execution or establish
hosted availability.
