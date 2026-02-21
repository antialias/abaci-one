# Project Agent Notes

## Source Control

- **GitHub**: https://github.com/antialias/abaci-one
- Use `gh` CLI for issues, PRs, and other GitHub operations

## Infrastructure - K3s Cluster

The project runs on a k3s cluster accessible via the Kubernetes MCP.

### Key Namespaces
- **abaci**: Main application (abaci-app StatefulSet with 3 replicas), Redis, Gatus (uptime monitoring), dev-artifacts
- **monitoring**: Prometheus stack (Grafana, Prometheus, node-exporter), Tempo (tracing)
- **kube-system**: Traefik ingress, CoreDNS, metrics-server
- **cert-manager**: TLS certificate management (letsencrypt-staging issuer)
- **argocd**: Argo CD for GitOps deployments (with argocd-image-updater for auto-deploys)

### Key Services
| Service | Namespace | External URL |
|---------|-----------|--------------|
| App | abaci | https://abaci.one (via Traefik) |
| Grafana | monitoring | (check ingress) |

### Useful Commands
```bash
# Check pod status
kubectl get pods -A

# Check app logs
kubectl logs -n abaci -l app=abaci-app --tail=100
```

## CI/CD Pipeline

- **Argo CD Image Updater**: Watches for new container images and auto-deploys

## Application Architecture

- **Deployment**: `abaci-app` with 3 replicas for HA
- **Services**:
  - `abaci-app` (ClusterIP) - main service
  - `abaci-app-headless` - for StatefulSet DNS
  - `abaci-app-primary` - routes to primary instance
- **Redis**: Session/cache store

## Production Database (libsql)

**Production does NOT use a local SQLite file.** The `DATABASE_URL` points to a libsql server running in-cluster:

```
DATABASE_URL=http://libsql.abaci.svc.cluster.local:8080
```

**The local dev database** (`apps/web/data/sqlite.db`) is a separate SQLite file — changes there do NOT affect production.

**To query the production database**, exec into any app pod and use Node.js with the libsql HTTP API (no `curl` or `sqlite3` available in the container):

```bash
# 1. Get a pod name
kubectl get pods -n abaci -l app=abaci-app

# 2. Run a query via Node.js fetch to the libsql HTTP pipeline API
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

**Convenience script** (preferred — works from local terminal):
```bash
./scripts/prod-query.sh "SELECT id, email, upgraded_at FROM users WHERE email IS NOT NULL LIMIT 5"
```

**From Claude Code** (when you need to query prod programmatically), use `mcp__kubernetes__exec_in_pod` or just run the script via Bash tool.

**Important notes:**
- Column names use `snake_case` in SQL (e.g., `user_id`, `is_practice_student`), NOT camelCase
- Use parameterized queries for safety when using the raw API: `{ sql: 'SELECT * FROM users WHERE id = ?', args: [{ type: 'text', value: 'some-id' }] }`
- Multiple queries can be batched in a single `requests` array

## Fixbot (Automated CI Fix System)

Fixbot automatically detects CI failures on main, diagnoses them, and opens fix PRs.

- **Issues** are prefixed `[fixbot]` and labeled `fixbot`
- **PRs** are on `fixbot/` branches
- **Implementation** lives in `.github/fixbot/` (workflows + prompts)
- **Full reference**: See `.claude/FIXBOT.md` for how to interact with fixbot, the "ensure main is on prod" procedure, and what NOT to do

## Euclid's Elements Interactive (Toys)

Interactive compass-and-straightedge exploration of Euclid's Elements Book I. Inspired by Byrne's 1847 color-coded edition.

**Reference files** (READ THESE before working on the Euclid toy — they contain the full text of Book I so you don't need to re-fetch it):
- `apps/web/src/components/toys/euclid/reference/book1-foundations.md` — All 23 definitions, 5 postulates, 5 common notions with commentary
- `apps/web/src/components/toys/euclid/reference/book1-propositions.md` — All 48 propositions: statements, types (construction/theorem), proof summaries, dependencies
- `apps/web/src/components/toys/euclid/reference/book1-dependency-graph.md` — Machine-readable DAG of proposition dependencies, thematic groupings, parallel postulate boundary
- `apps/web/src/components/toys/euclid/reference/pedagogy-and-design.md` — Byrne-inspired design notes, color palette, interaction model, data structures, progression tracks
- `apps/web/src/components/toys/euclid/reference/authoring-guide.md` — Step-by-step guide for implementing new propositions: geometry, tutorials, exploration narration, draggable points, testing

**Architecture decision:** New toy at `toys/euclid/`, NOT an extension of the coordinate plane. Reuses shared infrastructure (Canvas 2D + RAF loop, coordinate conversions, collision detection, hit testing) but has its own construction-oriented interaction model. Uses `@flatten-js/core` for intersection computation.
