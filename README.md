# Lookout

[Open the deployed website](https://wcia013twe.github.io/Lookout.job/)

## Run locally

Requires Node.js 24, npm, and Git. From the repository root:

```sh
npm ci
npm ci --prefix next-app
npm run dev
```

Open http://localhost:3000/?demo=1 for a fictional demo with no account or backend setup. Refresh resets demo edits. Press Ctrl-C to stop the frontend.

For the account workspace, open http://localhost:3000 without `?demo=1` and sign in. `npm run dev` uses the configured hosted backend by default.

### Run with a local backend

Start Docker Desktop, then use the installed Supabase CLI:

```sh
export PATH="$PWD/node_modules/.bin:$PATH"
make dev
```

Open http://localhost:3000. Local accounts and data are separate from the deployed website.

Local Google sign-in requires your own OAuth client configured in `supabase/config.toml`, callback `http://127.0.0.1:54321/auth/v1/callback`, and frontend origin `http://localhost:3000`. Before `make dev`, set its matching secret:

```sh
export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET='<your local Google OAuth client secret>'
```

Press Ctrl-C to stop the frontend; `make down` stops local Supabase while preserving data. For local Edge Functions, the optional Node API/worker, and remote-agent tunnels, see [backend setup](backend/runtime/README.md) and [local Edge Functions](backend/local-edge-functions.md).

## Add your agent

1. Open the [deployed website](https://wcia013twe.github.io/Lookout.job/) or your local account workspace and sign in.
2. Under **My Profile**, add your background, resume, and job preferences.
3. Open **My Agent → Your connections**, create a connection, and choose **Set up connection**.
4. Follow the displayed instructions to add the MCP endpoint to your agent client. Store the issued token as a secret bearer credential. The client must support Streamable HTTP and be able to reach the endpoint.
5. Ask your agent to load your Lookout profile and onboarding instructions, then confirm it can read your account.

For example:

> Connect to Lookout, read my profile and saved preferences, and confirm what is loaded. Ask me before starting any job-search or application work.

For client setup and optional background watching, see the [agent quickstart](mcp/README.md#agent-quickstart). Scheduling, notifications, and browser actions depend on your agent host.
