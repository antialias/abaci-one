# Soroban Abacus Flashcards — Project Instructions

The soroban abacus flashcards web app (Next.js, in `apps/web`) plus the Terraform/k8s infra that runs it (`infra/terraform`). Production runs on a k3s cluster at `192.168.86.37`; the NAS Traefik fronts it.

- **Working in `apps/web`?** App rules live in `apps/web/.claude/CLAUDE.md`.
- **Deploy, prod DB, registry, k3s, terraform?** See `infra/terraform/CLAUDE.md`.
- **Shared-infra note:** `infra/terraform/gitea.tf` manages k8s infrastructure shared by other projects (weather-display, abaci.one) — read `infra/terraform/CLAUDE.md` before touching it.

## Source Control

- **GitHub**: https://github.com/antialias/abaci-one
- Use the `gh` CLI for issues, PRs, and other GitHub operations.

## Deployment

CI builds and pushes images; deploys are automatic (Argo CD in k3s; the NAS runs **Watchtower** for its Docker containers, checking every few minutes). Wait a few minutes after a build rather than deploying by hand. Full pipeline: `infra/terraform/CLAUDE.md` → Deployment Workflow.

Check this app's deployed revision on the NAS, then compare with `git rev-parse HEAD` (if the NAS is behind after 5–10 minutes, Watchtower or the image pull may have a problem):

```bash
ssh nas.home.network '/usr/local/bin/docker inspect soroban-abacus-flashcards --format="{{index .Config.Labels \"org.opencontainers.image.revision\"}}"'
```
