"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useWorkspace } from "../lib/workspace";
import { Section, Field, control, primary, secondary } from "./ui";
import { errorMessage } from "./profile-types";
import { invokeConnection } from "../../lib/agent-connections.mjs";
type AgentConnection = { id: string; name: string; scopes: string[]; expires_at: string; revoked_at?: string };
const gateway =
    "https://umhqfqzpwmszhcknwtrs.supabase.co/functions/v1/agent-gateway",
  mcp = "https://umhqfqzpwmszhcknwtrs.supabase.co/functions/v1/agent-mcp";
const optionalScopes = [["knowledge:read","Read permitted Circle knowledge"],["knowledge:write","Propose contributions and record citation use (also enable knowledge read)"],["preferences:write","Edit search profiles and preferences"],["answers:write","Edit saved answers"],["resumes:write","Upload and add résumés"],["network:write","Edit contacts and outreach drafts"],["tracking:write","Record user-reported progress"]];
const scopes = [
  "workspace:read",
  "profile:write",
  "batches:write",
  "drafts:write",
  "activity:write",
  "approvals:read",
  "resumes:read",
];
export default function AgentConnections({onboarding=false}:{onboarding?:boolean}) {
  const w = useWorkspace();
  const [connections, setConnections] = useState<AgentConnection[]>([]),
    [supportedScopes, setSupportedScopes] = useState<string[]>([]),
    [token, setToken] = useState(""),
    [tokenConnectionId, setTokenConnectionId] = useState(""),
    [nameError, setNameError] = useState(""),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false),
    [action, setAction] = useState(""),
    [access, setAccess] = useState("work"),
    [loading, setLoading] = useState(true),
    [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const generation = useRef(0);
  async function call(operation: string, payload: Record<string, unknown> = {}) {
    if (w.demo) return w.services.connections(operation, payload);
    return invokeConnection(w.client, operation, payload, () => window.JB.auth.userId, w.user?.id);
  }

  async function refresh(saved = false) {
    const epoch = generation.current;
    try {
      const response = await call("connections.list");
      if (epoch === generation.current) {
        setConnections(response.data || []);
        setSupportedScopes(response.supportedScopes || ["preferences:write"]);
      }
      return true;
    } catch (e) {
      if (epoch === generation.current) setFeedback(`${saved ? "Your change was saved, but the connection list could not refresh." : "Could not load connections."} ${errorMessage(e)} Use Refresh connections to try again.`);
      return false;
    } finally {
      if (epoch === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    generation.current++;
    setToken("");
    setTokenConnectionId("");
    setBusy(false);
    setAction("");
    setNameError("");
    setConnections([]);
    setSupportedScopes([]);
    setFeedback("");
    setRevokeTarget(null);
    setLoading(Boolean(w.user || w.demo));
    if (w.user || w.demo) refresh();
    return () => {
      generation.current++;
    };
  }, [w.user?.id, w.demo, w.demoEpoch]);
  async function issue(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      epoch = generation.current;
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    if (!name) {
      setNameError("Enter a name so you can recognize this agent later.");
      form.querySelector<HTMLInputElement>('[name="name"]')?.focus();
      return;
    }
    setNameError("");
    if (onboarding && !formData.has("preferences:write")) {
      setAction("create");
      setFeedback("Select search-preference editing under Onboarding permissions to continue.");
      return;
    }
    setBusy(true);
    setAction("create");
    setFeedback("");
    setToken("");
    try {
      const result = await call("connections.issue", {
        name,
        expiresInDays: 30,
        scopes:
          formData.get("access") === "read" ? ["workspace:read"] : [...scopes,...optionalScopes.filter(([scope]) => supportedScopes.includes(scope) && formData.has(scope)).map(([scope]) => scope)],
      });
      if (epoch !== generation.current) return;
      setToken(result.token);
      setTokenConnectionId(result.connection?.id || "");
      setFeedback("Connection created. Copy the token into your agent’s secure settings; it is shown only once.");
      await refresh(true);
    } catch (e) {
      if (epoch === generation.current) setFeedback(errorMessage(e));
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  }
  async function revoke(id: string) {
    const epoch = generation.current;
    setBusy(true);
    setAction(`revoke:${id}`);
    setFeedback("");
    try {
      await call("connections.revoke", { id });
      if (epoch !== generation.current) return;
      setRevokeTarget(null);
      if (id === tokenConnectionId) { setToken(""); setTokenConnectionId(""); }
      setConnections((items) => items.map((item) => item.id === id ? { ...item, revoked_at: new Date().toISOString() } : item));
      setFeedback("Agent access revoked.");
      await refresh(true);
    } catch (e) {
      if (epoch === generation.current) setFeedback(errorMessage(e));
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  }
  async function profileSetup(connection: AgentConnection) {
    const epoch = generation.current;
    setBusy(true);
    setAction(`profile:${connection.id}`);
    setFeedback("");
    try {
      await call("connections.profile_setup", {
        id: connection.id,
        enabled: !connection.scopes.includes("profile:write"),
      });
      if (epoch !== generation.current) return;
      setFeedback("Profile setup access updated. Ask your agent to refresh tools; your existing token still works.");
      await refresh(true);
    } catch (error) {
      if (epoch === generation.current) setFeedback(errorMessage(error));
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  }
  async function copy(setup: boolean) {
    const epoch = generation.current;
    setAction("copy");
    try {
      await navigator.clipboard.writeText(
        setup
          ? JSON.stringify(
              {
                mcpServers: {
                  "job-board": {
                    url: mcp,
                    headers: { Authorization: `Bearer ${token}` },
                  },
                },
                httpGateway: gateway,
              },
              null,
              2,
            )
          : token,
      );
      if (epoch === generation.current) setFeedback("Copied. Treat the token like a password.");
    } catch {
      if (epoch === generation.current) setFeedback("Copy failed. Select and copy the token manually.");
    }
  }
  return (
    <Section title="Connect your personal agent">
      <p className="max-w-prose text-sm leading-relaxed text-board-muted">
        Give Muse or another personal agent access to your Lookout workspace.
        Your agent does the work; your results and career context stay here.
      </p>
      {!w.user && !w.demo && (
        <p role="status" className="mt-4 rounded-lg border border-board-line bg-board-tag p-4 text-sm">
          Sign in to create and manage your connections.
        </p>
      )}
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <form onSubmit={issue} noValidate className="min-w-0 space-y-5" aria-label="Create an agent connection">
          <div>
            <h3 className="font-semibold">Create a connection</h3>
            <p className="mt-1 text-sm text-board-muted">Use a separate connection for each agent. Access expires after 30 days.</p>
          </div>
          <Field label="Connection name (required)">
            <input className={control} name="name" placeholder="e.g. Muse on my laptop" required maxLength={80} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "agent-name-error" : undefined} onChange={() => setNameError("")} disabled={(!w.user && !w.demo) || busy} />
          </Field>
          {nameError && <p id="agent-name-error" role="alert" className="-mt-3 text-sm leading-relaxed">{nameError}</p>}
          <Field label="What can this agent do?">
            <select className={control} name="access" value={access} onChange={(e) => setAccess(e.target.value)} disabled={(!w.user && !w.demo) || busy} aria-describedby="agent-access-description">
              <option value="read" disabled={onboarding}>Read workspace</option>
              <option value="work">Set up profile and prepare applications</option>
            </select>
          </Field>
          <p id="agent-access-description" className="-mt-3 text-sm leading-relaxed text-board-muted">
            {access === "read"
              ? "Read your saved career context and workspace without making changes."
              : "Read your workspace, import profile facts, upload private résumés, and prepare job batches and drafts. You review proposed facts and application approvals."}
          </p>
          {access === "work" && (
            <details className="border-y border-board-line py-3" open={onboarding || undefined}>
              <summary className="min-h-11 py-2 text-sm font-semibold">{onboarding ? "Onboarding permissions" : "Additional permissions"}</summary>
              <fieldset className="mt-2 space-y-1" disabled={(!w.user && !w.demo) || busy}>
                <legend className="sr-only">Additional agent permissions</legend>
                {optionalScopes.filter(([scope]) => supportedScopes.includes(scope)).map(([scope,label]) => (
                  <label key={scope} className="flex min-h-11 items-start gap-3 py-2 text-sm leading-relaxed">
                    <input className="mt-1 size-4 shrink-0 accent-board-accent" type="checkbox" name={scope} required={onboarding && scope === "preferences:write"} />
                    <span>{label}</span>
                  </label>
                ))}
                <p className="pb-2 text-xs leading-relaxed text-board-muted">
                  {onboarding ? "Select search-preference editing to let your agent record onboarding choices." : "Grant only what your agent needs. These permissions do not approve applications or verify answers."}
                </p>
              </fieldset>
            </details>
          )}
          <button className={`${primary} w-full sm:w-auto`} disabled={(!w.user && !w.demo) || busy}>
            {busy && action === "create" ? "Creating connection…" : "Create connection"}
          </button>
          {feedback && action === "create" && <p role="status" className="text-sm leading-relaxed text-board-text">{feedback}</p>}
        </form>
        <aside className="min-w-0 border-t border-board-line pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" aria-label="Connect your agent instructions">
          <h3 className="font-semibold">Then add it to your agent</h3>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-board-muted marker:text-board-text">
            <li>Create a connection with the access you need.</li>
            <li>Copy the MCP setup into your agent’s connection settings.</li>
            <li>Ask your agent to read your Lookout workspace to check access.</li>
          </ol>
          <p className="mt-5 text-xs leading-relaxed text-board-muted">Your token is shown once. Store it in your agent’s secure settings, like a password.</p>
          <details className="mt-4 text-sm">
            <summary className="min-h-11 py-2 font-medium">MCP server address</summary>
            <code className="mt-1 block break-all text-xs leading-relaxed text-board-muted">{mcp}</code>
          </details>
        </aside>
      </div>
      {token && (
        <div className="mt-7 rounded-xl border border-board-accent bg-board-tag p-5" aria-label="Your new agent connection">
          <h3 className="font-semibold">{w.demo ? "Demo connection preview" : "Your connection is ready to add"}</h3>
          <p className="mb-4 mt-1 text-sm leading-relaxed text-board-muted">Copy this setup before leaving. Lookout cannot show this token again.</p>
          <Field label="One-time connection token">
            <input className={`${control} font-mono text-sm`} value={token} readOnly type="password" autoComplete="off" spellCheck={false} onFocus={(e) => e.currentTarget.select()} />
          </Field>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={primary} onClick={() => copy(true)}>Copy MCP setup</button>
            <button className={secondary} onClick={() => copy(false)}>Copy token</button>
            <button className={secondary} onClick={() => setToken("")}>Dismiss token</button>
          </div>
          {feedback && action === "copy" && <p role="status" className="mt-3 text-sm leading-relaxed">{feedback}</p>}
        </div>
      )}
      <div className="mt-8 border-t border-board-line pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Your connections</h3>
          {(w.user || w.demo) && <button className={secondary} disabled={busy || loading} onClick={() => { setAction("refresh"); setFeedback(""); setLoading(true); void refresh(); }}>{loading ? "Loading…" : "Refresh connections"}</button>}
        </div>
        {feedback && (action === "refresh" || !action) && <p role="status" className="mt-3 text-sm leading-relaxed">{feedback}</p>}
        {loading ? (
          <p role="status" className="py-5 text-sm text-board-muted">Loading your connections…</p>
        ) : connections.length === 0 ? (
          <p className="py-5 text-sm leading-relaxed text-board-muted">No connections yet. Create one above to give your personal agent access.</p>
        ) : (
          <ul className="mt-2 divide-y divide-board-line">
            {connections.map((c) => {
              const expired = Date.parse(c.expires_at) <= Date.now();
              const active = !c.revoked_at && !expired;
              return (
                <li key={c.id} className="py-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 basis-48">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="break-words text-sm">{c.name}</strong>
                        <span className={`rounded border px-2 py-0.5 text-xs ${active ? "border-board-accent text-board-text" : "border-board-line text-board-muted"}`}>{c.revoked_at ? "Revoked" : expired ? "Expired" : "Active"}</span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-board-muted">
                        {c.revoked_at ? "This agent no longer has access." : `${expired ? "Expired" : "Expires"} ${new Date(c.expires_at).toLocaleDateString()}`}
                        {active && ` · ${c.scopes.includes("profile:write") ? "Profile setup enabled" : "Profile setup disabled"}`}
                      </p>
                    </div>
                    {!c.revoked_at && (
                      <div className="flex flex-wrap gap-2">
                        {active && <button className={secondary} disabled={busy} onClick={() => profileSetup(c)}>
                          {busy && action === `profile:${c.id}` ? "Updating…" : c.scopes.includes("profile:write") ? "Disable profile setup" : "Enable profile setup"}
                        </button>}
                        <button className={secondary} onClick={() => setRevokeTarget(c.id)} disabled={busy}>Revoke access</button>
                      </div>
                    )}
                  </div>
                  {feedback && (action === `revoke:${c.id}` || action === `profile:${c.id}`) && <p role="status" className="mt-3 text-sm leading-relaxed">{feedback}</p>}
                  {revokeTarget === c.id && (
                    <div className="mt-4 rounded-lg bg-board-tag p-4">
                      <p className="text-sm leading-relaxed">Revoke access for <strong>{c.name}</strong>? Its token will stop working. Your saved workspace stays here.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button className={primary} disabled={busy} onClick={() => revoke(c.id)}>{busy && action === `revoke:${c.id}` ? "Revoking…" : "Confirm revoke"}</button>
                        <button className={secondary} disabled={busy} onClick={() => setRevokeTarget(null)}>Keep connection</button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Section>
  );
}
