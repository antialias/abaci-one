# Infrastructure - Claude Code Instructions

## CRITICAL: Production Database Access

**The MCP sqlite tools query the LOCAL dev database, NOT production.**

To query the production database via libSQL:
```bash
# Port-forward to libSQL server
kubectl --kubeconfig=/Users/antialias/.kube/k3s-config -n abaci port-forward svc/libsql 8080:8080

# Then use curl or any HTTP client
curl -X POST http://localhost:8080/v2/pipeline -d '{"requests":[{"type":"execute","stmt":{"sql":"SELECT * FROM users LIMIT 5"}}]}'
```

Or exec into an app pod and use sqlite3 tools if needed for debugging.

NEVER use `mcp__sqlite__read_query` or similar when you need production data.

## Kubernetes Access

kubeconfig location: `~/.kube/k3s-config`

```bash
kubectl --kubeconfig=/Users/antialias/.kube/k3s-config -n abaci get pods
```

## Database Architecture

**libSQL Server** - All app pods connect to a single libSQL server for database access.

- **Dev**: `DATABASE_URL=file:./data/sqlite.db` (local SQLite file, no server needed)
- **Prod**: `DATABASE_URL=http://libsql.abaci.svc.cluster.local:8080`

This replaces the previous LiteFS setup. Benefits:
- Any pod can handle reads AND writes
- No write routing complexity
- No primary/replica distinction for the app
- Simple client-server model

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
GitHub Actions → ghcr.io → Keel → k3s Deployment
```

1. Push to GitHub (main branch)
2. GitHub Actions builds image → pushes to ghcr.io
3. **Keel detects new image** (polls every 2 minutes)
4. Keel triggers rolling restart of pods
5. No manual intervention required!

**Registry**: `ghcr.io/antialias/soroban-abacus-flashcards:latest`

To verify Keel is working:
```bash
kubectl --kubeconfig=/Users/antialias/.kube/k3s-config -n keel logs -l app=keel --tail=50
```

### Manual Rollout (quick restart)

To force pods to pull the latest image:
```bash
kubectl --kubeconfig=~/.kube/k3s-config -n abaci rollout restart deployment abaci-app
```

## Key Resources

- **Deployment**: `abaci-app` (app pods)
- **Deployment**: `libsql` (database server)
- **Service**: `abaci-app` (load balancer across all app pods)
- **Service**: `libsql` (internal access to database)
- **Ingress**: Routes `abaci.one` to app service
- **IngressRoute**: Socket.IO sticky sessions for `/api/socket`

## Common Operations

### Restart app pods (rolling)
```bash
kubectl --kubeconfig=~/.kube/k3s-config -n abaci rollout restart deployment abaci-app
```

### Check libSQL server status
```bash
kubectl --kubeconfig=~/.kube/k3s-config -n abaci logs -l app=libsql --tail=50
```

### Run migrations manually
```bash
# Exec into an app pod
kubectl --kubeconfig=~/.kube/k3s-config -n abaci exec -it deployment/abaci-app -- node dist/db/migrate.js
```

## Debugging Gitea Actions Runner Performance

**Grafana Dashboards:**
- **Ops Metrics** (uid: `ops-metrics`) - Infrastructure monitoring for CI/CD debugging
- **Product Metrics** (uid: `product-metrics`) - Application traffic and health

Access via: https://grafana.abaci.one (or use port-forward to localhost)

**Key panels for Gitea runner debugging (Ops Metrics dashboard):**

| Panel | Metric | What to Look For |
|-------|--------|------------------|
| Runner Memory Usage | `container_memory_working_set_bytes{namespace="gitea-runner"}` | Memory spikes during builds |
| Runner CPU Usage | `rate(container_cpu_usage_seconds_total{namespace="gitea-runner"}[5m])` | CPU saturation |
| Runner Network I/O | `rate(container_network_receive_bytes_total{namespace="gitea-runner"}[5m])` | Network bottlenecks |
| Node Memory % | `1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)` | System-wide memory pressure |
| Node CPU Usage | `1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))` | Total CPU with I/O wait |
| Disk Throughput | `rate(node_disk_read_bytes_total[5m])` | Disk read/write rates |
| Disk I/O Utilization | `rate(node_disk_io_time_seconds_total[5m])` | Disk saturation (>90% = bottleneck) |

**Quick Prometheus queries for debugging:**
```promql
# Runner memory during build
container_memory_working_set_bytes{namespace="gitea-runner", container="gitea-runner"}

# Node I/O wait (high = disk bottleneck)
avg(rate(node_cpu_seconds_total{mode="iowait"}[5m])) * 100

# Disk device utilization (>90% is bad)
rate(node_disk_io_time_seconds_total{device=~"sd.*|nvme.*"}[5m]) * 100
```

**If builds are slow, check in order:**
1. Disk I/O Utilization - if >90%, disk is the bottleneck
2. Node Memory % - if >85%, memory pressure causes swapping
3. I/O Wait - high I/O wait with low CPU = disk-bound
4. Runner Memory - spikes may indicate build is memory-heavy
