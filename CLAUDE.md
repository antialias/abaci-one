# Soroban Abacus Flashcards — Project Instructions

## Shared Infrastructure — CRITICAL

This repo contains `infra/terraform/gitea.tf`, which manages **shared k8s infrastructure** used by multiple projects (weather-display, abaci.one, etc.) — not just this flashcard app. This is known organizational debt (tracked in weather-display#235).

### What gitea.tf manages

- **Gitea server**: deployment (`gitea/gitea:1.25-rootless`), service, ingress (`git.dev.abaci.one`, `firmware.dev.abaci.one`), config (app.ini via ConfigMap)
- **Act runner**: deployment with DinD sidecar, runner config
- **Local Docker registry**: deployment (`registry:2`), service, PVC
- **Init containers**: `init-config` (copies app.ini), `fix-dbfs-logs` (workaround for go-gitea/gitea#35110 — remove after Gitea >= 1.26, tracked in weather-display#234)
- **Setup jobs**: admin user creation, repo migration from GitHub
- **Namespace**: `gitea` on k3s at `192.168.86.37`
- **DB**: SQLite at `/data/gitea/gitea.db` (NFS PVC from NAS)

### Applying terraform changes

```bash
cd infra/terraform
terraform plan    # uses terraform.tfvars automatically
terraform apply
```

- State is **local** (`terraform.tfstate`), no remote backend
- Vars in `terraform.tfvars` (contains secrets — don't cat unnecessarily)
- Run from this machine, not from the NAS

### k3s access

```bash
ssh antialias@192.168.86.37
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl ...
```

### NAS access

```bash
ssh nas.home.network    # use this hostname, not the IP
```

NAS projects live at `~/projects/`. The NAS runs Docker containers (abaci.one, etc.) but Gitea is on k3s, not Docker.
