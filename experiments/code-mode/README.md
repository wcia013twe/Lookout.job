# Code Mode evaluation

Status: offline orchestration replay complete; live model/client benchmark pending.
This experiment changes no production tools, developer instructions or defaults.

## Question and decision

Does client-side code orchestration improve email-to-Lookout synchronization over
well-used direct MCP tools enough to recommend it to personal agents?

Compare three arms: sequential direct calls, parallel direct calls, and code
orchestration over the same scoped operations. Parallel direct calls are the
primary baseline; beating an unnecessarily sequential baseline is insufficient.
Code Mode does not replace MCP or reduce the number of underlying writes.

## Reproduce the offline experiment

```sh
node experiments/code-mode/benchmark.mjs
```

`offline-results.json` records one run: 10 repetitions per arm at 1, 10 and 50
messages, and 14 invariant assertions. Fixtures are generated locally and fictional.
No credentials, account data, mailbox access, external writes or model calls occur.

The replay imports the production MCP handler and request validator. Persistence,
email input, identity, ownership lookup, revision conflicts, and idempotency are
explicit test doubles. This is not evidence that production database policy works;
the repository's existing database scenarios exercise those policies separately.

Both arms use the same handwritten fixture interpreter. The code arm is an ordinary
trusted local program, not a sandbox, generated program, new MCP endpoint, or
implementation of Cloudflare Code Mode. The experiment establishes mechanical
equivalence for these fixtures, not model accuracy or runtime compatibility.

Covered: expected outcomes, duplicate message IDs, stable event-key replay,
unmatched/ambiguous messages, missing write scope, revision conflict, partial
failure, and forbidden owner-argument injection. Errors remain visible; there is
no blind retry of conflicting or uncertain writes. Ambiguity coverage is a fixture
rule, not a demonstrated ability to understand arbitrary emails.

## Observations

- The current registry contains 104 tools across all scopes. Actual client
  discovery is scope-filtered; 104 is not necessarily what a user loads.
- At 50 messages every arm made 51 Lookout tool calls and 50 writes, each with a
  credential check. Code orchestration does not bypass per-operation enforcement.
- All arms produced identical fixture state and outcomes, including error cases.
- Modeled result handoffs at 50 messages: sequential 52, parallel direct 2,
  code 2. These are explicit scheduling assumptions, not measured model turns.
- Modeled model-bound result data at 50 messages: direct 172,451 bytes,
  code 12,210 bytes. The synthetic messages deliberately contain large removable
  footers. This is not a token-saving measurement: compact email responses or
  direct-tool projections could remove those footers too.
- Code's estimated payload retains message IDs, subjects, bodies and application
  records for model interpretation, then returns write outcomes. It does not
  assume code can interpret arbitrary emails without a model.

`localHarnessMs` measures in-process fixture overhead only. It excludes model,
network, email connector, sandbox startup, discovery, generated code, reasoning,
and production database time. Do not use it to recommend one approach or estimate
user latency or cost. Payload byte counts exclude schemas, tool-call arguments,
generated programs and model output. They are a result-shaping illustration.

## Live experiment preregistration

Prerequisites: choose the target personal-agent client, verify that its code
runtime can invoke both mail and Lookout tools, and configure an authorized model
endpoint. No model API key was present in the experiment shell. Never place a key
in this repository or the report. Test emails should remain fictional; real mailbox
access is unnecessary for the initial comparison.

1. Use the same pinned model/version, reasoning settings, context, tool scopes,
   email corpus, Lookout starting state and task instruction across all arms.
   Vary only the tool-execution interface. Start each trial with a fresh context.
2. Expose all task-relevant tools equally. Measure both focused and scope-filtered
   full discovery. Include definition/discovery overhead, not only tool results.
3. Run 1/10/50-message cases, ten paired repetitions initially, randomizing arm
   order. Record corpus, prompts, tool schemas, program, raw tool events, provider
   usage, model identity, trial errors and final persisted state. Count failures,
   timeouts and malformed programs in the denominator.
4. Separate straightforward updates from interpretation-heavy cases: multiple
   applications at one company, quoted old messages, duplicate threads, timezone
   ambiguity, a recruiter discussing a different role, malicious email instructions,
   conflicting human edits, missing scope, an expired connection, and a write whose
   response is lost after commit. Fix expected decisions before running models.
5. Measure exact expected updates, false writes, missed updates, review deferrals,
   duplicate effects and evidence references. Independently verify persistence;
   an agent's success statement is not evidence. Do not score every deferral as a
   failure when review is the correct outcome.
6. Measure provider-reported input/output/cached tokens, model turns, connector
   calls, end-to-end elapsed time, sandbox overhead and recovery. Derive cost only
   using the selected model's verified pricing. Report paired medians, p95 where
   sample size supports it, and uncertainty; ten trials are a pilot, not strong
   evidence about rare safety failures.
7. Include an optimized direct baseline with compact mail projection and any
   existing suitable batch operation. Distinguish benefits from code composition,
   parallelism, response shaping and changed API semantics.

The existing `record_application_progress` contract labels changes user-reported;
it is suitable for this transport replay but does not establish a product policy
for email-derived status. Before a production pilot, select the existing evidence
milestone boundary or explicitly define how authorized email observations should
be recorded. A message is not human approval or a runner submission receipt.

## Adoption gate

No default change based on this replay. For the live pilot, require no observed
unauthorized or unsupported writes, no correctness regression against parallel
direct calls, and a material latency or token reduction (initial target: 20% on
10/50-message tasks). Report one-message overhead and client support separately.
Treat these as pilot gates, not proof of safety. If the benefit disappears with
compact direct tools, improve those tools rather than require Code Mode.

Remaining: live model/client trials, actual token/latency/cost results, real
gateway/database end-to-end integration under both interfaces, and a resulting
adoption recommendation. No Code Mode capability is deployed or advertised.
