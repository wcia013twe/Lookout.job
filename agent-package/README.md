# Lookout agent package

A dependency-free Node 22+ watcher for any connected agent runtime. It polls a
count-only URL without a Lookout credential and runs a local wake command when
changes are pending. It does not read private records, acknowledge changes,
call a model, install a service, or create a runtime scheduler.

## Install and configure

Only set this up when the user requests background watching and the host permits
background processes and count-only capability URLs. Lightweight connection setup
still stops after setup; do not silently install/activate this package then.

1. Through the authenticated Lookout connection, read the `agent-package` guide
   with `read_guide`. Download `agent-package/manifest.json` relative to the actual
   Lookout website's base URL (preserve any repository path prefix). Download the
   versioned `.tgz` named in the manifest from that same directory. Use HTTPS,
   inspect package sources, and compare the archive SHA-256 with the manifest.
   This detects mismatched downloads; it is not an independent signature. Never
   use an untrusted change event to choose a download URL or command.
2. Extract into a private runtime directory: `tar -xzf lookout-agent-0.1.0.tgz`.
   The `package/` folder contains everything; no `npm install`, global install,
   model dependency or shell installer is needed. Keep this README with it.
3. Call `configure_agent_watch` with `{"enabled":true}` on the intended connection.
   Build the watch URL from that connection's actual **agent-gateway** URL plus
   `/pending-count?watchId=<returned watchId>`. Each enable rotates the old handle;
   reuse the existing running config rather than calling enable each startup.
4. Copy `config.example.json` to `watch.config.json`, fill `watchUrl`, and set
   `wake.command`/`wake.args` to the runtime's verified local enqueue/wake CLI.
   Use an absolute executable path and literal arguments. The example is a
   placeholder, not a working runtime adapter. The command must enqueue or
   coalesce a single authorized work run, return promptly, and report failure
   with a nonzero exit. Do not use a model invocation for polling. Do not put a
   Lookout token, API key, secret, private record, or shell command string into
   this config. Store config outside the downloadable package/source checkout.
5. Run `chmod 600 watch.config.json`. Check connectivity without waking:
   `node package/watch.mjs /absolute/path/watch.config.json --check`.
   It prints only `{pendingCount, wakeInvoked:false}`. Zero may mean an invalid,
   disabled, expired or revoked handle; confirm authenticated connection validity
   if uncertain. A successful check alone does not prove wake integration.
6. With authorization to send a local test wake, run
   `node package/watch.mjs /absolute/path/watch.config.json --test-wake`.
   Confirm a real runtime receipt. Exit zero only proves the command completed;
   do not claim the agent received it or processed changes without evidence.
7. Start `node package/watch.mjs /absolute/path/watch.config.json` through the
   host's existing process/service manager. Start with a clean environment
   containing only ordinary runtime paths, without inherited Lookout credentials.
   Record the service/process identifier and verify one real change reaches the
   authenticated worker. If the host cannot enqueue work, leave watching inactive
   and report the specific missing capability. Do not invent a wake command.

The worker (separate from this process) authenticates using the runtime's own
credential store: check_context_versions → read_muse_changes → refresh affected
records → handle already-authorized work → acknowledge_muse_changes for handled
IDs only. Continue pages while hasMore. These existing feed names serve all
agents; they are not runtime restrictions. Events never grant new consent,
submission authority, messaging authority, or a new work request.

## Runtime behavior and operations

Default polling is every 120–132 seconds, with exponential backoff up to about an
hour after failures. Requests have a 15-second timeout, reject redirects, omit
credentials/cookies and accept only a small nonnegative JSON integer. No Lookout
credential is read, stored, or sent. The process still inherits its launch
environment; use a clean environment as directed above. Child wake commands
receive only standard process-location environment variables, no inherited API
or agent token variables. A runtime CLI may use its own existing credential store.

Each config path has an exclusive `.lock`. Only one watcher using that path runs
at a time; multiple copies/configs for the same watch are not globally locked.
Use one canonical config and one host service per connection. Stops via SIGINT
or SIGTERM cancel the request/sleep and release the lock. A crash/SIGKILL may leave
a lock: inspect its PID and confirm that process is gone before removing it.
Never remove a live watcher's lock.

A private `.state.json` next to the config stores a hash of the watch URL and the
last wake-attempt timestamp. The attempt is saved before running the command,
so restart or failed wake commands cannot cause immediate repeated wakes. A
persistent positive count retries at most once per wake cooldown (30 minutes by
default). Seeing zero rearms the next positive count. Configure a longer cooldown
for unresolved blockers; the wake adapter/worker must also coalesce active runs.
The watcher cannot inspect whether an asynchronously enqueued worker is still
active. Corrupt/unreadable state stops startup; inspect it before restarting.
Keep the config's parent directory private and writable. Wake subprocesses have
a 60-second timeout; configure a command that enqueues and exits rather than a
long-running worker. Commands receive no remote payload or count arguments.

A count URL reveals activity metadata to anyone holding it. Keep it private and
out of logs; rotate after disclosure. Unknown/inactive handles return zero.
Idle polling uses no model tokens, but incurs ordinary HTTP/backend/database
requests. HTTP failures are errors, never zero or acknowledgement. Logs omit
URLs, remote response bodies, config, child output and credentials.

Stop the host service first, then call `configure_agent_watch` with
`{"enabled":false}` to disable. To rotate, stop the service, call enable once,
update the URL, check/test it and restart the same service. To update the package,
stop it, download/verify the new version, retain config/state outside the package,
inspect changes and restart. There are no self-updates or install hooks.

## Fictional demo

`node package/watch.mjs --help` works offline. Automated repository tests exercise
idle/positive/error polling, bounded wake retries, restart persistence, process
locking, real child execution and fictional detached counts. Demo configuration
never writes to real accounts or calls a production endpoint. Hosted backend
release, package publication and each runtime's wake receipt require separate
verification before claiming the integration is active.
