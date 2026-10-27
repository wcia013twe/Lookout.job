// Next.js substitutes these public values at build time. Never put a service key here.
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://osyrlausutnqzlegxmnd.supabase.co').replace(/\/$/, '');
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Wd5zta2ryg67FK2J7zGroA_ui050NlY';
