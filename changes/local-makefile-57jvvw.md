# Local Makefile startup

- Added `make dev` / `make up` (default `make`) for ordered Supabase Docker startup followed by the host frontend at localhost:3000, plus install, services, frontend, status and data-preserving down targets.
- Added local Supabase configuration using the existing migration chain. The frontend launcher reads only the local API URL and anonymous key; account sync and gateway/MCP links follow the selected backend while ordinary npm dev retains the hosted default.
- Documented startup and ownership boundaries in README and AGENTS.md. Updated OpenWiki quickstart and delivery prose directly at the user's request; lifecycle tools are unavailable, so generated Claims/provenance were not refreshed.
- Validation: all 552 npm tests passed; validate:data passed (158 roles); production static build passed; make help and make -n dev passed; make frontend returned HTTP 200 on port 3000 using the already running local stack. git diff --check passed.
- Limits: did not start, stop, reset or rebind the existing lookout-local Docker stack, whose Edge Runtime mounts another active checkout. Fresh-container migration startup, local Google OAuth and authenticated agent round trips remain unverified. The frontend smoke-test processes were stopped afterward.
- Demo/MCP coverage: no product actions or demo fixtures changed; existing demo and contract tests passed. Only displayed endpoint selection follows local frontend configuration.
