type Credentials = { email: string; password: string };
const loopback = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function localTestCredentials(origin: string, apiUrl: string, enabled: string | undefined, email: string | undefined, password: string | undefined): Credentials | null {
  if (enabled !== "1" || !email || !password) return null;
  try {
    const site = new URL(origin), api = new URL(apiUrl);
    if ([site, api].some(url => url.protocol !== "http:" || !loopback.has(url.hostname) || url.username || url.password)) return null;
    return { email, password };
  } catch { return null; }
}

export function configuredLocalTestCredentials(origin: string, apiUrl: string) {
  return localTestCredentials(origin, apiUrl,
    process.env.NEXT_PUBLIC_LOCAL_TEST_AUTO_SIGNIN,
    process.env.NEXT_PUBLIC_LOCAL_TEST_EMAIL,
    process.env.NEXT_PUBLIC_LOCAL_TEST_PASSWORD);
}
