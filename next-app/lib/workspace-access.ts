type WorkspaceIdentity = { id?: string; is_anonymous?: boolean } | null | undefined;

export function canViewWorkspace({ authReady, user, demo = false }: {
  authReady: boolean; user: WorkspaceIdentity; demo?: boolean;
}): boolean {
  return demo || Boolean(authReady && user?.id && !user.is_anonymous);
}

export function isPublicReferencePage(path: string): boolean {
  return /^\/privacy\/?$/.test(path) || /^\/career-toolkit\/[^/]+\/?$/.test(path);
}
