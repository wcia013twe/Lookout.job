// Server/exporter only. Never import this module from the browser.
export function tracingConfig(env = process.env) {
  const publicKey = env.LANGFUSE_PUBLIC_KEY?.trim();
  const secretKey = (env.LANGFUSE_SECRET_KEY || env.LANGFUSE_SECRET)?.trim();
  const baseUrl = (env.LANGFUSE_BASE_URL || env.LANGFUSE_HOST)?.trim();
  if (!publicKey || !secretKey || !baseUrl) return null;
  const url = new URL(baseUrl);
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw Error('Invalid Langfuse base URL; use HTTPS or loopback HTTP');
  }
  return {publicKey, secretKey, baseUrl: baseUrl.replace(/\/$/, '')};
}
export function redact(value, env = process.env) {
  const secrets = Object.entries(env).filter(([key, v]) => /SECRET|TOKEN|PASSWORD|API_KEY|SERVICE_ROLE|PRIVATE_KEY/.test(key) && typeof v === 'string' && v.length >= 8).map(([,v]) => v);
  function walk(v, depth = 0) {
    if (depth > 12) return '[DEPTH LIMIT]';
    if (typeof v === 'string') {
      for (const secret of secrets) v = v.replaceAll(secret, '[REDACTED]');
      return v.replace(/(?:jb_agent_|sk-lf-|pk-lf-|sk-)[A-Za-z0-9_-]+/g, '[REDACTED]')
        .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
        .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED]')
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
        .slice(0, 12000);
    }
    if (Array.isArray(v)) return v.slice(0, 100).map(x => walk(x, depth + 1));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).slice(0, 100).map(([k,x]) => [k, /secret|password|authorization|cookie|credential|api.?key|^(?:access|refresh|id)?_?token$/i.test(k) ? '[REDACTED]' : walk(x, depth + 1)]));
    return v;
  }
  return walk(value);
}
