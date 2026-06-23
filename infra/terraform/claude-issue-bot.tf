# ===========================================================================
# claude-issue-bot — Gitea identity + instance-wide trigger
# ===========================================================================
#
# The service itself (FastAPI + read-only Claude Code agent) lives in the
# antialias/claude-issue-bot Gitea repo and is deployed on the NAS via Woodpecker.
# THIS file provisions the Gitea-side pieces it depends on:
#
#   1. claude-bot         a distinct site-admin Gitea user (distinct identity for loop
#                         prevention + visibility into every private repo, incl. future ones)
#                         with a NARROWLY-scoped access token (read:repository, write:issue,
#                         read:user) — so the token itself can't do admin or push code.
#   2. webhooks           an `issue_comment` webhook reaching EVERY repo (existing + future).
#                         Gitea's API CANNOT create a true *system* webhook: `CreateHookOption`
#                         has no `is_system_webhook` field, and `POST /admin/hooks` creates a
#                         *default* webhook (verified empirically: the created hook lands in the
#                         `type=default` bucket, `type=system` stays empty). A default webhook is
#                         only COPIED into repos created AFTER it exists — it does NOT fire for
#                         existing repos. Flipping `is_system_webhook` directly in the DB is off-
#                         limits (Gitea's SQLite lives on an NFS PVC and is SHARED infra). So we
#                         cover all repos with API-only calls in TWO parts:
#                           a) the default admin webhook  -> auto-applied to all FUTURE repos
#                           b) a per-repo webhook on every EXISTING repo (enumerate + create)
#                         No overlap: a repo is either existing (gets b) or future (gets a's copy),
#                         so the service's comment.id dedup is never even stressed. Gated behind a
#                         var so it's added LAST, after the per-repo pilot succeeds.
#                         NOTE on secret rotation: the job is idempotent on the hook URL, and Gitea
#                         never returns a hook's secret, so a changed WEBHOOK_SECRET is NOT detected
#                         — rotating it means deleting the affected hooks first, then re-running.
#
# The webhook SSRF allowlist (NAS IP added to [webhook] ALLOWED_HOST_LIST) is in gitea.tf.
# All admin operations reuse gitea.tf's patterns: the gitea CLI on the data PVC (user/token,
# mirroring gitea_admin_setup) and the admin-API-curl job (webhook, mirroring gitea_repo_setup).

# Bot password: generated, never needed by a human (only the minted token matters, and that is
# surfaced separately). Stored in a Secret for idempotent reference across applies.
resource "random_password" "claude_bot" {
  length  = 32
  special = false
}

resource "kubernetes_secret" "claude_bot" {
  metadata {
    name      = "claude-bot-credentials"
    namespace = kubernetes_namespace.gitea.metadata[0].name
  }

  data = {
    username = "claude-bot"
    email    = "claude-bot@dev.${var.app_domain}"
    password = random_password.claude_bot.result
  }
}

# ---------------------------------------------------------------------------
# Provision the claude-bot user + access token (gitea CLI on the data PVC).
#
# Why the CLI (not the admin API)? Admin sudo can't mint a token for another user via the API,
# but `gitea admin user generate-access-token` can mint one for any user server-side. Both steps
# are idempotent: user creation is skipped if present; token minting tolerates "already used".
#
# The token is printed to this job's logs ONCE (only on first mint) for manual placement into the
# NAS .env (GITEA_TOKEN) — the same one-time secret handoff release-summary uses for its model
# keys. Retrieve it with:
#   kubectl -n gitea logs job/claude-bot-provision
# ---------------------------------------------------------------------------
resource "kubernetes_job" "claude_bot_provision" {
  metadata {
    name      = "claude-bot-provision"
    namespace = kubernetes_namespace.gitea.metadata[0].name
  }

  spec {
    # Generous TTL so there's ample time to copy the token out of the logs before GC.
    ttl_seconds_after_finished = 1800

    template {
      metadata {
        labels = {
          app = "claude-bot-provision"
        }
      }

      spec {
        restart_policy = "OnFailure"

        init_container {
          name  = "wait-for-gitea"
          image = "busybox:1.36"

          command = ["/bin/sh", "-c"]
          args = [
            <<-EOT
              echo "Waiting for Gitea to be ready..."
              until wget -q --spider http://gitea.${kubernetes_namespace.gitea.metadata[0].name}.svc.cluster.local:3000/api/healthz; do
                echo "Gitea not ready, waiting..."
                sleep 5
              done
              # Extra wait for admin user setup to settle.
              sleep 10
              echo "Gitea is ready!"
            EOT
          ]
        }

        container {
          name  = "provision"
          image = "gitea/gitea:1.25-rootless"

          env {
            name = "BOT_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.claude_bot.metadata[0].name
                key  = "username"
              }
            }
          }

          env {
            name = "BOT_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.claude_bot.metadata[0].name
                key  = "password"
              }
            }
          }

          env {
            name = "BOT_EMAIL"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.claude_bot.metadata[0].name
                key  = "email"
              }
            }
          }

          command = ["/bin/sh", "-c"]
          args = [
            <<-EOT
              set -e
              export GITEA_WORK_DIR=/data
              export GITEA_CUSTOM=/data/gitea
              CONF=/data/gitea/conf/app.ini
              TOKEN_NAME=claude-issue-bot

              # 1) Create the bot user as a SITE ADMIN if it doesn't already exist.
              if gitea admin user list --config "$CONF" 2>/dev/null | grep -q "$BOT_USER"; then
                echo "User $BOT_USER already exists, skipping creation"
              else
                echo "Creating site-admin user $BOT_USER..."
                gitea admin user create \
                  --config "$CONF" \
                  --username "$BOT_USER" \
                  --password "$BOT_PASSWORD" \
                  --email "$BOT_EMAIL" \
                  --admin \
                  --must-change-password=false
              fi

              # 2) Mint a narrowly-scoped access token. Idempotent: if the token name is taken,
              #    generate-access-token errors and we leave the existing one in place (its value
              #    can't be re-read; re-minting requires deleting it in the UI first).
              echo "Minting access token '$TOKEN_NAME' (scopes: read:repository,write:issue,read:user)..."
              if gitea admin user generate-access-token \
                   --config "$CONF" \
                   --username "$BOT_USER" \
                   --token-name "$TOKEN_NAME" \
                   --scopes "read:repository,write:issue,read:user" \
                   --raw > /tmp/tok 2>/tmp/err; then
                echo "============================================================"
                echo "CLAUDE-BOT GITEA TOKEN (copy to NAS .env as GITEA_TOKEN):"
                cat /tmp/tok
                echo ""
                echo "============================================================"
              else
                echo "Token not minted (likely already exists — not re-printing):"
                cat /tmp/err || true
              fi
            EOT
          ]

          volume_mount {
            name       = "data"
            mount_path = "/data"
          }
        }

        volume {
          name = "data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.gitea.metadata[0].name
          }
        }
      }
    }
  }

  depends_on = [kubernetes_job.gitea_admin_setup]
}

# ---------------------------------------------------------------------------
# Instance-wide issue_comment webhooks (-> claude-issue-bot on the NAS).
#
# Gated by enable_claude_bot_system_webhook. Add this LAST, after the per-repo pilot succeeds.
# Idempotent and re-runnable (safe on every apply). A single Python step (python:3.12-slim has
# urllib + json built in — no jq) does BOTH parts described in the header comment above:
#   a) ensure the DEFAULT admin webhook exists  -> Gitea copies it into all FUTURE repos
#   b) enumerate the owner's EXISTING repos and ensure each has its own issue_comment webhook
# Each step checks for our hook URL before creating, so re-runs only fill gaps.
# ---------------------------------------------------------------------------
resource "kubernetes_job" "claude_bot_webhooks" {
  count = var.enable_claude_bot_system_webhook ? 1 : 0

  metadata {
    name      = "claude-bot-webhooks"
    namespace = kubernetes_namespace.gitea.metadata[0].name
  }

  spec {
    ttl_seconds_after_finished = 300

    template {
      metadata {
        labels = {
          app = "claude-bot-webhooks"
        }
      }

      spec {
        restart_policy = "OnFailure"

        init_container {
          name  = "wait-for-gitea"
          image = "busybox:1.36"

          command = ["/bin/sh", "-c"]
          args = [
            <<-EOT
              echo "Waiting for Gitea to be ready..."
              until wget -q --spider http://gitea.${kubernetes_namespace.gitea.metadata[0].name}.svc.cluster.local:3000/api/healthz; do
                echo "Gitea not ready, waiting..."
                sleep 5
              done
              echo "Gitea is ready!"
            EOT
          ]
        }

        container {
          name  = "ensure-webhooks"
          image = "python:3.12-slim"

          env {
            name = "GITEA_ADMIN_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.gitea_admin.metadata[0].name
                key  = "username"
              }
            }
          }

          env {
            name = "GITEA_ADMIN_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.gitea_admin.metadata[0].name
                key  = "password"
              }
            }
          }

          env {
            name  = "GITEA_URL"
            value = "http://gitea.${kubernetes_namespace.gitea.metadata[0].name}.svc.cluster.local:3000"
          }

          env {
            name  = "WEBHOOK_URL"
            value = var.claude_bot_webhook_url
          }

          env {
            name  = "WEBHOOK_SECRET"
            value = var.gitea_webhook_secret
          }

          # The owner whose existing repos get a per-repo hook. All repos live under this user
          # (no Gitea orgs exist). UID 1 = antialias.
          env {
            name  = "OWNER_UID"
            value = var.claude_bot_owner_uid
          }

          command = ["/bin/sh", "-c"]
          # Write the script to /tmp (the only writable path) via a QUOTED heredoc so neither the
          # shell nor Terraform touches its contents, then run it. The Python uses only `{}` f-string
          # braces (never `$${...}`), so Terraform's `${}`/`%%{}` interpolation leaves it alone.
          args = [
            <<-EOT
              cat > /tmp/ensure_webhooks.py <<'PYEOF'
              import base64, json, os, sys, urllib.error, urllib.request

              api = os.environ["GITEA_URL"].rstrip("/") + "/api/v1"
              hook_url = os.environ["WEBHOOK_URL"]
              secret = os.environ["WEBHOOK_SECRET"]
              owner_uid = os.environ.get("OWNER_UID", "1")
              auth = base64.b64encode(
                  f"{os.environ['GITEA_ADMIN_USER']}:{os.environ['GITEA_ADMIN_PASSWORD']}".encode()
              ).decode()

              if not secret:
                  print("ERROR: gitea_webhook_secret is empty — set it before enabling.", file=sys.stderr)
                  sys.exit(1)

              def req(method, path, body=None):
                  data = json.dumps(body).encode() if body is not None else None
                  r = urllib.request.Request(api + path, data=data, method=method)
                  r.add_header("Authorization", "Basic " + auth)
                  if data is not None:
                      r.add_header("Content-Type", "application/json")
                  try:
                      with urllib.request.urlopen(r) as resp:
                          raw = resp.read().decode()
                          return resp.status, (json.loads(raw) if raw else None)
                  except urllib.error.HTTPError as e:
                      return e.code, e.read().decode()

              hook_body = {
                  "type": "gitea", "active": True, "events": ["issue_comment"],
                  "config": {"url": hook_url, "content_type": "json", "secret": secret},
              }

              def has_hook(hooks):
                  return isinstance(hooks, list) and any(
                      (h.get("config") or {}).get("url") == hook_url for h in hooks)

              # a) DEFAULT admin webhook -> auto-copied into FUTURE repos.
              status, hooks = req("GET", "/admin/hooks?type=default&limit=50")
              if status >= 300:
                  print(f"ERROR listing default hooks: {status} {hooks}", file=sys.stderr); sys.exit(1)
              if has_hook(hooks):
                  print("default webhook already present (future repos covered)")
              else:
                  s, r = req("POST", "/admin/hooks", hook_body)
                  print(f"create default webhook -> HTTP {s}")
                  if s >= 300:
                      print(r, file=sys.stderr); sys.exit(1)

              # b) Per-repo webhook on every EXISTING repo of the owner.
              created = skipped = failed = 0
              page = 1
              while True:
                  s, data = req("GET", f"/repos/search?uid={owner_uid}&limit=50&page={page}&private=true")
                  if s >= 300:
                      print(f"ERROR repo search: {s} {data}", file=sys.stderr); sys.exit(1)
                  repos = (data or {}).get("data") or []
                  if not repos:
                      break
                  for repo in repos:
                      fn = repo["full_name"]
                      s, rhooks = req("GET", f"/repos/{fn}/hooks?limit=50")
                      if s >= 300:
                          print(f"  {fn}: list hooks failed {s}", file=sys.stderr); failed += 1; continue
                      if has_hook(rhooks):
                          skipped += 1; continue
                      s, r = req("POST", f"/repos/{fn}/hooks", hook_body)
                      if s >= 300:
                          print(f"  {fn}: create FAILED {s} {r}", file=sys.stderr); failed += 1
                      else:
                          created += 1; print(f"  {fn}: hook created")
                  page += 1

              print(f"done: {created} created, {skipped} already present, {failed} failed")
              if failed:
                  sys.exit(1)
              PYEOF
              python /tmp/ensure_webhooks.py
            EOT
          ]
        }
      }
    }
  }

  depends_on = [kubernetes_job.claude_bot_provision]
}
