# Dev Artifacts Server
#
# Serves static build artifacts at dev.abaci.one:
# - /smoke-reports/  - Playwright HTML reports from smoke tests
# - /storybook/      - Component library documentation
# - /coverage/       - Test coverage reports (future)
#
# Architecture:
# - NFS-backed PVC shared between artifact producers and nginx
# - nginx serves files read-only with directory listing enabled
# - Smoke tests CronJob writes reports directly to filesystem

# NFS PersistentVolume for dev artifacts
resource "kubernetes_persistent_volume" "dev_artifacts" {
  metadata {
    name = "dev-artifacts-pv"
    labels = {
      type = "nfs"
      app  = "dev-artifacts"
    }
  }

  spec {
    capacity = {
      storage = "10Gi"
    }
    access_modes                     = ["ReadWriteMany"]
    persistent_volume_reclaim_policy = "Retain"
    storage_class_name               = "nfs"

    persistent_volume_source {
      nfs {
        server = var.nfs_server
        path   = "/volume1/homes/antialias/projects/abaci.one/data/dev-artifacts"
      }
    }
  }
}

resource "kubernetes_persistent_volume_claim" "dev_artifacts" {
  metadata {
    name      = "dev-artifacts"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  spec {
    access_modes       = ["ReadWriteMany"]
    storage_class_name = "nfs"

    resources {
      requests = {
        storage = "10Gi"
      }
    }

    selector {
      match_labels = {
        type = "nfs"
        app  = "dev-artifacts"
      }
    }
  }
}

# nginx ConfigMap for custom configuration
resource "kubernetes_config_map" "dev_artifacts_nginx" {
  metadata {
    name      = "dev-artifacts-nginx"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  data = {
    "default.conf" = <<-EOT
      server {
          listen 80;
          server_name _;

          root /usr/share/nginx/html;

          # Enable directory listing
          autoindex on;
          autoindex_exact_size off;
          autoindex_localtime on;

          # Serve static files with caching
          location / {
              try_files $uri $uri/ =404;

              # Cache static assets
              location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
                  expires 1d;
                  add_header Cache-Control "public, immutable";
              }

              # HTML files - no cache for fresh reports
              location ~* \.html$ {
                  expires -1;
                  add_header Cache-Control "no-store, no-cache, must-revalidate";
              }
          }

          # Health check endpoint
          location /health {
              return 200 'ok';
              add_header Content-Type text/plain;
          }
      }
    EOT
  }
}

# nginx Deployment
resource "kubernetes_deployment" "dev_artifacts" {
  metadata {
    name      = "dev-artifacts"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    labels = {
      app = "dev-artifacts"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "dev-artifacts"
      }
    }

    template {
      metadata {
        labels = {
          app = "dev-artifacts"
        }
      }

      spec {
        container {
          name  = "nginx"
          image = "nginx:1.25-alpine"

          port {
            container_port = 80
          }

          volume_mount {
            name       = "artifacts"
            mount_path = "/usr/share/nginx/html"
            read_only  = true
          }

          volume_mount {
            name       = "nginx-config"
            mount_path = "/etc/nginx/conf.d"
            read_only  = true
          }

          resources {
            requests = {
              memory = "32Mi"
              cpu    = "10m"
            }
            limits = {
              memory = "64Mi"
              cpu    = "100m"
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 80
            }
            initial_delay_seconds = 5
            period_seconds        = 30
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 80
            }
            initial_delay_seconds = 2
            period_seconds        = 10
          }
        }

        volume {
          name = "artifacts"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.dev_artifacts.metadata[0].name
          }
        }

        volume {
          name = "nginx-config"
          config_map {
            name = kubernetes_config_map.dev_artifacts_nginx.metadata[0].name
          }
        }
      }
    }
  }
}

# Service for nginx
resource "kubernetes_service" "dev_artifacts" {
  metadata {
    name      = "dev-artifacts"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  spec {
    selector = {
      app = "dev-artifacts"
    }

    port {
      port        = 80
      target_port = 80
    }

    type = "ClusterIP"
  }
}

# Ingress for dev.abaci.one
resource "kubernetes_ingress_v1" "dev_artifacts" {
  metadata {
    name      = "dev-artifacts"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    annotations = {
      "cert-manager.io/cluster-issuer"                    = var.use_staging_certs ? "letsencrypt-staging" : "letsencrypt-prod"
      "traefik.ingress.kubernetes.io/router.entrypoints"  = "websecure"
      "traefik.ingress.kubernetes.io/router.middlewares"  = "${kubernetes_namespace.abaci.metadata[0].name}-hsts@kubernetescrd"
    }
  }

  spec {
    ingress_class_name = "traefik"

    tls {
      hosts       = ["dev.${var.app_domain}"]
      secret_name = "dev-artifacts-tls"
    }

    rule {
      host = "dev.${var.app_domain}"

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.dev_artifacts.metadata[0].name
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

# HTTP to HTTPS redirect for dev subdomain
resource "kubernetes_ingress_v1" "dev_artifacts_http_redirect" {
  metadata {
    name      = "dev-artifacts-http-redirect"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    annotations = {
      "traefik.ingress.kubernetes.io/router.entrypoints"  = "web"
      "traefik.ingress.kubernetes.io/router.middlewares"  = "${kubernetes_namespace.abaci.metadata[0].name}-redirect-https@kubernetescrd"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = "dev.${var.app_domain}"

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.dev_artifacts.metadata[0].name
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
