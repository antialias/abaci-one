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

**NEVER build Docker images locally.** The GitHub Actions pipeline handles this.

### Automatic Deployment (via Keel)

After Keel is deployed, the workflow is fully automatic:

1. Commit and push to main
2. GitHub Actions builds and pushes image to `ghcr.io`
3. **Keel automatically detects the new image** (polls every 2 minutes)
4. Keel triggers a rolling restart of pods
5. No manual intervention required!

To verify Keel is working:
```bash
kubectl --kubeconfig=/Users/antialias/.kube/k3s-config -n keel logs -l app=keel --tail=50
```

### Manual Deployment (if Keel is not deployed yet)

1. Make code changes
2. Commit and push to main
3. Monitor build: `gh run watch`
4. Apply infrastructure: `cd infra/terraform && terraform apply`
5. Verify pods: `kubectl --kubeconfig=~/.kube/k3s-config -n abaci get pods`

### Manual Rollout (quick restart)

To force pods to pull the latest image without terraform:
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
