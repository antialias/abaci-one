# Infrastructure - Claude Code Instructions

## CRITICAL: Production Database Access

**The MCP sqlite tools query the LOCAL dev database, NOT production.**

To query the production k3s database, use kubectl:
```bash
kubectl --kubeconfig=/Users/antialias/.kube/k3s-config -n abaci exec abaci-app-0 -- sqlite3 /litefs/sqlite.db "YOUR QUERY HERE"
```

NEVER use `mcp__sqlite__read_query` or similar when you need production data.

## Kubernetes Access

kubeconfig location: `~/.kube/k3s-config`

```bash
kubectl --kubeconfig=/Users/antialias/.kube/k3s-config -n abaci get pods
```

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

**NEVER build Docker images locally.** Gitea Actions handles all builds.

### CI/CD Architecture

```
┌─────────────────────────────────────────────────────────┐
│              MacBook Runner (ARM64)                      │
│  Fast builds (~5 min) for:                              │
│  - Storybook deployment                                  │
│  - Tests, linting, releases                             │
│  - npm publish                                           │
└─────────────────────────────────────────────────────────┘
                          │
                          │ fallback if offline
                          ▼
┌─────────────────────────────────────────────────────────┐
│              k3s Runner (x86_64)                         │
│  Required for (~30 min, slower but reliable):           │
│  - Docker image builds (must be x86_64 for k3s)         │
│  - Fallback for all JS/TS workflows                     │
└─────────────────────────────────────────────────────────┘
```

### Automatic Deployment (via Keel)

Fully automatic, no GitHub dependency:

1. Commit and push to Gitea (main branch)
2. Gitea Actions builds image → pushes to local registry
3. **Keel detects new image** (polls every 2 minutes)
4. Keel triggers rolling restart of pods
5. No manual intervention required!

**Registry**: `registry.gitea.svc.cluster.local:5000/abaci-app:latest`

To verify Keel is working:
```bash
kubectl --kubeconfig=/Users/antialias/.kube/k3s-config -n keel logs -l app=keel --tail=50
```

### Gitea Workflows

| Workflow | Purpose | Runner |
|----------|---------|--------|
| `deploy.yml` | Docker image build | k3s only (x86_64) |
| `smoke-tests.yml` | Smoke tests image | k3s only (x86_64) |
| `deploy-storybook.yml` | Static site build | MacBook + fallback |
| `release.yml` | Semantic release | MacBook + fallback |
| `templates-test.yml` | Package tests | MacBook + fallback |

### MacBook Runner Management

```bash
# Check status
launchctl list | grep gitea

# View logs
tail -f ~/gitea-runner/runner.log

# Restart
launchctl unload ~/Library/LaunchAgents/com.gitea.act-runner.plist
launchctl load ~/Library/LaunchAgents/com.gitea.act-runner.plist
```

### Manual Rollout (quick restart)

To force pods to pull the latest image:
```bash
kubectl --kubeconfig=~/.kube/k3s-config -n abaci rollout restart statefulset abaci-app
```

## Reference Docs

| Topic | Doc |
|-------|-----|
| LiteFS on K8s | `.claude/LITEFS_K8S.md` |
| Infrastructure README | `README.md` |

## Key Resources

- **StatefulSet**: `abaci-app` (app pods with LiteFS)
- **Headless Service**: `abaci-app-headless` (pod-to-pod DNS)
- **Main Service**: `abaci-app` (load balancer for GET requests)
- **Primary Service**: `abaci-app-primary` (routes to pod-0 only for writes)
- **Ingress**: Routes `abaci.one` to app service
- **IngressRoute**: Routes POST/PUT/DELETE/PATCH to primary service

## CRITICAL: LiteFS Write Routing on k8s

**LiteFS proxy only works properly on Fly.io.** On replicas, it returns a `fly-replay` header expecting Fly.io's infrastructure to re-route to the primary. k8s Traefik doesn't understand this header.

**Symptoms of broken write routing:**
- POST requests return 200 with empty body (~60-80% of the time)
- Server logs show `http: proxy response error: context canceled`
- Works when hitting primary pod directly, fails through load balancer

**Solution implemented:**
- `abaci-app-primary` service targets only pod-0 (LiteFS primary)
- Traefik IngressRoute routes POST/PUT/DELETE/PATCH to primary service
- GET requests still load-balance across all replicas

**Do NOT:**
- Add API paths to LiteFS `passthrough` config as a workaround
- Expect LiteFS proxy to forward writes on non-Fly.io deployments

## Common Operations

### Restart pods (rolling)
```bash
kubectl --kubeconfig=~/.kube/k3s-config -n abaci rollout restart statefulset abaci-app
```

### Check LiteFS replication
```bash
# Primary should show "stream connected"
kubectl --kubeconfig=~/.kube/k3s-config -n abaci logs abaci-app-0 | grep stream

# Replica should show "connected to cluster"
kubectl --kubeconfig=~/.kube/k3s-config -n abaci logs abaci-app-1 | grep connected
```

### Force replica to re-sync (cluster ID mismatch)
```bash
kubectl --kubeconfig=~/.kube/k3s-config -n abaci scale statefulset abaci-app --replicas=1
kubectl --kubeconfig=~/.kube/k3s-config -n abaci delete pvc litefs-data-abaci-app-1
kubectl --kubeconfig=~/.kube/k3s-config -n abaci scale statefulset abaci-app --replicas=2
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

**Known findings from prior investigation:**
- Gitea runner container uses ~1.3GB memory when idle
- Node has 15.6GB RAM, ~30% used at baseline
- Node CPU at ~10% baseline
- Docker storage on containerd: 54GB at `/var/lib/rancher/k3s/agent/containerd`

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
