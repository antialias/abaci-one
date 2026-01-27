# Project Agent Notes

## Infrastructure - K3s Cluster

The project runs on a k3s cluster accessible via the Kubernetes MCP.

### Key Namespaces
- **gitea**: Gitea instance, container registry, Gitea runner (CI/CD)
- **abaci**: Main application (abaci-app StatefulSet with 3 replicas), Redis, Gatus (uptime monitoring), dev-artifacts
- **monitoring**: Prometheus stack (Grafana, Prometheus, node-exporter), Tempo (tracing)
- **kube-system**: Traefik ingress, CoreDNS, metrics-server
- **cert-manager**: TLS certificate management (letsencrypt-staging issuer)
- **keel**: Automatic deployment updates

### Key Services
| Service | Namespace | External URL |
|---------|-----------|--------------|
| Gitea | gitea | https://git.dev.abaci.one |
| App | abaci | https://abaci.one (via Traefik) |
| Registry | gitea | Internal container registry |
| Grafana | monitoring | (check ingress) |

### Useful Commands
```bash
# Check pod status
kubectl get pods -A

# Check app logs
kubectl logs -n abaci -l app=abaci-app --tail=100

# Check Gitea logs
kubectl logs -n gitea -l app=gitea --tail=100
```

## Gitea MCP

- **URL**: https://git.dev.abaci.one
- **Admin user**: antialias
- **API Token**: Configured in MCP (generated via `gitea admin user generate-access-token`)
- **Note**: The password in `gitea-admin` k8s secret is STALE - do not use for API auth

### Regenerating Token (if needed)
```bash
kubectl exec -n gitea $(kubectl get pod -n gitea -l app=gitea -o jsonpath='{.items[0].metadata.name}') -- \
  gitea admin user generate-access-token --username antialias --token-name claude-mcp --scopes all
```

## CI/CD Pipeline

- **Gitea Actions**: Runs in `gitea-runner` pod
- **Keel**: Watches for new container images and auto-deploys
- **Registry**: Internal registry at `registry.gitea.svc.cluster.local`

## Application Architecture

- **StatefulSet**: `abaci-app` with 3 replicas for HA
- **Services**:
  - `abaci-app` (ClusterIP) - main service
  - `abaci-app-headless` - for StatefulSet DNS
  - `abaci-app-primary` - routes to primary instance
- **Redis**: Session/cache store
