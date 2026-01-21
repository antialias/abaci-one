# Main application deployment with LiteFS for distributed SQLite
#
# Architecture:
# - StatefulSet for stable pod identities (abaci-app-0, abaci-app-1, etc.)
# - Pod-0 is always the primary (handles writes)
# - Other pods are replicas (receive replicated data, forward writes to primary)
# - Headless service for pod-to-pod DNS resolution
# - LiteFS handles SQLite replication transparently

resource "kubernetes_secret" "app_env" {
  metadata {
    name      = "app-env"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  data = {
    AUTH_SECRET = var.auth_secret
  }
}

resource "kubernetes_config_map" "app_config" {
  metadata {
    name      = "app-config"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  data = {
    NODE_ENV                = "production"
    PORT                    = "3000"
    # Note: Don't set HOSTNAME here - it conflicts with LiteFS which needs the pod hostname
    # Next.js will use 0.0.0.0 by default if HOSTNAME is not set
    NEXT_TELEMETRY_DISABLED = "1"
    REDIS_URL               = "redis://redis:6379"
    # LiteFS mounts the database at /litefs
    DATABASE_URL            = "/litefs/sqlite.db"
  }
}

# Headless service for StatefulSet pod-to-pod communication
resource "kubernetes_service" "app_headless" {
  metadata {
    name      = "abaci-app-headless"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  spec {
    selector = {
      app = "abaci-app"
    }

    # Headless service - no cluster IP
    cluster_ip = "None"

    port {
      name        = "litefs"
      port        = 20202
      target_port = 20202
    }

    port {
      name        = "proxy"
      port        = 8080
      target_port = 8080
    }
  }
}

# StatefulSet for stable pod identities (required for LiteFS primary election)
resource "kubernetes_stateful_set" "app" {
  metadata {
    name      = "abaci-app"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    labels = {
      app = "abaci-app"
    }
  }

  spec {
    service_name = kubernetes_service.app_headless.metadata[0].name
    replicas     = var.app_replicas

    selector {
      match_labels = {
        app = "abaci-app"
      }
    }

    # Parallel pod management for faster scaling
    pod_management_policy = "Parallel"

    # Rolling update strategy
    update_strategy {
      type = "RollingUpdate"
    }

    template {
      metadata {
        labels = {
          app = "abaci-app"
        }
      }

      spec {
        # LiteFS requires root for FUSE mount
        # The app itself runs as non-root via litefs exec
        security_context {
          fs_group = 1001
        }

        # Init container to determine if this pod is the primary candidate
        init_container {
          name  = "init-litefs-candidate"
          image = "busybox:1.36"

          command = ["/bin/sh", "-c"]
          args = [<<-EOT
            # Extract pod ordinal from hostname (e.g., abaci-app-0 -> 0)
            ORDINAL=$(echo $HOSTNAME | rev | cut -d'-' -f1 | rev)
            # Pod-0 is the primary candidate
            if [ "$ORDINAL" = "0" ]; then
              echo "true" > /config/litefs-candidate
            else
              echo "false" > /config/litefs-candidate
            fi
            echo "Pod $HOSTNAME: LITEFS_CANDIDATE=$(cat /config/litefs-candidate)"
          EOT
          ]

          volume_mount {
            name       = "config"
            mount_path = "/config"
          }
        }

        container {
          name  = "app"
          image = var.app_image

          # Override to use LiteFS
          command = ["/bin/sh", "-c"]
          args = [<<-EOT
            export LITEFS_CANDIDATE=$(cat /config/litefs-candidate)
            exec litefs mount
          EOT
          ]

          # Run as root for FUSE mount (app runs as non-root via litefs exec)
          security_context {
            run_as_user  = 0
            run_as_group = 0
            privileged   = true  # Required for FUSE
          }

          port {
            name           = "proxy"
            container_port = 8080
          }

          port {
            name           = "app"
            container_port = 3000
          }

          port {
            name           = "litefs"
            container_port = 20202
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.app_config.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.app_env.metadata[0].name
            }
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

          # Health checks hit the LiteFS proxy
          liveness_probe {
            http_get {
              path = "/api/health"
              port = 8080
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/api/health"
              port = 8080
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }

          volume_mount {
            name       = "litefs-data"
            mount_path = "/var/lib/litefs"
          }

          volume_mount {
            name       = "litefs-fuse"
            mount_path = "/litefs"
            # mount_propagation is needed for FUSE
          }

          volume_mount {
            name       = "config"
            mount_path = "/config"
          }
        }

        volume {
          name = "litefs-fuse"
          empty_dir {}
        }

        volume {
          name = "config"
          empty_dir {}
        }
      }
    }

    # Persistent volume for LiteFS data (transaction files)
    volume_claim_template {
      metadata {
        name = "litefs-data"
      }

      spec {
        access_modes       = ["ReadWriteOnce"]
        storage_class_name = "local-path"

        resources {
          requests = {
            storage = "5Gi"
          }
        }
      }
    }
  }

  depends_on = [kubernetes_deployment.redis]
}

# Main service for external access (load balances across all pods)
resource "kubernetes_service" "app" {
  metadata {
    name      = "abaci-app"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  spec {
    selector = {
      app = "abaci-app"
    }

    port {
      port        = 80
      target_port = 8080  # LiteFS proxy port
    }

    type = "ClusterIP"
  }
}

# Ingress with SSL via cert-manager
resource "kubernetes_ingress_v1" "app" {
  metadata {
    name      = "abaci-app"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    annotations = {
      "cert-manager.io/cluster-issuer"                       = var.use_staging_certs ? "letsencrypt-staging" : "letsencrypt-prod"
      "traefik.ingress.kubernetes.io/router.entrypoints"     = "websecure"
      "traefik.ingress.kubernetes.io/router.middlewares"     = "${kubernetes_namespace.abaci.metadata[0].name}-hsts@kubernetescrd"
    }
  }

  spec {
    ingress_class_name = "traefik"

    tls {
      hosts       = [var.app_domain]
      secret_name = "abaci-tls"
    }

    rule {
      host = var.app_domain

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.app.metadata[0].name
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

# HSTS middleware
resource "kubernetes_manifest" "hsts_middleware" {
  manifest = {
    apiVersion = "traefik.io/v1alpha1"
    kind       = "Middleware"
    metadata = {
      name      = "hsts"
      namespace = kubernetes_namespace.abaci.metadata[0].name
    }
    spec = {
      headers = {
        stsSeconds           = 63072000
        stsIncludeSubdomains = true
        stsPreload           = true
      }
    }
  }
}

# HTTP to HTTPS redirect
resource "kubernetes_ingress_v1" "app_http_redirect" {
  metadata {
    name      = "abaci-app-http-redirect"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    annotations = {
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web"
      "traefik.ingress.kubernetes.io/router.middlewares" = "${kubernetes_namespace.abaci.metadata[0].name}-redirect-https@kubernetescrd"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = var.app_domain

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.app.metadata[0].name
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

# Redirect middleware
resource "kubernetes_manifest" "redirect_https_middleware" {
  manifest = {
    apiVersion = "traefik.io/v1alpha1"
    kind       = "Middleware"
    metadata = {
      name      = "redirect-https"
      namespace = kubernetes_namespace.abaci.metadata[0].name
    }
    spec = {
      redirectScheme = {
        scheme    = "https"
        permanent = true
      }
    }
  }
}
