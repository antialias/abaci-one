# K3s Infrastructure for Abaci.one

This directory contains Terraform configuration for deploying the Abaci.one application to a k3s (lightweight Kubernetes) cluster.

## Architecture Overview

```
                    Internet
                        │
                        ▼
            ┌───────────────────┐
            │  NAS Traefik      │  (Entry point, handles SSL for all domains)
            │  (Docker)         │  Config: /volume1/homes/antialias/projects/traefik/services.yaml
            │  - SSL/TLS via    │
            │    Let's Encrypt  │
            │  - Routes to k3s  │
            └─────────┬─────────┘
                      │
                      ▼ passHostHeader: true
            ┌───────────────────┐
            │  k3s Traefik      │  (Internal ingress controller)
            │  - Rate Limiting  │
            │  - HSTS           │
            │  - Path routing   │
            └─────────┬─────────┘
                      │
                      ▼
            ┌───────────────────┐
            │  abaci-app Service│  (Load Balancer)
            └─────────┬─────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ Pod-0   │  │ Pod-1   │  │ Pod-2   │
   │ PRIMARY │  │ REPLICA │  │ REPLICA │
   │         │  │         │  │         │
   │ LiteFS  │──│ LiteFS  │──│ LiteFS  │
   │ (FUSE)  │  │ (FUSE)  │  │ (FUSE)  │
   │         │  │         │  │         │
   │ Next.js │  │ Next.js │  │ Next.js │
   └────┬────┘  └────┬────┘  └────┬────┘
        │            │            │
        └────────────┴────────────┘
                     │
              ┌──────┴──────┐
              │    Redis    │
              └─────────────┘
```

## Key Components

### StatefulSet: `abaci-app`
- 3 replicas with stable network identities (pod-0, pod-1, pod-2)
- Pod-0 is always the primary (handles database writes)
- Other pods are replicas (receive replicated data via LiteFS)

### LiteFS
- Provides distributed SQLite with automatic replication
- Mounted via FUSE at `/litefs`
- Primary handles all writes, replicas forward writes to primary
- Replicas maintain read-only copies for load distribution

### Keel (Auto-Deployment)
- Watches `ghcr.io` for new images
- Polls every 2 minutes for `:latest` tag changes
- Automatically triggers rolling updates when new images are detected
- **No manual deployment steps required after pushing to main**

### Services
- **abaci-app**: ClusterIP service, load balances across all pods
- **abaci-app-headless**: Headless service for pod-to-pod DNS (LiteFS replication)

### Ingress
- Traefik ingress controller (included with k3s)
- SSL certificates via cert-manager + Let's Encrypt
- HSTS, rate limiting, and in-flight request limits

## File Structure

```
infra/terraform/
├── main.tf           # Providers and namespace
├── app.tf            # Main app StatefulSet, Services, Ingress
├── keel.tf           # Keel auto-deployment
├── redis.tf          # Redis deployment for sessions/cache
├── cert-manager.tf   # SSL certificate management
├── storage.tf        # PVC for vision training data
├── variables.tf      # Input variables
├── outputs.tf        # Terraform outputs
├── versions.tf       # Provider versions
├── .claude/
│   └── LITEFS_K8S.md # LiteFS troubleshooting guide
├── CLAUDE.md         # Agent instructions
└── README.md         # This file
```

## Deployment Workflow

### Automatic (Normal Flow)

1. **Push code to main** → GitHub Actions builds Docker image
2. **Image pushed to ghcr.io** with `:latest` tag
3. **Keel detects new image** (within 2 minutes)
4. **Rolling update triggered** automatically

### Manual Infrastructure Changes

When you modify Terraform files:

```bash
cd infra/terraform
terraform plan        # Review changes
terraform apply       # Apply changes
```

### Manual Pod Restart

To force an immediate rollout without waiting for Keel:

```bash
kubectl --kubeconfig=~/.kube/k3s-config -n abaci rollout restart statefulset abaci-app
```

## Common Operations

### Check Pod Status
```bash
kubectl --kubeconfig=~/.kube/k3s-config -n abaci get pods
```

### View Logs
```bash
# App logs
kubectl --kubeconfig=~/.kube/k3s-config -n abaci logs abaci-app-0 -f

# Keel logs (auto-deployment)
kubectl --kubeconfig=~/.kube/k3s-config -n keel logs -l app=keel
```

### Check LiteFS Replication
```bash
# Primary should show "stream connected"
kubectl --kubeconfig=~/.kube/k3s-config -n abaci logs abaci-app-0 | grep stream

# Replicas should show "connected to cluster"
kubectl --kubeconfig=~/.kube/k3s-config -n abaci logs abaci-app-1 | grep connected
```

### Query Production Database
```bash
kubectl --kubeconfig=~/.kube/k3s-config -n abaci exec abaci-app-0 -- sqlite3 /litefs/sqlite.db "SELECT COUNT(*) FROM users"
```

### Scale Replicas
```bash
# Scale to 5 replicas
kubectl --kubeconfig=~/.kube/k3s-config -n abaci scale statefulset abaci-app --replicas=5

# Or update var.app_replicas in terraform.tfvars and apply
```

## Troubleshooting

### Pods Stuck in Pending
```bash
kubectl --kubeconfig=~/.kube/k3s-config -n abaci describe pod abaci-app-0
```

### LiteFS Cluster ID Mismatch
If replicas fail with "cannot stream from primary with a different cluster id":

```bash
# Scale to 1, delete replica PVC, scale back up
kubectl --kubeconfig=~/.kube/k3s-config -n abaci scale statefulset abaci-app --replicas=1
kubectl --kubeconfig=~/.kube/k3s-config -n abaci delete pvc litefs-data-abaci-app-1
kubectl --kubeconfig=~/.kube/k3s-config -n abaci scale statefulset abaci-app --replicas=3
```

### Keel Not Updating
1. Check Keel logs for errors
2. Verify annotations on StatefulSet: `keel.sh/policy=force`
3. Check if image digest actually changed in ghcr.io

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | production |
| `PORT` | 3000 (internal, proxied through LiteFS at 8080) |
| `DATABASE_URL` | /litefs/sqlite.db |
| `REDIS_URL` | redis://redis:6379 |
| `AUTH_SECRET` | NextAuth.js secret (from terraform secret) |

## SSL/TLS

SSL is handled at **two levels**:

1. **NAS Traefik** (external entry point)
   - Terminates SSL for all domains (abaci.one, status.abaci.one, etc.)
   - Issues certs via Let's Encrypt (`certresolver: "myresolver"`)
   - Config: `nas:/volume1/homes/antialias/projects/traefik/services.yaml`

2. **k3s Traefik** (internal)
   - Receives traffic from NAS Traefik (passHostHeader)
   - Handles internal routing and rate limiting
   - Can optionally manage additional certs for internal services

## Adding New Subdomains

To add a new subdomain (e.g., `api.abaci.one`):

1. **Add DNS record** (via Porkbun)
   ```bash
   # CNAME pointing to main domain
   curl -X POST "https://api.porkbun.com/api/json/v3/dns/create/abaci.one" \
     -d '{"name": "api", "type": "CNAME", "content": "abaci.one", ...}'
   ```

2. **Update NAS Traefik** (`services.yaml`)
   ```yaml
   http:
     routers:
       api-k3s:
         rule: "Host(`api.abaci.one`)"
         service: abaci-k3s
         entryPoints: ["websecure"]
         tls:
           certresolver: "myresolver"
       api-k3s-http:
         rule: "Host(`api.abaci.one`)"
         service: abaci-k3s
         entryPoints: ["web"]
         middlewares: ["redirect-https"]
   ```
   File location: `nas:/volume1/homes/antialias/projects/traefik/services.yaml`
   Traefik auto-reloads this file.

3. **Add k3s Ingress** (in Terraform)
   ```hcl
   resource "kubernetes_ingress_v1" "api" {
     # ... standard ingress config
     spec {
       rule {
         host = "api.abaci.one"
         # ...
       }
     }
   }
   ```

4. **Apply Terraform**
   ```bash
   terraform apply
   ```
