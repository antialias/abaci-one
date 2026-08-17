# Infrastructure - Claude Code Instructions

Covers the k3s/Terraform infrastructure and the deploy pipeline for the app. App-code rules live in `apps/web/.claude/CLAUDE.md`.

## CRITICAL: Always Use Terraform for Infrastructure

**ALWAYS use Terraform to manage Kubernetes infrastructure. Never use kubectl directly for creating/modifying resources unless there are extenuating circumstances (e.g., emergency debugging).**

Why:
- Terraform maintains state and tracks what it manages
- Manual kubectl changes cause drift and conflicts
- Terraform plans show exactly what will change before applying
- Changes are version-controlled and auditable

**Before making any infrastructure change:**
1. Find or create the relevant `.tf` file
2. Make changes in Terraform code
3. Run `terraform plan` to preview
4. Run `terraform apply` to apply
5. Commit the `.tf` file changes

**If you must use kubectl directly:**
- Document why in the commit message
- Create a follow-up task to codify the change in Terraform
- Expect the change to be reverted on next `terraform apply`

### Applying terraform changes

```bash
cd infra/terraform
terraform plan    # uses terraform.tfvars automatically
terraform apply
```

- State is **local** (`terraform.tfstate`), no remote backend
- Vars in `terraform.tfvars` (contains secrets — don't cat unnecessarily)
- Run from this machine, not from the NAS

## Shared Infrastructure — CRITICAL

`infra/terraform/gitea.tf` manages **shared k8s infrastructure** used by multiple projects (weather-display, abaci.one, etc.) — not just this flashcard app. This is known organizational debt (tracked in weather-display#235).

### What gitea.tf manages
- **Gitea server**: deployment (`gitea/gitea:1.25-rootless`), service, ingress (`git.dev.abaci.one`, `firmware.dev.abaci.one`), config (app.ini via ConfigMap)
- **Act runner**: deployment with DinD sidecar, runner config
- **Local Docker registry**: deployment (`registry:2`), service, PVC
- **Init containers**: `init-config` (copies app.ini), `fix-dbfs-logs` (workaround for go-gitea/gitea#35110 — remove after Gitea >= 1.26, tracked in weather-display#234)
- **Setup jobs**: admin user creation, repo migration from GitHub
- **Namespace**: `gitea` on k3s at `192.168.86.37`
- **DB**: SQLite at `/data/gitea/gitea.db` (NFS PVC from NAS)

## Access

### Kubernetes (local kubeconfig)
kubeconfig location: `~/.kube/k3s-config`
```bash
kubectl --kubeconfig=/Users/antialias/.kube/k3s-config -n abaci get pods
```

### k3s node (SSH)
```bash
ssh antialias@192.168.86.37
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl ...
```

### NAS
```bash
ssh nas.home.network    # use this hostname, not the IP
```
NAS projects live at `~/projects/`. The NAS runs Docker containers (abaci.one, etc.) but Gitea is on k3s, not Docker.

## Database Architecture

**libSQL Server** — all app pods connect to a single in-cluster libSQL server.
- **Dev**: `DATABASE_URL=file:./data/sqlite.db` (local SQLite file, no server needed)
- **Prod**: `DATABASE_URL=http://libsql.abaci.svc.cluster.local:8080`

Any pod can handle both reads and writes — no primary/replica distinction and no write-routing complexity for the app.

### CRITICAL: Production Database Access

**The MCP sqlite tools query the LOCAL dev database, NOT production.** The local dev DB (`apps/web/data/sqlite.db`) is a separate SQLite file — changes there do NOT affect production. NEVER use `mcp__sqlite__read_query` or similar when you need production data.

**Preferred — convenience script (works from local terminal):**
```bash
./scripts/prod-query.sh "SELECT id, email, upgraded_at FROM users WHERE email IS NOT NULL LIMIT 5"
```

**Via an app pod** (Node.js + libsql HTTP pipeline API — no `curl`/`sqlite3` in the container):
```bash
kubectl get pods -n abaci -l app=abaci-app          # 1. get a pod name
kubectl exec -n abaci <pod-name> -- node -e "
  fetch('http://libsql.abaci.svc.cluster.local:8080/v2/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        type: 'execute',
        stmt: { sql: 'SELECT * FROM users LIMIT 5' }
      }]
    })
  }).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2)))
"
```

**Via port-forward + HTTP client:**
```bash
kubectl --kubeconfig=/Users/antialias/.kube/k3s-config -n abaci port-forward svc/libsql 8080:8080
curl -X POST http://localhost:8080/v2/pipeline -d '{"requests":[{"type":"execute","stmt":{"sql":"SELECT * FROM users LIMIT 5"}}]}'
```

From Claude Code, use `mcp__kubernetes__exec_in_pod` or run the script via the Bash tool.

**Notes:**
- Column names use `snake_case` in SQL (e.g., `user_id`, `is_practice_student`), NOT camelCase
- Use parameterized queries for safety with the raw API: `{ sql: 'SELECT * FROM users WHERE id = ?', args: [{ type: 'text', value: 'some-id' }] }`
- Multiple queries can be batched in a single `requests` array

## Network Architecture

**Traffic flow:** Internet → NAS Traefik (Docker) → k3s Traefik → Pods

- **NAS Traefik** handles external SSL termination for all domains
- Config location: `nas:/volume1/homes/antialias/projects/traefik/services.yaml`
- k3s receives traffic with `passHostHeader: true`

**Adding new subdomains requires:**
1. DNS record (Porkbun API)
2. NAS Traefik route in `services.yaml`
3. k3s Ingress in Terraform

## Deployment Workflow

**NEVER build Docker images locally.** GitHub Actions handles all builds.

### CI/CD Architecture

```
GitHub Actions → ghcr.io → Argo CD Image Updater → k3s Deployment
```

1. Push to GitHub (main branch)
2. GitHub Actions builds image → pushes to ghcr.io
3. **Argo CD image updater detects the new image** (every 2 min, via anonymous access) and patches the Application's kustomize image override
4. Argo CD auto-sync: runs the PreSync migration job, then rolls the deployment
5. No manual intervention required!

- **Manifests**: `infra/k8s/abaci-app/` (Kustomize — deployment.yaml, migration-job.yaml)
- **PreSync hook**: `migration-job.yaml` runs DB migrations before pods roll (Argo CD waits for it)
- **Registry**: `ghcr.io/antialias/soroban-abacus-flashcards:latest`
- Argo CD runs in the `argocd` namespace

### Container Registry (ghcr.io) — Public Package, No Auth Needed

**The `ghcr.io/antialias/abaci-one` package is PUBLIC.** Anonymous pulls work. Do NOT add credentials for pulling.

**Critical rules:**
- **Do NOT add `imagePullSecrets`** to k8s manifests. The package is public and anonymous pulls work. If a pod has `imagePullSecrets` referencing a secret with expired/invalid credentials, ghcr.io returns 403 Forbidden instead of falling back to anonymous access — causing ImagePullBackOff.
- **Image updater `registries.conf`** (ConfigMap `argocd-image-updater-config` in `argocd` namespace) must NOT have a `credentials:` line for ghcr.io. Anonymous access works for reading tags from public packages. Expired credentials cause "denied: denied" errors.
- **Legacy `ghcr-registry` secrets** exist in both `argocd` and `abaci` namespaces with expired PATs. These secrets are NOT used and should NOT be referenced. They remain as artifacts from when the package was private.

**Debugging image pull failures:**
- Check if `imagePullSecrets` is set on the pod spec — remove it
- Check `argocd-image-updater-config` ConfigMap for `credentials:` line — remove it
- Test anonymous pull: `kubectl run test --image=ghcr.io/antialias/abaci-one:main --restart=Never` (no imagePullSecrets = anonymous = works)

### Verify / debug Argo CD

```bash
# Image updater logs
kubectl --kubeconfig=/Users/antialias/.kube/k3s-config -n argocd logs -l app.kubernetes.io/name=argocd-image-updater --tail=50

# App status
kubectl get applications -n argocd
```

### Stuck Argo CD Sync (PreSync Hook)
If the migration job (PreSync hook) fails or is deleted mid-sync, Argo CD gets stuck "waiting for completion of hook batch/Job/db-migrations". To fix:
1. Patch the application to clear the stuck operation: `kubectl patch applications.argoproj.io abaci-app -n argocd --type merge -p '{"operation": null}'`
2. This allows auto-sync to trigger a fresh sync cycle

### Manual Rollout (quick restart)
Argo CD normally handles rollouts automatically; do NOT manually restart unless debugging. To force pods to pull the latest image:
```bash
kubectl --kubeconfig=~/.kube/k3s-config -n abaci rollout restart deployment abaci-app
```

## Fixbot (Automated CI Fix System)

Fixbot automatically detects CI failures on main, diagnoses them, and opens fix PRs.

- **Issues** are prefixed `[fixbot]` and labeled `fixbot`
- **PRs** are on `fixbot/` branches
- **Implementation** lives in `.github/fixbot/` (workflows + prompts)
- **Full reference**: See `.claude/FIXBOT.md` for how to interact with fixbot, the "ensure main is on prod" procedure, and what NOT to do

## Key Resources

Application topology on k3s:
- **Deployment**: `abaci-app` — app pods, 3 replicas for HA. StatefulSet-style services: `abaci-app` (ClusterIP, load-balances across app pods), `abaci-app-headless` (StatefulSet DNS), `abaci-app-primary` (routes to the primary instance)
- **Deployment**: `libsql` — database server; **Service**: `libsql` (internal DB access)
- **Redis**: session/cache store
- **Ingress**: routes `abaci.one` to the app service
- **IngressRoute**: Socket.IO sticky sessions for `/api/socket`
- **Key namespaces**: `abaci` (app, Redis, Gatus uptime, dev-artifacts), `monitoring` (Prometheus, Grafana, node-exporter, Tempo tracing), `kube-system` (Traefik, CoreDNS, metrics-server), `cert-manager` (letsencrypt-staging issuer), `argocd` (Argo CD + image updater)

## Common Operations

### Check app logs
```bash
kubectl logs -n abaci -l app=abaci-app --tail=100
```

### Check libSQL server status
```bash
kubectl --kubeconfig=~/.kube/k3s-config -n abaci logs -l app=libsql --tail=50
```

### Run migrations manually
```bash
kubectl --kubeconfig=~/.kube/k3s-config -n abaci exec -it deployment/abaci-app -- node dist/db/migrate.js
```

## Monitoring & CI Debugging

Grafana dashboards and Gitea Actions runner performance debugging (Ops/Product metrics panels, Prometheus queries, "builds are slow" triage): see `docs/monitoring.md`.
