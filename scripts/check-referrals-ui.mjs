// Compatibility entry point: Referrals is now the company Network workspace.
process.env.LOOKOUT_UI_URL ||= 'http://127.0.0.1:3036';
await import('./check-network-ui.mjs');
