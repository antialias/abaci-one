# Keel - Kubernetes Image Update Automation
#
# Keel watches container registries and automatically updates deployments
# when new images are pushed. This is the k8s equivalent of Watchtower.
#
# How it works:
# 1. Keel polls ghcr.io for new versions of the :latest tag
# 2. When a new digest is detected, Keel triggers a rolling update
# 3. No manual `kubectl rollout restart` needed after pushing to main

resource "helm_release" "keel" {
  name             = "keel"
  repository       = "https://charts.keel.sh"
  chart            = "keel"
  version          = "1.0.3"
  namespace        = kubernetes_namespace.keel.metadata[0].name
  create_namespace = false

  # Basic webhook configuration (optional, for GitHub webhooks)
  set {
    name  = "webhookRelay.enabled"
    value = "false"
  }

  # Enable polling (required since we're not using webhooks)
  set {
    name  = "polling.enabled"
    value = "true"
  }

  # Poll interval (5 minutes)
  set {
    name  = "polling.interval"
    value = "300"
  }

  # Basic auth disabled (internal use only)
  set {
    name  = "basicauth.enabled"
    value = "false"
  }

  # Helm provider (watches Helm releases)
  set {
    name  = "helmProvider.enabled"
    value = "false"
  }

  # Watch all namespaces (not just the keel namespace)
  set {
    name  = "watchAllNamespaces"
    value = "true"
  }

  # Resource limits
  set {
    name  = "resources.requests.cpu"
    value = "50m"
  }

  set {
    name  = "resources.requests.memory"
    value = "64Mi"
  }

  set {
    name  = "resources.limits.cpu"
    value = "200m"
  }

  set {
    name  = "resources.limits.memory"
    value = "128Mi"
  }

  depends_on = [kubernetes_namespace.keel]
}

# Dedicated namespace for Keel
resource "kubernetes_namespace" "keel" {
  metadata {
    name = "keel"
  }
}

# Note: The app StatefulSet needs these annotations on its METADATA (not pod template):
#
#   metadata {
#     annotations = {
#       "keel.sh/policy"       = "force"    # Update even for same tags
#       "keel.sh/trigger"      = "poll"     # Use polling (not webhooks)
#       "keel.sh/pollSchedule" = "@every 2m" # Poll every 2 minutes
#     }
#   }
#
# IMPORTANT: Annotations must be on the StatefulSet/Deployment metadata,
# NOT on spec.template.metadata (pod template). Keel reads workload-level
# annotations to determine which resources to watch.
#
# For private registries, Keel reads imagePullSecrets from the workload spec
# to authenticate when polling. The ghcr_token variable in app.tf enables this.
