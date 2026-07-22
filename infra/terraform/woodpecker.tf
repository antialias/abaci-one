# Woodpecker CI — Container-native CI/CD with Gitea integration
#
# Replaces Gitea Actions (act_runner) which has unreliable log storage (dbfs bug).
# Woodpecker has its own log storage, dedicated UI, and native Gitea OAuth.
#
# Architecture:
# - Server: Web UI + API + webhook handler + SQLite DB
# - Agent: Pulls work from server via gRPC, executes steps in Docker containers
#
# Ticket: weather-display#239

# ===========================================================================
# Variables
# ===========================================================================

variable "woodpecker_gitea_client" {
  description = "Gitea OAuth2 client ID for Woodpecker"
  type        = string
  sensitive   = true
}

variable "woodpecker_gitea_secret" {
  description = "Gitea OAuth2 client secret for Woodpecker"
  type        = string
  sensitive   = true
}

# ===========================================================================
# Shared secret for server <-> agent gRPC communication
# ===========================================================================

resource "random_password" "woodpecker_agent_secret" {
  length  = 64
  special = false
}

# ===========================================================================
# Storage — NFS-backed PV for Woodpecker SQLite DB
# ===========================================================================

resource "kubernetes_persistent_volume" "woodpecker" {
  metadata {
    name = "woodpecker-pv"
    labels = {
      type = "nfs"
      app  = "woodpecker"
    }
  }

  spec {
    capacity = {
      storage = "5Gi"
    }
    access_modes                     = ["ReadWriteMany"]
    persistent_volume_reclaim_policy = "Retain"
    storage_class_name               = "nfs"

    persistent_volume_source {
      nfs {
        server = var.nfs_server
        path   = "/volume1/homes/antialias/projects/abaci.one/data/woodpecker"
      }
    }
  }
}

resource "kubernetes_persistent_volume_claim" "woodpecker" {
  metadata {
    name      = "woodpecker"
    namespace = kubernetes_namespace.gitea.metadata[0].name
  }

  spec {
    access_modes       = ["ReadWriteMany"]
    storage_class_name = "nfs"

    resources {
      requests = {
        storage = "5Gi"
      }
    }

    selector {
      match_labels = {
        type = "nfs"
        app  = "woodpecker"
      }
    }
  }
}

# ===========================================================================
# Woodpecker Server
# ===========================================================================

resource "kubernetes_deployment" "woodpecker_server" {
  metadata {
    name      = "woodpecker-server"
    namespace = kubernetes_namespace.gitea.metadata[0].name
    labels = {
      app = "woodpecker-server"
    }
  }

  spec {
    replicas = 1

    strategy {
      type = "Recreate" # SQLite requires exclusive access
    }

    selector {
      match_labels = {
        app = "woodpecker-server"
      }
    }

    template {
      metadata {
        labels = {
          app = "woodpecker-server"
        }
      }

      spec {
        # Ensure NFS-mounted dirs are writable
        security_context {
          fs_group = 1000
        }

        init_container {
          name  = "init-data"
          image = "busybox:1.36"

          command = ["/bin/sh", "-c"]
          args    = ["mkdir -p /data/woodpecker && chmod 777 /data/woodpecker"]

          volume_mount {
            name       = "data"
            mount_path = "/data"
          }
        }

        container {
          name  = "server"
          image = "woodpeckerci/woodpecker-server:v3.14.0-rc.0"

          port {
            container_port = 8000
            name           = "http"
          }

          port {
            container_port = 9000
            name           = "grpc"
          }

          env {
            name  = "WOODPECKER_HOST"
            value = "https://ci.dev.${var.app_domain}"
          }

          env {
            name  = "WOODPECKER_GITEA"
            value = "true"
          }

          env {
            name  = "WOODPECKER_GITEA_URL"
            value = "http://gitea.${kubernetes_namespace.gitea.metadata[0].name}.svc.cluster.local:3000"
          }

          # Keep browser OAuth redirects on the public Gitea hostname while the
          # server talks to Gitea through the in-cluster service URL above.
          env {
            name  = "WOODPECKER_EXPERT_FORGE_OAUTH_HOST"
            value = "https://git.dev.${var.app_domain}"
          }

          # Codified from live 2026-07-20 (was a hand-applied kubectl edit):
          # without this, clones of public repos go unauthenticated and pipeline
          # steps that hit Gitea anonymously get rate-limited/denied.
          env {
            name  = "WOODPECKER_AUTHENTICATE_PUBLIC_REPOS"
            value = "true"
          }

          env {
            name  = "WOODPECKER_GITEA_CLIENT"
            value = var.woodpecker_gitea_client
          }

          env {
            name  = "WOODPECKER_GITEA_SECRET"
            value = var.woodpecker_gitea_secret
          }

          env {
            name  = "WOODPECKER_AGENT_SECRET"
            value = random_password.woodpecker_agent_secret.result
          }

          env {
            name  = "WOODPECKER_DATABASE_DRIVER"
            value = "sqlite3"
          }

          env {
            name  = "WOODPECKER_DATABASE_DATASOURCE"
            value = "/data/woodpecker/woodpecker.sqlite"
          }

          # Allow webhooks from Gitea running in the same cluster
          env {
            name  = "WOODPECKER_WEBHOOK_HOST"
            value = "http://woodpecker-server.${kubernetes_namespace.gitea.metadata[0].name}.svc.cluster.local:8000"
          }

          # Admin user (your Gitea username)
          env {
            name  = "WOODPECKER_ADMIN"
            value = "antialias"
          }

          env {
            name  = "WOODPECKER_PLUGINS_PRIVILEGED"
            value = "woodpeckerci/plugin-docker-buildx"
          }

          env {
            name  = "WOODPECKER_LOG_LEVEL"
            value = "info"
          }

          volume_mount {
            name       = "data"
            mount_path = "/data"
          }

          liveness_probe {
            http_get {
              path = "/healthz"
              port = 8000
            }
            initial_delay_seconds = 10
            period_seconds        = 30
          }
        }

        volume {
          name = "data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.woodpecker.metadata[0].name
          }
        }
      }
    }
  }
}

# ===========================================================================
# Woodpecker Server Service
# ===========================================================================

resource "kubernetes_service" "woodpecker_server" {
  metadata {
    name      = "woodpecker-server"
    namespace = kubernetes_namespace.gitea.metadata[0].name
  }

  spec {
    selector = {
      app = "woodpecker-server"
    }

    port {
      name        = "http"
      port        = 8000
      target_port = 8000
    }

    port {
      name        = "grpc"
      port        = 9000
      target_port = 9000
    }

    type = "ClusterIP"
  }
}

# ===========================================================================
# Woodpecker Server gRPC — LAN NodePort for out-of-cluster agents
# ===========================================================================
# CI VM migration (platform#1 / platform#5): agents are moving off the k3s VM
# onto the dedicated ci-node VM, which reaches the server over the LAN instead
# of cluster DNS. Additive service — in-cluster agents keep using the ClusterIP
# service above; this exposes ONLY the gRPC port on 192.168.86.37:30900.
# Trust model unchanged: plaintext gRPC + shared WOODPECKER_AGENT_SECRET,
# LAN-only (no ingress/port-forward publishes 30900 externally).
# Contract recorded in platform repo CONTRACTS.md.

resource "kubernetes_service" "woodpecker_server_grpc_lan" {
  metadata {
    name      = "woodpecker-server-grpc-lan"
    namespace = kubernetes_namespace.gitea.metadata[0].name
  }

  spec {
    selector = {
      app = "woodpecker-server"
    }

    port {
      name        = "grpc"
      port        = 9000
      target_port = 9000
      node_port   = 30900
    }

    type = "NodePort"
  }
}

# ===========================================================================
# Woodpecker Agents — RETIRED (platform#7, 2026-07-21)
# ===========================================================================
# The in-cluster agent Deployments (woodpecker_agent + woodpecker_agent_packages)
# were removed when CI moved to the dedicated ci-node VM. Agents now live in the
# platform repo's Ansible (ansible/playbooks/ci-node.yml) and reach the server
# over the LAN gRPC NodePort above (192.168.86.37:30900). The Jul-18 cpuset
# stopgap (WOODPECKER_BACKEND_DOCKER_LIMIT_CPU_SET) went with them — isolation is
# now VMM CPU priority, not cgroup pinning. See platform CONTRACTS.md (CI).

# ===========================================================================
# Ingress — HTTPS via Traefik + cert-manager
# ===========================================================================

resource "kubernetes_ingress_v1" "woodpecker" {
  metadata {
    name      = "woodpecker"
    namespace = kubernetes_namespace.gitea.metadata[0].name

    annotations = {
      "cert-manager.io/cluster-issuer"                   = var.use_staging_certs ? "letsencrypt-staging" : "letsencrypt-prod"
      "traefik.ingress.kubernetes.io/router.entrypoints" = "websecure"
    }
  }

  spec {
    ingress_class_name = "traefik"

    tls {
      hosts       = ["ci.dev.${var.app_domain}"]
      secret_name = "woodpecker-tls"
    }

    rule {
      host = "ci.dev.${var.app_domain}"

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.woodpecker_server.metadata[0].name

              port {
                number = 8000
              }
            }
          }
        }
      }
    }
  }
}

# HTTP → HTTPS redirect
resource "kubernetes_ingress_v1" "woodpecker_redirect" {
  metadata {
    name      = "woodpecker-redirect"
    namespace = kubernetes_namespace.gitea.metadata[0].name

    annotations = {
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web"
      "traefik.ingress.kubernetes.io/router.middlewares" = "abaci-redirect-https@kubernetescrd"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = "ci.dev.${var.app_domain}"

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.woodpecker_server.metadata[0].name

              port {
                number = 8000
              }
            }
          }
        }
      }
    }
  }
}
