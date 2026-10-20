// Shared account guard for human-only credential management. Never log tokens.
export async function invokeConnection(client, operation, payload, currentOwner, owner) {
  if (!owner || currentOwner() !== owner) throw Error('Sign in to manage agent connections.');
  const {data, error} = await client.auth.getSession();
  if (error || data.session?.user.id !== owner || currentOwner() !== owner)
    throw Error('Account changed. Retry from your account.');
  const response = await client.functions.invoke('agent-gateway', {
    body: {operation, payload},
    headers: {Authorization: `Bearer ${data.session.access_token}`},
  });
  if (currentOwner() !== owner) throw Error('Account changed.');
  if (response.error || response.data?.error) {
    let body = response.data;
    // Supabase puts non-2xx JSON in FunctionsHttpError.context, not data.
    if (!body && response.error?.context?.clone) {
      try { body = await response.error.context.clone().json(); } catch { /* transport errors have no JSON */ }
    }
    if (currentOwner() !== owner) throw Error('Account changed.');
    const message = typeof body?.error === 'string' ? body.error : body?.error?.message;
    throw Error(message || 'Could not reach Lookout. Check your connection and try again.');
  }
  return response.data;
}
