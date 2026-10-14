"use client";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { Section, Field, control, primary, secondary, Notice } from "./ui";
const gateway =
    "https://umhqfqzpwmszhcknwtrs.supabase.co/functions/v1/agent-gateway",
  mcp = "https://umhqfqzpwmszhcknwtrs.supabase.co/functions/v1/agent-mcp";
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
  const [connections, setConnections] = useState([]),
    [token, setToken] = useState(""),
    [feedback, setFeedback] = useState(""),
    [busy, setBusy] = useState(false);
  const generation = useRef(0);
  async function call(operation, payload = {}) {
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
      if (epoch === generation.current) setFeedback(e.message);
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
  async function issue(e) {
    e.preventDefault();
    const form = e.currentTarget,
      epoch = generation.current;
    setBusy(true);
    try {
      const result = await call("connections.issue", {
        name: form.elements.name.value.trim(),
        expiresInDays: 30,
        scopes:
          form.elements.access.value === "read" ? ["workspace:read"] : scopes,
      });
      if (epoch !== generation.current) return;
      await refresh();
      if (epoch !== generation.current) return;
      setToken(result.token);
      setFeedback(
        "Connection created. Copy the token into your agent’s secure settings; it is shown only once.",
      );
    } catch (e) {
      if (epoch === generation.current) setFeedback(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id) {
    setBusy(true);
    try {
      await call("connections.revoke", { id });
      await refresh();
      setFeedback("Agent access revoked.");
    } catch (e) {
      setFeedback(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function profileSetup(connection) {
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
      setFeedback(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function copy(setup) {
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
      <p className="mt-4 break-all text-xs text-board-muted">
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
