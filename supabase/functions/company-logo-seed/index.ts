// The one-time public-logo bootstrap completed. No privileged uploader remains live.
// Logos now load directly from Logo.dev; no storage maintenance is required.
Deno.serve(() => new Response('Bootstrap retired', { status: 410 }));
