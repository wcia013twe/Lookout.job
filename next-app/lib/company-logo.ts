import domains from '../../data/company-domains.json' with { type: 'json' };
import { normCompany } from './role-display.js';

// Keep URL construction in one place so every surface reuses the same CDN cache.
// Unknown names use provider matching, never an invented company-name.com domain.
export function companyLogoUrl(company: string | undefined, token?: string): string | null {
  const name = String(company || '').trim();
  const key = String(token || '').trim();
  // Fictional demo organizations stay local. Real brands in demo fixtures may load.
  if (!name || /\(demo\)/i.test(name) || !key || key.startsWith('sk_')) return null;
  const domainKey = normCompany(name) as keyof typeof domains;
  const domain = Object.hasOwn(domains, domainKey) ? domains[domainKey] : null;
  const path = domain || `name/${encodeURIComponent(name)}`;
  const query = new URLSearchParams({ token: key, size: '80', format: 'png', fallback: '404' });
  return `https://img.logo.dev/${path}?${query}`;
}
