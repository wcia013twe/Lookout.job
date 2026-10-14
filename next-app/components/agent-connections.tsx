"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useWorkspace } from "../lib/workspace";
import { Section, Field, control, primary, secondary, Notice } from "./ui";
import { errorMessage } from "./profile-types";
type AgentConnection = { id: string; name: string; scopes: string[]; expires_at: string; revoked_at?: string };
const gateway =
    "https://umhqfqzpwmszhcknwtrs.supabase.co/functions/v1/agent-gateway",
  mcp = "https://umhqfqzpwmszhcknwtrs.supabase.co/functions/v1/agent-mcp";
const optionalScopes = [["preferences:write","Edit search profiles and preferences"],["answers:write","Edit saved answers"],["resumes:write","Upload and add résumés"],["network:write","Edit contacts and outreach drafts"],["tracking:write","Record user-reported progress"]];
const scopes = [
  "workspace:read",
  "profile:write",
  "batches:write",
  "drafts:write",
  "activity:write",
  "approvals:read",
  "resumes:read",
];
export default function AgentConnections() {
  const w = useWorkspace();
  const [connections, setConnections] = useState<AgentConnection[]>([]),
    [token, setToken] = useState(""),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false);
  const generation = useRef(0);
  async function call(operation: string, payload: Record<string, unknown> = {}) {
    const owner = w.user?.id;
    if (!owner || window.JB.auth.userId !== owner)
      throw Error("Sign in to manage agent connections.");
    const { data, error } = await w.client.auth.getSession();
    if (error || data.session?.user.id !== owner)
      throw Error("Account changed. Retry from your account.");
    const response = await w.client.functions.invoke("agent-gateway", {
      body: { operation, payload },
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    if (window.JB.auth.userId !== owner) throw Error("Account changed.");
    if (response.error || response.data?.error)
      throw Error(
        response.data?.error?.message || "Agent connection request failed.",
      );
    return response.data;
  }
  async function refresh() {
    const epoch = generation.current;
    try {
      const response = await call("connections.list");
      if (epoch === generation.current) setConnections(response.data || []);
    } catch (e) {
      if (epoch === generation.current) setFeedback(errorMessage(e));
    }
  }
  useEffect(() => {
    generation.current++;
    setToken("");
    setConnections([]);
    setFeedback("");
    if (w.user) refresh();
    return () => {
      generation.current++;
    };
  }, [w.user?.id]);
  async function issue(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      epoch = generation.current;
    setBusy(true);
    try {
      const result = await call("connections.issue", {
        name: String(new FormData(form).get("name") || "").trim(),
        expiresInDays: 30,
        scopes:
          new FormData(form).get("access") === "read" ? ["workspace:read"] : [...scopes,...optionalScopes.filter(([scope]) => new FormData(form).has(scope)).map(([scope]) => scope)],
      });
      if (epoch !== generation.current) return;
      await refresh();
      if (epoch !== generation.current) return;
      setToken(result.token);
      setFeedback(
        "Connection created. Copy the token into your agent’s secure settings; it is shown only once.",
      );
    } catch (e) {
      if (epoch === generation.current) setFeedback(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    try {
      await call("connections.revoke", { id });
      await refresh();
      setFeedback("Agent access revoked.");
    } catch (e) {
      setFeedback(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function profileSetup(connection: AgentConnection) {
    setBusy(true);
    try {
      await call("connections.profile_setup", {
        id: connection.id,
        enabled: !connection.scopes.includes("profile:write"),
      });
      await refresh();
      setFeedback(
        "Profile setup access updated. Ask your agent to refresh tools; your existing token still works.",
      );
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function copy(setup: boolean) {
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
      setFeedback("Copied. Treat the token like a password.");
    } catch {
      setFeedback("Copy failed. Select and copy the token manually.");
    }
  }
  return (
    <Section title="Your agent">
      <p className="mb-4 text-sm text-board-muted">
        Create a 30-day connection for Muse or your own agent. Profile setup
        access lets it import unverified facts and proposed answers and upload
        private resumes. Use Load account after an import to review its changes.
        Keys are shown once and never saved in your workspace.
      </p>
      {!w.user && <Notice>Sign in to connect your own agent.</Notice>}
      <form onSubmit={issue} className="grid gap-3 sm:grid-cols-2">
        <Field label="Connection name">
          <input
            className={control}
            name="name"
            placeholder="Muse"
            required
            maxLength={80}
          />
        </Field>
        <Field label="Access">
          <select className={control} name="access" defaultValue="work">
            <option value="read">Read workspace</option>
            <option value="work">
              Set up profile and prepare applications
            </option>
          </select>
        </Field>
        <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Optional editing access</legend>
          {optionalScopes.map(([scope,label]) => <label key={scope} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name={scope} />{label}</label>)}
          <p className="text-xs text-board-muted">Used only with application access. These permissions never approve applications or verify answers.</p>
        </fieldset>
        <button className={primary} disabled={!w.user || busy}>
          Create agent connection
        </button>
      </form>
      {token && (
        <div className="mt-5 space-y-3 rounded-xl border border-board-line p-4">
          <Field label="One-time token">
            <input
              className={control}
              value={token}
              readOnly
              type="password"
              autoComplete="off"
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <button className={secondary} onClick={() => copy(false)}>
              Copy token
            </button>
            <button className={secondary} onClick={() => copy(true)}>
              Copy MCP setup
            </button>
            <button className={secondary} onClick={() => setToken("")}>
              Hide token
            </button>
          </div>
        </div>
      )}
      <p className="mt-5 break-all border-b border-board-line pb-5 text-xs leading-relaxed text-board-muted">
        MCP endpoint: {mcp}
      </p>
      <ul className="mt-4 divide-y divide-board-line">
        {connections.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 py-4"
          >
            <div>
              <strong>{c.name}</strong>
              <p className="mt-1 text-xs text-board-muted">
                {c.revoked_at
                  ? "Revoked"
                  : `${Date.parse(c.expires_at) < Date.now() ? "Expired" : "Expires"} ${new Date(c.expires_at).toLocaleDateString()}`}
              </p>
            </div>
            {!c.revoked_at && Date.parse(c.expires_at) > Date.now() && (
              <button
                className={secondary}
                disabled={busy}
                onClick={() => profileSetup(c)}
              >
                {c.scopes.includes("profile:write")
                  ? "Disable profile setup"
                  : "Enable profile setup"}
              </button>
            )}
            {!c.revoked_at && (
              <button
                className={secondary}
                onClick={() => revoke(c.id)}
                disabled={busy}
              >
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>
      <Notice>{feedback}</Notice>
    </Section>
  );
}
