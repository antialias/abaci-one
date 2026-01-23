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
    AUTH_SECRET        = var.auth_secret
    LLM_OPENAI_API_KEY = var.openai_api_key
  }
}

resource "kubernetes_config_map" "app_config" {
  metadata {
    name      = "app-config"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  data = {
    NODE_ENV = "production"
    PORT     = "3000"
    # Note: Don't set HOSTNAME here - it conflicts with LiteFS which needs the pod hostname
    # Next.js will use 0.0.0.0 by default if HOSTNAME is not set
    NEXT_TELEMETRY_DISABLED = "1"
    REDIS_URL               = "redis://redis:6379"
    # LiteFS mounts the database at /litefs
    DATABASE_URL = "/litefs/sqlite.db"
    # Trust the proxy for Auth.js
    AUTH_TRUST_HOST = "true"
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

# Service targeting ONLY the primary pod (pod-0) for write requests
# LiteFS proxy on replicas returns fly-replay header which k8s doesn't understand,
# so we route POST/PUT/DELETE directly to the primary
resource "kubernetes_service" "app_primary" {
  metadata {
    name      = "abaci-app-primary"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  spec {
    selector = {
      app                                  = "abaci-app"
      "statefulset.kubernetes.io/pod-name" = "abaci-app-0"
    }

    port {
      port        = 80
      target_port = 8080
    }

    type = "ClusterIP"
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
        # Keel annotations for automatic image updates
        # When a new :latest image is pushed, Keel triggers a rolling update
        annotations = {
          "keel.sh/policy"       = "force"     # Update even for same tags (:latest)
          "keel.sh/trigger"      = "poll"      # Use registry polling
          "keel.sh/pollSchedule" = "@every 2m" # Check every 2 minutes
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
          # Generate runtime config and start litefs
          command = ["/bin/sh", "-c"]
          args = [<<-EOT
            export LITEFS_CANDIDATE=$(cat /config/litefs-candidate)
            echo "Starting LiteFS with LITEFS_CANDIDATE=$LITEFS_CANDIDATE HOSTNAME=$HOSTNAME"

            # Generate litefs config at runtime
            # Use abaci-app-0 as the well-known primary hostname for all nodes
            PRIMARY_HOSTNAME="abaci-app-0"
            PRIMARY_URL="http://abaci-app-0.abaci-app-headless.abaci.svc.cluster.local:20202"

            cat > /tmp/litefs.yml << LITEFS_CONFIG
            fuse:
              dir: "/litefs"
            data:
              dir: "/var/lib/litefs"
            lease:
              type: "static"
              # Primary hostname - all nodes use the same value to identify the primary
              hostname: "$PRIMARY_HOSTNAME"
              advertise-url: "$PRIMARY_URL"
              candidate: $LITEFS_CANDIDATE
            proxy:
              addr: ":8080"
              target: "localhost:3000"
              db: "sqlite.db"
              passthrough:
                - "*.ico"
                - "*.png"
                - "*.jpg"
                - "*.jpeg"
                - "*.gif"
                - "*.svg"
                - "*.css"
                - "*.js"
                - "*.woff"
                - "*.woff2"
            exec:
              - cmd: "node dist/db/migrate.js"
                if-candidate: true
              - cmd: "node server.js"
            LITEFS_CONFIG

            exec litefs mount -config /tmp/litefs.yml
          EOT
          ]

          # Run as root for FUSE mount (app runs as non-root via litefs exec)
          security_context {
            run_as_user  = 0
            run_as_group = 0
            privileged   = true # Required for FUSE
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
              memory = "512Mi"
              cpu    = "200m"
            }
            limits = {
              memory = "1Gi"
              cpu    = "2000m"
            }
          }

          # Health checks hit the LiteFS proxy
          # Tuned for resilience under load: longer timeouts, more failures allowed
          liveness_probe {
            http_get {
              path = "/api/health"
              port = 8080
            }
            initial_delay_seconds = 30
            period_seconds        = 15
            timeout_seconds       = 10
            failure_threshold     = 5
          }

          readiness_probe {
            http_get {
              path = "/api/health"
              port = 8080
            }
            initial_delay_seconds = 5
            period_seconds        = 10
            timeout_seconds       = 10
            failure_threshold     = 5
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

          volume_mount {
            name       = "vision-training-data"
            mount_path = "/app/apps/web/data/vision-training"
          }

          volume_mount {
            name       = "uploads-data"
            mount_path = "/app/apps/web/data/uploads"
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
      target_port = 8080 # LiteFS proxy port
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
      "cert-manager.io/cluster-issuer"                   = var.use_staging_certs ? "letsencrypt-staging" : "letsencrypt-prod"
      "traefik.ingress.kubernetes.io/router.entrypoints" = "websecure"
      "traefik.ingress.kubernetes.io/router.middlewares" = "${kubernetes_namespace.abaci.metadata[0].name}-hsts@kubernetescrd,${kubernetes_namespace.abaci.metadata[0].name}-rate-limit@kubernetescrd,${kubernetes_namespace.abaci.metadata[0].name}-in-flight-req@kubernetescrd"
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

# IngressRoute for write requests (POST/PUT/DELETE/PATCH) - route to primary only
# LiteFS proxy on replicas can't handle writes without Fly.io's fly-replay infrastructure
resource "kubernetes_manifest" "app_writes_ingressroute" {
  manifest = {
    apiVersion = "traefik.io/v1alpha1"
    kind       = "IngressRoute"
    metadata = {
      name      = "abaci-app-writes"
      namespace = kubernetes_namespace.abaci.metadata[0].name
    }
    spec = {
      entryPoints = ["websecure"]
      routes = [
        {
          match = "Host(`${var.app_domain}`) && (Method(`POST`) || Method(`PUT`) || Method(`DELETE`) || Method(`PATCH`))"
          kind  = "Rule"
          priority = 100  # Higher priority than default ingress
          middlewares = [
            {
              name      = "hsts"
              namespace = kubernetes_namespace.abaci.metadata[0].name
            },
            {
              name      = "rate-limit"
              namespace = kubernetes_namespace.abaci.metadata[0].name
            }
          ]
          services = [
            {
              name = kubernetes_service.app_primary.metadata[0].name
              port = 80
            }
          ]
        }
      ]
      tls = {
        secretName = "abaci-tls"
      }
    }
  }
}
