# Personal GCP deployment

This walkthrough moves the Node API/MCP and queued discovery worker onto one
Compute Engine VM. GitHub Pages keeps hosting the website; hosted Supabase keeps
Auth, Postgres, private files and Edge Functions. No Kubernetes or Cloud SQL is
needed. The VM starts at `e2-medium`, with a 30 GB disk and a reserved public IP.
VM, disk, IP and network traffic can incur charges; review the
[Google Cloud calculator](https://cloud.google.com/products/calculator) before applying.

Terraform describes infrastructure. `plan` previews it; `apply` creates it.
The separate deploy command uploads committed application code and starts Docker.
Neither command transfers accounts or runs Supabase migrations.

## 1. Terminal and Google access

On the current Mac, the downloaded CLI is here (it does not need to be committed):

```sh
cd "/Volumes/External SSD/Lookout/app"
export PATH="$PWD/google-cloud-sdk/bin:$PATH"
gcloud auth list
gcloud config set project job-board-511516
```

If there is no active account, run `gcloud auth login`. Install Terraform with
`brew install hashicorp/tap/terraform`, then authenticate Terraform separately:

```sh
terraform version
gcloud auth application-default login
```

The second login supplies Application Default Credentials for Terraform; normal
CLI login alone is insufficient. Complete browser logins yourself. Do not paste
tokens into chat. See [Google's Terraform authentication guide](https://docs.cloud.google.com/docs/terraform/authentication).

This walkthrough assumes your user can enable services and manage Compute,
networking and service accounts in this personal project. SSH uses IAP and OS Login.
If IAM denies access, grant only the missing permissions: IAP tunnel access,
OS Admin Login and Service Account User on `lookout-vm` are the relevant SSH
boundaries; a project administrator may need to configure them.

## 2. Link billing and enable APIs

On November 7, 2026, CLI inspection found project `job-board-511516` selected,
with billing disabled and Compute Engine not enabled. Recheck before proceeding:

```sh
gcloud billing projects describe job-board-511516
gcloud billing accounts list
```

Choose your billing account ID from the list. This command links paid billing:

```sh
gcloud billing projects link job-board-511516 --billing-account=YOUR_BILLING_ACCOUNT_ID
gcloud services enable compute.googleapis.com iam.googleapis.com iap.googleapis.com oslogin.googleapis.com --project=job-board-511516
gcloud auth application-default set-quota-project job-board-511516
```

If there is no billing account, create one in the
[billing console](https://console.cloud.google.com/billing) first.

## 3. Preview and create the VM

Run from the shared repository after this change has landed into local main:

```sh
cp infra/gcp/terraform.tfvars.example infra/gcp/terraform.tfvars
terraform -chdir=infra/gcp init
terraform -chdir=infra/gcp fmt -check
terraform -chdir=infra/gcp validate
terraform -chdir=infra/gcp plan -out=lookout.tfplan
```

Read the plan. It should create Lookout's own network, subnet, firewall rules,
service account, static IP and one VM, plus manage the required API enablement.
It should not change existing unrelated resources. When ready:

```sh
terraform -chdir=infra/gcp apply lookout.tfplan
terraform -chdir=infra/gcp output api_ip
```

Keep the local Terraform state files backed up privately: they track the resources
Terraform owns. They are ignored by Git. Application secrets never enter them.
Run Terraform from one checkout and one terminal at a time; a shared remote state
backend can be added if multiple people later manage this deployment.

## 4. DNS and server settings

In your DNS provider, create an **A record** for a hostname such as
`api.yourdomain.com`, pointing to the printed IP. This setup does not buy a domain
or manage DNS. Use DNS-only mode initially if your provider offers an HTTP proxy.
Do not add an AAAA record: this VM configuration exposes IPv4 only.

```sh
dig +short api.yourdomain.com
cp infra/gcp/.env.example .env.gcp.local
chmod 600 .env.gcp.local
open -e .env.gcp.local
```

Edit that file in your editor. Use plain `KEY=value` lines, without quotes:

- `SUPABASE_URL`: the hosted project containing the intended account data.
- `SUPABASE_SERVICE_ROLE_KEY`: that same project's server-only service-role key.
- `LOOKOUT_API_HOST`: your DNS hostname, without `https://` or a path.
- `LOOKOUT_ALLOWED_HOSTS`: that hostname plus `localhost,127.0.0.1`.
- `LOOKOUT_ALLOWED_ORIGINS`: your exact website origin (such as
  `https://wcia013twe.github.io`), without the repository path or trailing slash.
- `APILAYER_API_KEY`: optional; needed for the existing resume parser.
- Keep both execution flags `false` for the first connection check.

The supplied Supabase URL is the repository's current target, not proof your old
account data is there. Verify the intended project before supplying its key.
Never reuse the local Docker key or send a service-role key to the browser.

Wait for Docker installation to finish:

```sh
gcloud compute ssh lookout-backend --project=job-board-511516 --zone=us-east1-b --tunnel-through-iap --command='sudo test -f /opt/lookout/bootstrap-ready && sudo docker compose version'
```

If it fails while the VM is still bootstrapping, inspect startup logs, then retry:

```sh
gcloud compute ssh lookout-backend --project=job-board-511516 --zone=us-east1-b --tunnel-through-iap --command='sudo journalctl -u google-startup-scripts.service -n 80 --no-pager'
```

## 5. Deploy and verify

```sh
node scripts/deploy-gcp.mjs "$PWD/.env.gcp.local"
curl --fail https://api.yourdomain.com/healthz
```

The helper requires landed local `main` and unchanged tracked deployment source.
It uploads an explicit allowlist of committed code, excluding untracked files,
Terraform state and local credentials. Credentials travel separately on SSH stdin
and remain in root-only `/etc/lookout/runtime.env`. Docker builds on the VM.
Caddy obtains an HTTPS certificate after DNS points to the VM and ports 80/443
are reachable. SSH is restricted to Google's IAP range; port 8080 is not published.

Health only proves the API responds. Using an existing scoped agent credential,
test `tools/list` and an allowed account read against `https://api.yourdomain.com/mcp`.
Confirm account ownership and gateway compatibility before enabling work.
Change `LOOKOUT_EXECUTION_ENABLED=true` in the local env file, rerun the deploy
command and verify one authorized discovery job completes in Supabase. The worker
processes queued jobs; your personal agent still supplies scheduling and reasoning.
Keep `LOOKOUT_SUBMISSION_ENABLED=false`; hosted browser submissions are outside
this initial deployment and require separate verification.

Once those checks pass, set these **GitHub repository Actions variables** under
Settings → Secrets and variables → Actions → Variables:

```text
NEXT_PUBLIC_LOOKOUT_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_AGENT_MCP_URL=https://api.yourdomain.com/mcp
```

The CI build reads both variables. Publishing the committed change through the
normal main-branch workflow rebuilds the static frontend with these endpoints.
That existing workflow also applies Supabase migrations and deploys Edge Functions;
review pending migrations as part of the release. Local landing alone does not
publish. Test signed-in website reads, resume parsing if configured, agent handoff
and a bounded discovery job after release. Existing demo mode remains detached
and must not contact the VM or use real account secrets.

## Account data, updates and cleanup

Infrastructure deployment does **not** copy database rows, Auth users, uploaded
files, browser-local state or agent tokens. If data is already in the selected
hosted Supabase project, the VM connects to it directly. Data in an old project
or local stack needs a separately reviewed backup/migration preserving ownership
and file references before the website switches. Do not reset or seed real accounts.

After later changes land, rerun `node scripts/deploy-gcp.mjs "$PWD/.env.gcp.local"`.
Release directories are kept under `/opt/lookout/releases`; Docker images can
accumulate. Check disk usage periodically. Builds/startup failures can leave an
incomplete rollout; inspect container logs and redeploy the intended committed
revision rather than treating a failed command as rollback. Docker restarts
containers on reboot. You still maintain VM updates and private backups.

To inspect services:

```sh
gcloud compute ssh lookout-backend --project=job-board-511516 --zone=us-east1-b --tunnel-through-iap --command='cd /opt/lookout/current && sudo docker compose --env-file /etc/lookout/public.env -f infra/gcp/compose.yaml ps'
```

To remove this GCP deployment deliberately, preview `terraform -chdir=infra/gcp
plan -destroy`, then run `terraform -chdir=infra/gcp destroy` and review its prompt.
This deletes the VM disk (including VM-local secrets and certificate volumes),
reserved IP and owned networking; it does not delete the external Supabase project.
API enablement is retained. Stopping only the VM can leave disk/IP charges.

Verification for this change is local configuration validation, not a live GCP
deployment, authenticated MCP round trip, migration or hosted browser execution.
