# libSQL Server - distributed SQLite database server
#
# Architecture:
# - Single libSQL server pod that all app pods connect to
# - Handles concurrent writes from multiple app pods
# - Replaces LiteFS complexity with simple client-server model
#
# Connection URL format:
# - Dev: file:./data/sqlite.db (local file, no server)
# - Prod: http://libsql.abaci.svc.cluster.local:8080

# Persistent volume for libSQL data
resource "kubernetes_persistent_volume_claim" "libsql_data" {
  metadata {
    name      = "libsql-data"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = "local-path"

    resources {
      requests = {
        storage = "10Gi"
      }
    }
  }
}

# libSQL server deployment
resource "kubernetes_deployment" "libsql" {
  metadata {
    name      = "libsql"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    labels = {
      app = "libsql"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "libsql"
      }
    }

    strategy {
      type = "Recreate" # Single instance, no rolling update
    }

    template {
      metadata {
        labels = {
          app = "libsql"
        }
      }

      spec {
        container {
          name  = "libsql"
          image = "ghcr.io/tursodatabase/libsql-server:latest"

          port {
            name           = "http"
            container_port = 8080
          }

          env {
            name  = "SQLD_NODE"
            value = "primary"
          }

          env {
            name  = "SQLD_DB_PATH"
            value = "sqlite.db"
          }

          env {
            name  = "SQLD_HTTP_LISTEN_ADDR"
            value = "0.0.0.0:8080"
          }

          resources {
            requests = {
              memory = "256Mi"
              cpu    = "100m"
            }
            limits = {
              memory = "1Gi"
              cpu    = "1000m"
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 8080
            }
            initial_delay_seconds = 10
            period_seconds        = 15
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 8080
            }
            initial_delay_seconds = 5
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          volume_mount {
            name       = "libsql-data"
            mount_path = "/var/lib/sqld"
          }
        }

        volume {
          name = "libsql-data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.libsql_data.metadata[0].name
          }
        }
      }
    }
  }
}

# Service for libSQL - internal cluster access only
resource "kubernetes_service" "libsql" {
  metadata {
    name      = "libsql"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    labels = {
      app = "libsql"
    }
  }

  spec {
    selector = {
      app = "libsql"
    }

    port {
      name        = "http"
      port        = 8080
      target_port = 8080
    }

    type = "ClusterIP"
  }
}
