# Gitea - Self-hosted Git Server with CI/CD
#
# Replaces GitHub as primary repo + GitHub Actions for CI/CD.
# GitHub becomes a mirror/backup only.
#
# Architecture:
# - Gitea: Git hosting + web UI + Gitea Actions (GitHub Actions compatible)
# - Act Runner: Executes CI/CD pipelines using existing .github/workflows
# - Local Registry: Stores built Docker images
#
# Workflow:
# 1. git push → Gitea (primary)
# 2. Gitea Actions runs .github/workflows/*.yml
# 3. Built images pushed to local registry
# 4. Keel detects new images and updates app pods
# 5. Gitea mirrors to GitHub (backup)

# ===========================================================================
# Gitea Namespace
# ===========================================================================

resource "kubernetes_namespace" "gitea" {
  metadata {
    name = "gitea"

    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
    }
  }
}

# ===========================================================================
# Local Docker Registry (shared with CI builds)
# ===========================================================================

resource "kubernetes_persistent_volume" "registry" {
  metadata {
    name = "registry-pv"
    labels = {
      type = "nfs"
      app  = "registry"
    }
  }

  spec {
    capacity = {
      storage = "50Gi"
    }
    access_modes                     = ["ReadWriteMany"]
    persistent_volume_reclaim_policy = "Retain"
    storage_class_name               = "nfs"

    persistent_volume_source {
      nfs {
        server = var.nfs_server
        path   = "/volume1/homes/antialias/projects/abaci.one/data/registry"
      }
    }
  }
}

resource "kubernetes_persistent_volume_claim" "registry" {
  metadata {
    name      = "registry"
    namespace = kubernetes_namespace.gitea.metadata[0].name
  }

  spec {
    access_modes       = ["ReadWriteMany"]
    storage_class_name = "nfs"

    resources {
      requests = {
        storage = "50Gi"
      }
    }

    selector {
      match_labels = {
        type = "nfs"
        app  = "registry"
      }
    }
  }
}

resource "kubernetes_deployment" "registry" {
  metadata {
    name      = "registry"
    namespace = kubernetes_namespace.gitea.metadata[0].name
    labels = {
      app = "registry"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "registry"
      }
    }

    template {
      metadata {
        labels = {
          app = "registry"
        }
      }

      spec {
        container {
          name  = "registry"
          image = "registry:2"

          port {
            container_port = 5000
          }

          env {
            name  = "REGISTRY_STORAGE_DELETE_ENABLED"
            value = "true"
          }

          volume_mount {
            name       = "data"
            mount_path = "/var/lib/registry"
          }

          resources {
            requests = {
              memory = "64Mi"
              cpu    = "50m"
            }
            limits = {
              memory = "256Mi"
              cpu    = "500m"
            }
          }

          liveness_probe {
            http_get {
              path = "/v2/"
              port = 5000
            }
            initial_delay_seconds = 10
            period_seconds        = 30
          }
        }

        volume {
          name = "data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.registry.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "registry" {
  metadata {
    name      = "registry"
    namespace = kubernetes_namespace.gitea.metadata[0].name
  }

  spec {
    selector = {
      app = "registry"
    }

    port {
      port        = 5000
      target_port = 5000
    }

    type = "ClusterIP"
  }
}

# ===========================================================================
# Gitea Server
# ===========================================================================

resource "kubernetes_persistent_volume" "gitea" {
  metadata {
    name = "gitea-pv"
    labels = {
      type = "nfs"
      app  = "gitea"
    }
  }

  spec {
    capacity = {
      storage = "20Gi"
    }
    access_modes                     = ["ReadWriteMany"]
    persistent_volume_reclaim_policy = "Retain"
    storage_class_name               = "nfs"

    persistent_volume_source {
      nfs {
        server = var.nfs_server
        path   = "/volume1/homes/antialias/projects/abaci.one/data/gitea"
      }
    }
  }
}

resource "kubernetes_persistent_volume_claim" "gitea" {
  metadata {
    name      = "gitea"
    namespace = kubernetes_namespace.gitea.metadata[0].name
  }

  spec {
    access_modes       = ["ReadWriteMany"]
    storage_class_name = "nfs"

    resources {
      requests = {
        storage = "20Gi"
      }
    }

    selector {
      match_labels = {
        type = "nfs"
        app  = "gitea"
      }
    }
  }
}

resource "kubernetes_config_map" "gitea" {
  metadata {
    name      = "gitea-config"
    namespace = kubernetes_namespace.gitea.metadata[0].name
  }

  data = {
    # Gitea app.ini configuration
    "app.ini" = <<-EOT
      APP_NAME = Abaci Git
      RUN_MODE = prod
      RUN_USER = git

      [database]
      DB_TYPE  = sqlite3
      PATH     = /data/gitea/gitea.db

      [repository]
      ROOT = /data/git/repositories

      [server]
      DOMAIN           = git.dev.${var.app_domain}
      SSH_DOMAIN       = git.dev.${var.app_domain}
      HTTP_PORT        = 3000
      ROOT_URL         = https://git.dev.${var.app_domain}/
      DISABLE_SSH      = true
      LFS_START_SERVER = true
      LFS_JWT_SECRET   = ${random_password.gitea_lfs_jwt[0].result}

      [lfs]
      PATH = /data/git/lfs

      [mailer]
      ENABLED = false

      [service]
      DISABLE_REGISTRATION              = true
      REQUIRE_SIGNIN_VIEW               = false
      REGISTER_EMAIL_CONFIRM            = false
      ENABLE_NOTIFY_MAIL                = false
      ALLOW_ONLY_EXTERNAL_REGISTRATION  = false
      ENABLE_CAPTCHA                    = false
      DEFAULT_KEEP_EMAIL_PRIVATE        = false
      DEFAULT_ALLOW_CREATE_ORGANIZATION = true
      NO_REPLY_ADDRESS                  = noreply.localhost

      [picture]
      DISABLE_GRAVATAR        = false
      ENABLE_FEDERATED_AVATAR = true

      [openid]
      ENABLE_OPENID_SIGNIN = false
      ENABLE_OPENID_SIGNUP = false

      [session]
      PROVIDER = file

      [log]
      MODE      = console
      LEVEL     = info
      ROOT_PATH = /data/gitea/log

      [security]
      INSTALL_LOCK                  = true
      SECRET_KEY                    = ${random_password.gitea_secret_key[0].result}
      INTERNAL_TOKEN                = ${random_password.gitea_internal_token[0].result}
      PASSWORD_HASH_ALGO            = pbkdf2

      [actions]
      ENABLED = true
      DEFAULT_ACTIONS_URL = github

      [mirror]
      ENABLED = true
      DISABLE_NEW_PULL = false
      DISABLE_NEW_PUSH = false
      DEFAULT_INTERVAL = 8h
      MIN_INTERVAL = 10m
    EOT
  }
}

# Generate secrets for Gitea
resource "random_password" "gitea_secret_key" {
  count   = 1
  length  = 64
  special = false
}

resource "random_password" "gitea_internal_token" {
  count   = 1
  length  = 64
  special = false
}

resource "random_password" "gitea_lfs_jwt" {
  count   = 1
  length  = 43
  special = false
}

resource "kubernetes_deployment" "gitea" {
  metadata {
    name      = "gitea"
    namespace = kubernetes_namespace.gitea.metadata[0].name
    labels = {
      app = "gitea"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "gitea"
      }
    }

    template {
      metadata {
        labels = {
          app = "gitea"
        }
      }

      spec {
        # Run as git user (UID 1000 in gitea image)
        security_context {
          fs_group = 1000
        }

        init_container {
          name  = "init-config"
          image = "busybox:1.36"

          command = ["/bin/sh", "-c"]
          args = [
            # NFS root squashing prevents chown, so we just create dirs
            # and rely on 777 permissions set on the NFS share
            <<-EOT
              mkdir -p /data/gitea/conf /data/git/repositories /data/git/lfs
              cp /config/app.ini /data/gitea/conf/app.ini
              chmod -R 777 /data || true
            EOT
          ]

          volume_mount {
            name       = "data"
            mount_path = "/data"
          }

          volume_mount {
            name       = "config"
            mount_path = "/config"
          }
        }

        container {
          name  = "gitea"
          image = "gitea/gitea:1.21-rootless"

          port {
            container_port = 3000
            name           = "http"
          }

          # Tell Gitea where to find custom config
          env {
            name  = "GITEA_WORK_DIR"
            value = "/data"
          }

          env {
            name  = "GITEA_CUSTOM"
            value = "/data/gitea"
          }

          env {
            name  = "GITEA_APP_INI"
            value = "/data/gitea/conf/app.ini"
          }

          env {
            name  = "GITEA__database__DB_TYPE"
            value = "sqlite3"
          }

          env {
            name  = "GITEA__database__PATH"
            value = "/data/gitea/gitea.db"
          }

          volume_mount {
            name       = "data"
            mount_path = "/data"
          }

          resources {
            requests = {
              memory = "256Mi"
              cpu    = "100m"
            }
            limits = {
              memory = "512Mi"
              cpu    = "1000m"
            }
          }

          liveness_probe {
            http_get {
              path = "/api/healthz"
              port = 3000
            }
            initial_delay_seconds = 30
            period_seconds        = 30
          }

          readiness_probe {
            http_get {
              path = "/api/healthz"
              port = 3000
            }
            initial_delay_seconds = 10
            period_seconds        = 10
          }
        }

        volume {
          name = "data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.gitea.metadata[0].name
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.gitea.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "gitea" {
  metadata {
    name      = "gitea"
    namespace = kubernetes_namespace.gitea.metadata[0].name
  }

  spec {
    selector = {
      app = "gitea"
    }

    port {
      port        = 3000
      target_port = 3000
      name        = "http"
    }

    type = "ClusterIP"
  }
}

# Ingress for git.dev.abaci.one
resource "kubernetes_ingress_v1" "gitea" {
  metadata {
    name      = "gitea"
    namespace = kubernetes_namespace.gitea.metadata[0].name
    annotations = {
      "cert-manager.io/cluster-issuer"                   = var.use_staging_certs ? "letsencrypt-staging" : "letsencrypt-prod"
      "traefik.ingress.kubernetes.io/router.entrypoints" = "websecure"
    }
  }

  spec {
    ingress_class_name = "traefik"

    tls {
      hosts       = ["git.dev.${var.app_domain}"]
      secret_name = "gitea-tls"
    }

    rule {
      host = "git.dev.${var.app_domain}"

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.gitea.metadata[0].name
              port {
                number = 3000
              }
            }
          }
        }
      }
    }
  }

  depends_on = [null_resource.cert_manager_issuers]
}

# HTTP to HTTPS redirect
resource "kubernetes_ingress_v1" "gitea_http_redirect" {
  metadata {
    name      = "gitea-http-redirect"
    namespace = kubernetes_namespace.gitea.metadata[0].name
    annotations = {
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web"
      "traefik.ingress.kubernetes.io/router.middlewares" = "${kubernetes_namespace.abaci.metadata[0].name}-redirect-https@kubernetescrd"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = "git.dev.${var.app_domain}"

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.gitea.metadata[0].name
              port {
                number = 3000
              }
            }
          }
        }
      }
    }
  }
}

# ===========================================================================
# Gitea Actions Runner (act_runner)
# ===========================================================================

# The runner needs to be registered with Gitea after initial setup.
# This deployment will be created but the runner won't work until:
# 1. Gitea is running and you've created an admin account
# 2. Generate a runner token: Gitea UI → Site Admin → Actions → Runners → Create
# 3. Update the GITEA_RUNNER_REGISTRATION_TOKEN secret

resource "kubernetes_secret" "gitea_runner" {
  metadata {
    name      = "gitea-runner"
    namespace = kubernetes_namespace.gitea.metadata[0].name
  }

  data = {
    # Placeholder - update after Gitea setup
    GITEA_RUNNER_REGISTRATION_TOKEN = var.gitea_runner_token
  }
}

resource "kubernetes_config_map" "gitea_runner_config" {
  metadata {
    name      = "gitea-runner-config"
    namespace = kubernetes_namespace.gitea.metadata[0].name
  }

  data = {
    "config.yaml" = <<-EOT
      log:
        level: debug

      runner:
        file: /data/.runner
        capacity: 1
        timeout: 3h
        fetch_timeout: 5s
        fetch_interval: 2s

      cache:
        enabled: true
        dir: "/cache"
        host: ""
        external_server: ""

      container:
        network: "host"
        privileged: false
        docker_host: "tcp://localhost:2375"
        force_pull: false
        options: "--dns 8.8.8.8 --dns 8.8.4.4"
    EOT
  }
}

resource "kubernetes_deployment" "gitea_runner" {
  metadata {
    name      = "gitea-runner"
    namespace = kubernetes_namespace.gitea.metadata[0].name
    labels = {
      app = "gitea-runner"
    }
  }

  spec {
    replicas = var.gitea_runner_token != "" ? 1 : 0

    selector {
      match_labels = {
        app = "gitea-runner"
      }
    }

    template {
      metadata {
        labels = {
          app = "gitea-runner"
        }
      }

      spec {
        # Use explicit DNS to avoid IPv6 issues on home network
        dns_policy = "None"
        dns_config {
          nameservers = ["8.8.8.8", "8.8.4.4"]
          searches    = ["gitea.svc.cluster.local", "svc.cluster.local", "cluster.local"]
        }

        # Also add hostAliases for internal services since we're not using cluster DNS
        host_aliases {
          ip        = "10.43.85.76"  # gitea service IP
          hostnames = ["gitea.gitea.svc.cluster.local"]
        }

        # Docker-in-Docker sidecar for running container-based actions
        container {
          name  = "dind"
          image = "docker:24-dind"

          security_context {
            privileged = true
          }

          env {
            name  = "DOCKER_TLS_CERTDIR"
            value = ""
          }

          volume_mount {
            name       = "docker-data"
            mount_path = "/var/lib/docker"
          }

          resources {
            requests = {
              memory = "1Gi"
              cpu    = "500m"
            }
            limits = {
              # Allow up to 10Gi for dind: 8Gi tmpfs + 2Gi for daemon overhead
              memory = "10Gi"
              cpu    = "3000m"
            }
          }
        }

        container {
          name  = "runner"
          image = "gitea/act_runner:latest"

          env {
            name  = "GITEA_INSTANCE_URL"
            value = "http://gitea.${kubernetes_namespace.gitea.metadata[0].name}.svc.cluster.local:3000"
          }

          env {
            name = "GITEA_RUNNER_REGISTRATION_TOKEN"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.gitea_runner.metadata[0].name
                key  = "GITEA_RUNNER_REGISTRATION_TOKEN"
              }
            }
          }

          env {
            name  = "GITEA_RUNNER_NAME"
            value = "k3s-runner"
          }

          env {
            name  = "GITEA_RUNNER_LABELS"
            value = "ubuntu-latest:docker://node:20,ubuntu-22.04:docker://node:20"
          }

          env {
            name  = "DOCKER_HOST"
            value = "tcp://localhost:2375"
          }

          env {
            name  = "CONFIG_FILE"
            value = "/config/config.yaml"
          }

          volume_mount {
            name       = "runner-config"
            mount_path = "/config"
            read_only  = true
          }

          volume_mount {
            name       = "runner-cache"
            mount_path = "/cache"
          }

          resources {
            requests = {
              memory = "128Mi"
              cpu    = "100m"
            }
            limits = {
              memory = "512Mi"
              cpu    = "1000m"
            }
          }
        }

        volume {
          name = "runner-cache"
          host_path {
            path = "/var/lib/gitea-runner-cache"
            type = "DirectoryOrCreate"
          }
        }

        volume {
          name = "docker-data"
          # Use tmpfs (RAM) for Docker storage - fast in-memory builds
          # k3s VM has 16GB RAM, allocating 8GB for Docker cache
          # Note: Cache is lost on pod restart, but builds are much faster
          empty_dir {
            medium     = "Memory"
            size_limit = "8Gi"
          }
        }

        volume {
          name = "runner-config"
          config_map {
            name = kubernetes_config_map.gitea_runner_config.metadata[0].name
          }
        }
      }
    }
  }
}

# ===========================================================================
# Admin User Setup Job
# ===========================================================================

resource "kubernetes_secret" "gitea_admin" {
  metadata {
    name      = "gitea-admin"
    namespace = kubernetes_namespace.gitea.metadata[0].name
  }

  data = {
    username = var.gitea_admin_user
    email    = var.gitea_admin_email
    password = var.gitea_admin_password
  }
}

resource "kubernetes_job" "gitea_admin_setup" {
  metadata {
    name      = "gitea-admin-setup"
    namespace = kubernetes_namespace.gitea.metadata[0].name
  }

  spec {
    ttl_seconds_after_finished = 300

    template {
      metadata {
        labels = {
          app = "gitea-admin-setup"
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
          name  = "create-admin"
          image = "gitea/gitea:1.21-rootless"

          command = ["/bin/sh", "-c"]
          args = [
            <<-EOT
              export GITEA_WORK_DIR=/data
              export GITEA_CUSTOM=/data/gitea

              # Initialize database if needed (runs migrations)
              echo "Running database migrations..."
              gitea migrate --config /data/gitea/conf/app.ini || true

              # Check if admin user already exists
              if gitea admin user list --config /data/gitea/conf/app.ini 2>/dev/null | grep -q "$GITEA_ADMIN_USER"; then
                echo "Admin user already exists, skipping creation"
                exit 0
              fi

              # Create admin user
              echo "Creating admin user..."
              gitea admin user create \
                --config /data/gitea/conf/app.ini \
                --username "$GITEA_ADMIN_USER" \
                --password "$GITEA_ADMIN_PASSWORD" \
                --email "$GITEA_ADMIN_EMAIL" \
                --admin \
                --must-change-password=false

              if [ $? -eq 0 ]; then
                echo "Admin user created successfully!"
              else
                echo "Failed to create admin user"
                exit 1
              fi
            EOT
          ]

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
            name = "GITEA_ADMIN_EMAIL"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.gitea_admin.metadata[0].name
                key  = "email"
              }
            }
          }

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

  depends_on = [kubernetes_deployment.gitea]
}

# ===========================================================================
# Repository Setup Job
# ===========================================================================

resource "kubernetes_job" "gitea_repo_setup" {
  metadata {
    name      = "gitea-repo-setup"
    namespace = kubernetes_namespace.gitea.metadata[0].name
  }

  spec {
    ttl_seconds_after_finished = 600

    template {
      metadata {
        labels = {
          app = "gitea-repo-setup"
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
              # Extra wait for admin user setup to complete
              sleep 10
              echo "Gitea is ready!"
            EOT
          ]
        }

        container {
          name  = "setup-repo"
          image = "curlimages/curl:8.5.0"

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
            name  = "REPO_NAME"
            value = var.gitea_repo_name
          }

          env {
            name  = "GITHUB_REPO_URL"
            value = var.github_repo_url
          }

          env {
            name  = "GITHUB_MIRROR_TOKEN"
            value = var.github_mirror_token
          }

          command = ["/bin/sh", "-c"]
          args = [
            <<-EOT
              set -e

              GITEA_API="$GITEA_URL/api/v1"
              AUTH="$GITEA_ADMIN_USER:$GITEA_ADMIN_PASSWORD"

              echo "Checking if repo already exists..."
              REPO_EXISTS=$(curl -s -o /dev/null -w "%%{http_code}" -u "$AUTH" "$GITEA_API/repos/$GITEA_ADMIN_USER/$REPO_NAME")

              if [ "$REPO_EXISTS" = "200" ]; then
                echo "Repository already exists, skipping migration"
              else
                echo "Migrating repository from GitHub..."
                curl -s -X POST "$GITEA_API/repos/migrate" \
                  -u "$AUTH" \
                  -H "Content-Type: application/json" \
                  -d "{
                    \"clone_addr\": \"$GITHUB_REPO_URL\",
                    \"repo_name\": \"$REPO_NAME\",
                    \"mirror\": false,
                    \"private\": false,
                    \"description\": \"Migrated from GitHub\"
                  }"

                echo "Waiting for migration to complete..."
                sleep 30
              fi

              # Set up push mirror to GitHub if token provided
              if [ -n "$GITHUB_MIRROR_TOKEN" ]; then
                echo "Setting up push mirror to GitHub..."

                # Extract GitHub owner/repo from URL
                GITHUB_PUSH_URL=$(echo "$GITHUB_REPO_URL" | sed "s|https://github.com/|https://$GITHUB_MIRROR_TOKEN@github.com/|")

                curl -s -X POST "$GITEA_API/repos/$GITEA_ADMIN_USER/$REPO_NAME/push_mirrors" \
                  -u "$AUTH" \
                  -H "Content-Type: application/json" \
                  -d "{
                    \"remote_address\": \"$GITHUB_PUSH_URL\",
                    \"interval\": \"8h0m0s\",
                    \"sync_on_commit\": true
                  }" || echo "Push mirror may already exist"
              fi

              echo "Repository setup complete!"
            EOT
          ]
        }
      }
    }
  }

  depends_on = [kubernetes_job.gitea_admin_setup]
}

# ===========================================================================
# Outputs
# ===========================================================================

output "gitea_url" {
  description = "URL to access Gitea"
  value       = "https://git.dev.${var.app_domain}"
}

output "registry_url" {
  description = "Local Docker registry URL (cluster-internal)"
  value       = "registry.${kubernetes_namespace.gitea.metadata[0].name}.svc.cluster.local:5000"
}
