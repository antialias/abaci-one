# Main application deployment
#
# Architecture:
# - Simple Deployment (not StatefulSet) - no need for stable identities
# - All pods connect to libSQL server for database access
# - Any pod can handle any request (reads or writes)
# - Socket.IO uses sticky sessions for connection affinity

resource "kubernetes_secret" "app_env" {
  metadata {
    name      = "app-env"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  data = {
    AUTH_SECRET                     = var.auth_secret
    AUTH_GOOGLE_ID                  = var.auth_google_id
    AUTH_GOOGLE_SECRET              = var.auth_google_secret
    EMAIL_SERVER                    = var.email_server
    EMAIL_FROM                      = var.email_from
    LLM_OPENAI_API_KEY              = var.openai_api_key
    COVERAGE_API_TOKEN              = var.coverage_api_token
    STRIPE_SECRET_KEY               = var.stripe_secret_key
    STRIPE_FAMILY_MONTHLY_PRICE_ID  = local.stripe_enabled ? stripe_price.family_monthly[0].id : ""
    STRIPE_FAMILY_ANNUAL_PRICE_ID   = local.stripe_enabled ? stripe_price.family_annual[0].id : ""
    STRIPE_WEBHOOK_SECRET           = local.stripe_enabled ? stripe_webhook_endpoint.app[0].secret : ""
  }
}

# Docker registry secret for ghcr.io access
# Used by pods to pull images from ghcr.io
resource "kubernetes_secret" "ghcr_registry" {
  count = var.ghcr_token != "" ? 1 : 0

  metadata {
    name      = "ghcr-registry"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  type = "kubernetes.io/dockerconfigjson"

  data = {
    ".dockerconfigjson" = jsonencode({
      auths = {
        "ghcr.io" = {
          username = var.ghcr_username
          password = var.ghcr_token
          auth     = base64encode("${var.ghcr_username}:${var.ghcr_token}")
        }
      }
    })
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
    NEXT_TELEMETRY_DISABLED = "1"
    REDIS_URL               = "redis://redis:6379"
    # libSQL server URL - all pods connect to this
    DATABASE_URL = "http://libsql.abaci.svc.cluster.local:8080"
    # Auth.js — explicit URL so OAuth callbacks use https://
    AUTH_URL        = "https://${var.app_domain}"
    AUTH_TRUST_HOST = "true"
    # OpenTelemetry tracing configuration
    OTEL_EXPORTER_OTLP_ENDPOINT = "http://tempo.monitoring.svc.cluster.local:4317"
    OTEL_SERVICE_NAME           = "abaci-app"
  }
}

# Application Deployment
resource "kubernetes_deployment" "app" {
  metadata {
    name      = "abaci-app"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    labels = {
      app = "abaci-app"
    }
    # Argo CD manages automatic image updates via argocd-image-updater
  }

  spec {
    replicas = var.app_replicas

    selector {
      match_labels = {
        app = "abaci-app"
      }
    }

    strategy {
      type = "RollingUpdate"
      rolling_update {
        max_surge       = 1
        max_unavailable = 0
      }
    }

    template {
      metadata {
        labels = {
          app = "abaci-app"
        }
      }

      spec {
        # Image pull secret for ghcr.io
        dynamic "image_pull_secrets" {
          for_each = var.ghcr_token != "" ? [1] : []
          content {
            name = kubernetes_secret.ghcr_registry[0].metadata[0].name
          }
        }

        security_context {
          fs_group = 1001
        }

        # Init container to run migrations
        # Only one pod will successfully run migrations (libSQL handles locking)
        init_container {
          name  = "migrate"
          image = var.app_image

          command = ["node", "dist/db/migrate.js"]

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
              memory = "128Mi"
              cpu    = "100m"
            }
            limits = {
              memory = "256Mi"
              cpu    = "500m"
            }
          }
        }

        container {
          name  = "app"
          image = var.app_image

          command = ["node", "--require", "./instrumentation.js", "server.js"]

          port {
            name           = "http"
            container_port = 3000
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
              memory = "512Mi"
              cpu    = "200m"
            }
            limits = {
              memory = "1536Mi"
              cpu    = "2000m"
            }
          }

          liveness_probe {
            http_get {
              path = "/api/health"
              port = 3000
            }
            initial_delay_seconds = 30
            period_seconds        = 15
            timeout_seconds       = 10
            failure_threshold     = 5
          }

          readiness_probe {
            http_get {
              path = "/api/health"
              port = 3000
            }
            initial_delay_seconds = 5
            period_seconds        = 10
            timeout_seconds       = 10
            failure_threshold     = 5
          }

          volume_mount {
            name       = "vision-training-data"
            mount_path = "/app/apps/web/data/vision-training"
          }

          volume_mount {
            name       = "uploads-data"
            mount_path = "/app/apps/web/data/uploads"
          }

          volume_mount {
            name       = "audio-data"
            mount_path = "/app/apps/web/data/audio"
          }

          volume_mount {
            name       = "generated-images-data"
            mount_path = "/app/apps/web/data/generated-images"
          }

          volume_mount {
            name       = "dev-artifacts"
            mount_path = "/dev-artifacts"
          }
        }

        volume {
          name = "vision-training-data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.vision_training.metadata[0].name
          }
        }

        volume {
          name = "uploads-data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.uploads.metadata[0].name
          }
        }

        volume {
          name = "audio-data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.audio.metadata[0].name
          }
        }

        volume {
          name = "generated-images-data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.generated_images.metadata[0].name
          }
        }

        volume {
          name = "dev-artifacts"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.dev_artifacts.metadata[0].name
          }
        }
      }
    }
  }

  depends_on = [kubernetes_deployment.redis, kubernetes_deployment.libsql]
}

# PodDisruptionBudget ensures at least 1 pod stays available during voluntary disruptions
resource "kubernetes_pod_disruption_budget_v1" "app" {
  metadata {
    name      = "abaci-app"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  spec {
    min_available = "1"

    selector {
      match_labels = {
        app = "abaci-app"
      }
    }
  }
}

# Main service for external access (load balances across all pods)
resource "kubernetes_service" "app" {
  metadata {
    name      = "abaci-app"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    labels = {
      app = "abaci-app"
    }
  }

  spec {
    selector = {
      app = "abaci-app"
    }

    port {
      name        = "http"
      port        = 80
      target_port = 3000
    }

    type = "ClusterIP"
  }
}

# IngressRoute with sticky sessions for all traffic
# Using IngressRoute instead of standard Ingress to enable sticky sessions
# This ensures users stay on the same pod across page reloads and Socket.IO connections
resource "kubernetes_manifest" "app_ingressroute" {
  manifest = {
    apiVersion = "traefik.io/v1alpha1"
    kind       = "IngressRoute"
    metadata = {
      name      = "abaci-app"
      namespace = kubernetes_namespace.abaci.metadata[0].name
      annotations = {
        "cert-manager.io/cluster-issuer" = var.use_staging_certs ? "letsencrypt-staging" : "letsencrypt-prod"
      }
    }
    spec = {
      entryPoints = ["websecure"]
      routes = [
        {
          match = "Host(`${var.app_domain}`)"
          kind  = "Rule"
          middlewares = [
            {
              name      = "hsts"
              namespace = kubernetes_namespace.abaci.metadata[0].name
            },
            {
              name      = "rate-limit"
              namespace = kubernetes_namespace.abaci.metadata[0].name
            },
            {
              name      = "in-flight-req"
              namespace = kubernetes_namespace.abaci.metadata[0].name
            }
          ]
          services = [
            {
              name   = kubernetes_service.app.metadata[0].name
              port   = 80
              sticky = {
                cookie = {
                  name     = "abaci_sticky"
                  secure   = true
                  httpOnly = true
                  sameSite = "lax"
                }
              }
            }
          ]
        }
      ]
      tls = {
        secretName = "abaci-tls"
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

# Rate limiting middleware - protect against traffic spikes
resource "kubernetes_manifest" "rate_limit_middleware" {
  manifest = {
    apiVersion = "traefik.io/v1alpha1"
    kind       = "Middleware"
    metadata = {
      name      = "rate-limit"
      namespace = kubernetes_namespace.abaci.metadata[0].name
    }
    spec = {
      rateLimit = {
        average = 50  # 50 requests/sec average
        burst   = 100 # Allow bursts up to 100
      }
    }
  }
}

# In-flight request limiting - cap concurrent connections
resource "kubernetes_manifest" "in_flight_middleware" {
  manifest = {
    apiVersion = "traefik.io/v1alpha1"
    kind       = "Middleware"
    metadata = {
      name      = "in-flight-req"
      namespace = kubernetes_namespace.abaci.metadata[0].name
    }
    spec = {
      inFlightReq = {
        amount = 100 # Max 100 concurrent requests
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
      "traefik.ingress.kubernetes.io/router.entrypoints"  = "web"
      "traefik.ingress.kubernetes.io/router.middlewares"  = "${kubernetes_namespace.abaci.metadata[0].name}-redirect-https@kubernetescrd"
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

