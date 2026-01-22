# LiteFS on Kubernetes - Reference Guide

## Architecture Overview

LiteFS provides distributed SQLite by replicating from a primary node to replicas.

```
Pod-0 (Primary)     Pod-1 (Replica)     Pod-N (Replica)
    │                    │                    │
    └────────────────────┴────────────────────┘
           LiteFS replication stream
```

- **StatefulSet** required for stable pod identities (abaci-app-0, abaci-app-1)
- **Headless Service** required for pod-to-pod DNS resolution
- Pod-0 is always the primary (handles writes, runs migrations)
- Other pods are replicas (receive replicated data, forward writes to primary)

## Critical Configuration Gotchas

### 1. HOSTNAME Environment Variable

**NEVER set `HOSTNAME` in Dockerfile or ConfigMap.** LiteFS needs the actual pod hostname (e.g., `abaci-app-0`) for cluster communication. Setting `HOSTNAME=0.0.0.0` or any other value breaks LiteFS.

```dockerfile
# BAD - breaks LiteFS
ENV HOSTNAME="0.0.0.0"

# GOOD - let the pod set its own hostname
# (don't set HOSTNAME at all)
```

### 2. Static Lease Configuration

For static primary election, ALL nodes must point to the same primary hostname:

```yaml
# In litefs.yml - ALL NODES use the same values
lease:
  type: "static"
  hostname: "abaci-app-0"  # Fixed primary hostname
  advertise-url: "http://abaci-app-0.abaci-app-headless.abaci.svc.cluster.local:20202"
  candidate: ${LITEFS_CANDIDATE}  # true for pod-0, false for others
```

**Common mistake:** Using `${HOSTNAME}` for the hostname field. This makes each pod think IT is the primary.

### 3. LITEFS_CANDIDATE Must Be Set at Runtime

Environment variable substitution in litefs.yml doesn't work reliably. Generate the config at container startup:

```bash
# In container command
export LITEFS_CANDIDATE=$(cat /config/litefs-candidate)
cat > /tmp/litefs.yml << EOF
lease:
  candidate: $LITEFS_CANDIDATE
EOF
exec litefs mount -config /tmp/litefs.yml
```

### 4. LiteFS 0.5 Config Changes

These fields do NOT exist in LiteFS 0.5:
- `primary-redirect-url` (removed from proxy config)

### 5. Cluster ID Mismatch After Failed Attempts

If replicas fail to connect with "cannot stream from primary with a different cluster id":

```bash
# Scale down
kubectl -n abaci scale statefulset abaci-app --replicas=1

# Delete the replica's PVC
kubectl -n abaci delete pvc litefs-data-abaci-app-1

# Scale back up - replica will get fresh volume and adopt primary's cluster ID
kubectl -n abaci scale statefulset abaci-app --replicas=2
```

### 6. Migration Path

Ensure the migration command path matches your build output:
```yaml
exec:
  - cmd: "node dist/db/migrate.js"  # NOT dist/migrate.js
    if-candidate: true
```

### 7. Required Container Privileges

LiteFS needs FUSE mount capability:
```hcl
security_context {
  run_as_user  = 0
  run_as_group = 0
  privileged   = true  # Required for FUSE
}
```

## Debugging Commands

```bash
# Check pod logs for LiteFS messages
kubectl -n abaci logs abaci-app-0 | grep -i litefs
kubectl -n abaci logs abaci-app-1 | grep -i litefs

# Verify primary is accepting connections
kubectl -n abaci logs abaci-app-0 | grep "stream connected"

# Verify replica connected successfully
kubectl -n abaci logs abaci-app-1 | grep "connected to cluster"

# Check PVCs
kubectl -n abaci get pvc
```

## Workflow Reminder

**Don't build Docker images locally.** Use GitHub Actions:
1. Commit and push changes
2. Monitor build: `gh run watch`
3. Apply Terraform: `terraform apply`
4. Check pod logs
