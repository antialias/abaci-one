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

- **StatefulSet**: `abaci-app` with 3 replicas for HA
- **Services**:
  - `abaci-app` (ClusterIP) - main service
  - `abaci-app-headless` - for StatefulSet DNS
  - `abaci-app-primary` - routes to primary instance
- **Redis**: Session/cache store

## Fixbot (Automated CI Fix System)

Fixbot automatically detects CI failures on main, diagnoses them, and opens fix PRs.

- **Issues** are prefixed `[fixbot]` and labeled `fixbot`
- **PRs** are on `fixbot/` branches
- **Implementation** lives in `.github/fixbot/` (workflows + prompts)
- **Full reference**: See `.claude/FIXBOT.md` for how to interact with fixbot, the "ensure main is on prod" procedure, and what NOT to do
