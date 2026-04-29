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
          image = "woodpeckerci/woodpecker-server:v3.13.0"

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
            value = "https://git.dev.${var.app_domain}"
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
# Woodpecker Agent (Docker backend)
# ===========================================================================

resource "kubernetes_deployment" "woodpecker_agent" {
  metadata {
    name      = "woodpecker-agent"
    namespace = kubernetes_namespace.gitea.metadata[0].name
    labels = {
      app = "woodpecker-agent"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "woodpecker-agent"
      }
    }

    template {
      metadata {
        labels = {
          app = "woodpecker-agent"
        }
      }

      spec {
        container {
          name  = "agent"
          image = "woodpeckerci/woodpecker-agent:v3.13.0"

          env {
            name  = "WOODPECKER_SERVER"
            value = "woodpecker-server.${kubernetes_namespace.gitea.metadata[0].name}.svc.cluster.local:9000"
          }

          env {
            name  = "WOODPECKER_AGENT_SECRET"
            value = random_password.woodpecker_agent_secret.result
          }

          env {
            name  = "WOODPECKER_BACKEND"
            value = "docker"
          }

          env {
            name  = "WOODPECKER_MAX_WORKFLOWS"
            value = "2"
          }

          # Mount Docker socket for executing pipeline steps as containers
          volume_mount {
            name       = "docker-sock"
            mount_path = "/var/run/docker.sock"
          }
        }

        volume {
          name = "docker-sock"
          host_path {
            path = "/var/run/docker.sock"
            type = "Socket"
          }
        }
      }
    }
  }
}

# ===========================================================================
# Ingress — HTTPS via Traefik + cert-manager
# ===========================================================================

resource "kubernetes_ingress_v1" "woodpecker" {
  metadata {
    name      = "woodpecker"
    namespace = kubernetes_namespace.gitea.metadata[0].name

    annotations = {
      "cert-manager.io/cluster-issuer"                = var.use_staging_certs ? "letsencrypt-staging" : "letsencrypt-prod"
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
      "traefik.ingress.kubernetes.io/router.entrypoints"  = "web"
      "traefik.ingress.kubernetes.io/router.middlewares"   = "abaci-redirect-https@kubernetescrd"
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
