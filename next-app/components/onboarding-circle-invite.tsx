"use client";

import { useRef, useState, type FormEvent } from "react";
import { useKnowledgeClient } from "../app/circles/_lib/client";
import { useWorkspace } from "../lib/workspace";
import { Button, Field } from "./onboarding-ui";

export default function OnboardingCircleInvite({ onContinue }: { onContinue: () => void }) {
  const client = useKnowledgeClient();
  return <InviteForm key={client.identity} client={client} onContinue={onContinue}/>;
}

function InviteForm({ client, onContinue }: { client: ReturnType<typeof useKnowledgeClient>; onContinue: () => void }) {
  const w = useWorkspace();
  const profile = w.state.workflow.profile;
  const savedName = profile.preferredName || profile.firstName || profile.name || "";
  const [token, setToken] = useState("");
  const [alias, setAlias] = useState(savedName);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<{ token: string; alias: string; eventKey: string } | null>(null);
  const lock = useRef(false);
  async function join(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !client.ready || !token.trim() || !alias.trim()) return;
    lock.current = true; setBusy(true); setError("");
    const value = { token: token.trim(), alias: alias.trim() };
    if (!pending.current || pending.current.token !== value.token || pending.current.alias !== value.alias) {
      pending.current = { ...value, eventKey: crypto.randomUUID() };
    }
    try {
      await client.request("circles.join", pending.current);
      setJoined(true); setToken(""); pending.current = null;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn’t join. Check your code and try again.");
    } finally { lock.current = false; setBusy(false); }
  }
  return <section className="onboarding-circle-invite" aria-label="Join your Circle">
    {joined ? <><h2>You’re in.</h2><div className="actions"><Button onClick={onContinue}>Continue</Button></div></> : <>
      <h2>Already have a Circle?</h2>
      <form onSubmit={join}>
        <Field label="Invite code"><input value={token} onChange={e=>{setToken(e.target.value);setError("");}} placeholder="Paste your code" required maxLength={100} autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={busy}/></Field>
        {!savedName && <Field label="Your name in the Circle"><input value={alias} onChange={e=>setAlias(e.target.value)} required maxLength={80} autoComplete="given-name" disabled={busy}/></Field>}
        {savedName && <p className="hint">Joining as {savedName}.</p>}
        {client.ready ? <Button type="submit" disabled={busy || !token.trim() || !alias.trim()}>{busy ? "Joining…" : "Join Circle"}</Button> : <Button disabled={client.connectionState!=="signed_out"} onClick={client.signIn}>Sign in to join</Button>}
        {error && <p className="error" role="alert">{error}</p>}
        {client.demo && <p className="hint">Demo only · use demo-invite.</p>}
      </form>
    </>}
  </section>;
}
