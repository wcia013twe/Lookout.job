// Next.js substitutes these public values at build time. Never put a service key here.
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://umhqfqzpwmszhcknwtrs.supabase.co').replace(/\/$/, '');
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_hWhdwxwVfWS_0zd5VvoFzA_DvfV6jp5';
