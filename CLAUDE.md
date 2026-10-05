# Soroban Abacus Flashcards — Project Instructions

## Shared Infrastructure — CRITICAL

`infra/terraform/` still declares **shared k8s infrastructure** used by many projects, not just this app: the Woodpecker server, ArgoCD, cert-manager and the monitoring stack. This is known organizational debt (platform#25); shared pieces move to the platform repo when they are next touched, and are never edited here.

**Gitea is no longer here.** Gitea, its registry, their volumes and the `gitea` namespace moved to platform `k8s/gitea` on 2026-10-05 (git.dev.abaci.one/antialias/platform). Change them there. `woodpecker.tf` and `claude-issue-bot.tf` still put objects in the `gitea` namespace and name its PVC and `gitea-admin` Secret as literals.

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
