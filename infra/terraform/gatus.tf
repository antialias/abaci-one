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
        # Main website
        - name: Homepage
          group: Website
          url: "https://abaci.one/"
          interval: 60s
          conditions:
            - "[STATUS] == 200"
            - "[RESPONSE_TIME] < 2000"

        - name: Health API
          group: Website
          url: "https://abaci.one/api/health"
          interval: 30s
          conditions:
            - "[STATUS] == 200"
            - "[RESPONSE_TIME] < 500"
            - "[BODY].status == healthy"

        # Internal services (from within cluster)
        - name: App Service
          group: Internal
          url: "http://abaci-app.abaci.svc.cluster.local/api/health"
          interval: 30s
          conditions:
            - "[STATUS] == 200"
            - "[BODY].status == healthy"

        - name: Redis
          group: Internal
          url: "tcp://redis.abaci.svc.cluster.local:6379"
          interval: 30s
          conditions:
            - "[CONNECTED] == true"

        - name: Database (via health)
          group: Internal
          url: "http://abaci-app.abaci.svc.cluster.local/api/health"
          interval: 60s
          conditions:
            - "[STATUS] == 200"
            - "[BODY].checks.database.status == ok"
    EOT
  }
}

resource "kubernetes_persistent_volume_claim" "gatus_data" {
  metadata {
    name      = "gatus-data"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  spec {
    access_modes       = ["ReadWriteOnce"]
    storage_class_name = "local-path"

    resources {
      requests = {
        storage = "1Gi"
      }
    }
  }
}

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
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.gatus_data.metadata[0].name
          }
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

# Ingress for status.abaci.one
resource "kubernetes_ingress_v1" "gatus" {
  metadata {
    name      = "gatus"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    annotations = {
      "cert-manager.io/cluster-issuer"                   = var.use_staging_certs ? "letsencrypt-staging" : "letsencrypt-prod"
      "traefik.ingress.kubernetes.io/router.entrypoints" = "websecure"
      "traefik.ingress.kubernetes.io/router.middlewares" = "${kubernetes_namespace.abaci.metadata[0].name}-hsts@kubernetescrd"
    }
  }

  spec {
    ingress_class_name = "traefik"

    tls {
      hosts       = ["status.${var.app_domain}"]
      secret_name = "gatus-tls"
    }

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

  depends_on = [null_resource.cert_manager_issuers]
}

# HTTP to HTTPS redirect for status subdomain
resource "kubernetes_ingress_v1" "gatus_http_redirect" {
  metadata {
    name      = "gatus-http-redirect"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    annotations = {
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web"
      "traefik.ingress.kubernetes.io/router.middlewares" = "${kubernetes_namespace.abaci.metadata[0].name}-redirect-https@kubernetescrd"
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
