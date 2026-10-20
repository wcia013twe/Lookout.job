// Shared account guard for human-only credential management. Never log tokens.
export const CONNECTION_ACCESS = [
  {id:'read',title:'Read my context',description:'Read your profile, preferences and job-search state without making changes.',scopes:['workspace:read']},
  {id:'context',title:'Manage my career context',description:'Update your profile, upload résumés and maintain search preferences. You review imported facts.',scopes:['workspace:read','profile:write','preferences:write','resumes:read']},
  {id:'work',title:'Prepare jobs and applications',description:'Everything in career context, plus save job matches, prepare drafts and record search activity.',scopes:['workspace:read','profile:write','preferences:write','resumes:read','batches:write','drafts:write','activity:write','approvals:read']},
];
export function connectionScopes(access, optional = []) {
  const preset = CONNECTION_ACCESS.find(option => option.id === access);
  if (!preset) throw Error('Choose an access level.');
  return [...new Set([...preset.scopes, ...(access === 'read' ? [] : optional)])];
}
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
