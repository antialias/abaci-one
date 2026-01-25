# Gatus - Self-hosted Status Page
#
# Lightweight status page that monitors endpoints and displays uptime.
# Accessible at status.abaci.one

resource "kubernetes_config_map" "gatus_config" {
  metadata {
    name      = "gatus-config"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  data = {
    "config.yaml" = <<-EOT
      storage:
        type: sqlite
        path: /data/gatus.db

      ui:
        title: Abaci.one Status
        description: Service health and uptime monitoring
        header: Abaci.one
        logo: ""

      endpoints:
        # ============ Website ============
        - name: "Homepage"
          group: Website
          url: "https://abaci.one/"
          interval: 60s
          conditions:
            - "[STATUS] == 200"
            - "[RESPONSE_TIME] < 2000"

        # ============ Arcade ============
        - name: "Games Hub — /games"
          group: Arcade
          url: "https://abaci.one/games"
          interval: 120s
          client:
            timeout: 30s
          conditions:
            - "[STATUS] == 200"

        # ============ Worksheets ============
        - name: "Worksheet Builder — /create/worksheets"
          group: Worksheets
          url: "https://abaci.one/create/worksheets"
          interval: 120s
          client:
            timeout: 30s
          conditions:
            - "[STATUS] == 200"

        - name: "Flashcard Generator — /create/flashcards"
          group: Worksheets
          url: "https://abaci.one/create/flashcards"
          interval: 120s
          client:
            timeout: 30s
          conditions:
            - "[STATUS] == 200"

        # ============ Flowcharts ============
        - name: "Flowchart Viewer — /flowchart"
          group: Flowcharts
          url: "https://abaci.one/flowchart"
          interval: 120s
          client:
            timeout: 30s
          conditions:
            - "[STATUS] == 200"

        # ============ Core API ============
        - name: "Health Check — /api/health"
          group: Core API
          url: "https://abaci.one/api/health"
          interval: 30s
          conditions:
            - "[STATUS] == 200"
            - "[RESPONSE_TIME] < 500"
            - "[BODY].status == healthy"

        # ============ Infrastructure ============
        - name: "SQLite Database"
          group: Infrastructure
          url: "https://abaci.one/api/health"
          interval: 30s
          conditions:
            - "[STATUS] == 200"
            - "[BODY].checks.database.status == ok"

        - name: "Redis Cache"
          group: Infrastructure
          url: "tcp://redis.abaci.svc.cluster.local:6379"
          interval: 30s
          conditions:
            - "[CONNECTED] == true"

        # ============ E2E Tests ============
        - name: "Browser Smoke Tests"
          group: E2E Tests
          url: "https://abaci.one/api/smoke-test-status"
          interval: 60s
          conditions:
            - "[STATUS] == 200"
            - "[BODY].status == passed"
    EOT
  }
}

# Note: Using emptyDir for simplicity. Gatus rebuilds history on restart.
# If persistent history is needed, use a PVC but terraform may timeout
# waiting for local-path provisioner (which only binds when pod mounts).

resource "kubernetes_deployment" "gatus" {
  metadata {
    name      = "gatus"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    labels = {
      app = "gatus"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "gatus"
      }
    }

    template {
      metadata {
        labels = {
          app = "gatus"
        }
      }

      spec {
        container {
          name  = "gatus"
          image = "twinproduction/gatus:v5.11.0"

          port {
            container_port = 8080
          }

          volume_mount {
            name       = "config"
            mount_path = "/config"
            read_only  = true
          }

          volume_mount {
            name       = "data"
            mount_path = "/data"
          }

          resources {
            requests = {
              memory = "64Mi"
              cpu    = "50m"
            }
            limits = {
              memory = "128Mi"
              cpu    = "200m"
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 8080
            }
            initial_delay_seconds = 10
            period_seconds        = 30
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 8080
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.gatus_config.metadata[0].name
          }
        }

        volume {
          name = "data"
          empty_dir {}
        }
      }
    }
  }
}

resource "kubernetes_service" "gatus" {
  metadata {
    name      = "gatus"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  spec {
    selector = {
      app = "gatus"
    }

    port {
      port        = 80
      target_port = 8080
    }

    type = "ClusterIP"
  }
}

# Ingress for status.abaci.one (HTTP only for now, SSL can be added later)
# Note: ACME HTTP-01 challenge has issues with Traefik ingress routing.
# Consider DNS-01 challenge or using the main domain's wildcard cert.
resource "kubernetes_ingress_v1" "gatus" {
  metadata {
    name      = "gatus"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    annotations = {
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web,websecure"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = "status.${var.app_domain}"

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.gatus.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }
}
