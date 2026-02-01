# ArgoCD - GitOps Continuous Delivery
#
# ArgoCD watches a Git repo for Kubernetes manifests and syncs them to the cluster.
# Unlike Keel (which just updates images), ArgoCD provides:
# - PreSync hooks for running migrations before deployments
# - Full GitOps workflow
# - Rollback capabilities
# - Sync status visibility
#
# Phase 1: Install ArgoCD (parallel to Keel for testing)
# Phase 2: Create Application manifests in infra/k8s/
# Phase 3: Test manual syncs
# Phase 4: Enable auto-sync + image updater
# Phase 5: Disable Keel

resource "kubernetes_namespace" "argocd" {
  metadata {
    name = "argocd"
  }
}

resource "helm_release" "argocd" {
  name             = "argocd"
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  version          = "5.55.0" # Latest stable as of Jan 2025
  namespace        = kubernetes_namespace.argocd.metadata[0].name
  create_namespace = false

  # Server configuration
  set {
    name  = "server.service.type"
    value = "ClusterIP"
  }

  # Disable dex (SSO) - we'll use admin password for now
  set {
    name  = "dex.enabled"
    value = "false"
  }

  # Resource limits for resource-constrained environments
  set {
    name  = "controller.resources.requests.cpu"
    value = "100m"
  }

  set {
    name  = "controller.resources.requests.memory"
    value = "256Mi"
  }

  set {
    name  = "controller.resources.limits.cpu"
    value = "500m"
  }

  set {
    name  = "controller.resources.limits.memory"
    value = "512Mi"
  }

  set {
    name  = "server.resources.requests.cpu"
    value = "50m"
  }

  set {
    name  = "server.resources.requests.memory"
    value = "64Mi"
  }

  set {
    name  = "server.resources.limits.cpu"
    value = "200m"
  }

  set {
    name  = "server.resources.limits.memory"
    value = "256Mi"
  }

  set {
    name  = "repoServer.resources.requests.cpu"
    value = "50m"
  }

  set {
    name  = "repoServer.resources.requests.memory"
    value = "64Mi"
  }

  set {
    name  = "repoServer.resources.limits.cpu"
    value = "200m"
  }

  set {
    name  = "repoServer.resources.limits.memory"
    value = "256Mi"
  }

  # Redis (built-in) resources
  set {
    name  = "redis.resources.requests.cpu"
    value = "25m"
  }

  set {
    name  = "redis.resources.requests.memory"
    value = "32Mi"
  }

  set {
    name  = "redis.resources.limits.cpu"
    value = "100m"
  }

  set {
    name  = "redis.resources.limits.memory"
    value = "64Mi"
  }

  depends_on = [kubernetes_namespace.argocd]
}

# Ingress for ArgoCD UI (optional - can use port-forward instead)
resource "kubernetes_ingress_v1" "argocd" {
  count = var.argocd_domain != "" ? 1 : 0

  metadata {
    name      = "argocd-server"
    namespace = kubernetes_namespace.argocd.metadata[0].name
    annotations = {
      "cert-manager.io/cluster-issuer"                   = var.use_staging_certs ? "letsencrypt-staging" : "letsencrypt-prod"
      "traefik.ingress.kubernetes.io/router.entrypoints" = "websecure"
      # ArgoCD server handles TLS termination, but we're doing it at ingress
      "traefik.ingress.kubernetes.io/router.tls" = "true"
    }
  }

  spec {
    ingress_class_name = "traefik"

    tls {
      hosts       = [var.argocd_domain]
      secret_name = "argocd-tls"
    }

    rule {
      host = var.argocd_domain

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = "argocd-server"
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }

  depends_on = [helm_release.argocd]
}

# ArgoCD Application for abaci-app
# Manual sync initially - enable automated sync after testing
#
# NOTE: This resource requires ArgoCD CRDs to exist first.
# Apply ArgoCD first, then this Application:
#   terraform apply -target=helm_release.argocd
#   terraform apply
#
# Or use a time_sleep to ensure CRDs are ready:
resource "time_sleep" "wait_for_argocd_crds" {
  depends_on      = [helm_release.argocd]
  create_duration = "30s"
}

resource "kubernetes_manifest" "argocd_app" {
  manifest = {
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "Application"
    metadata = {
      name      = "abaci-app"
      namespace = kubernetes_namespace.argocd.metadata[0].name
    }
    spec = {
      project = "default"
      source = {
        repoURL        = "https://github.com/antialias/abaci-one"
        targetRevision = "main"
        path           = "infra/k8s/abaci-app"
      }
      destination = {
        server    = "https://kubernetes.default.svc"
        namespace = "abaci"
      }
      # Manual sync only - no auto-sync until we're confident
      # To enable auto-sync later, uncomment:
      # syncPolicy = {
      #   automated = {
      #     prune    = true
      #     selfHeal = true
      #   }
      # }
    }
  }

  depends_on = [time_sleep.wait_for_argocd_crds]
}

# Output the initial admin password retrieval command
output "argocd_admin_password_command" {
  value       = "kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d"
  description = "Command to retrieve ArgoCD admin password"
}

output "argocd_port_forward_command" {
  value       = "kubectl port-forward svc/argocd-server -n argocd 8080:443"
  description = "Command to port-forward ArgoCD UI (access at https://localhost:8080)"
}
