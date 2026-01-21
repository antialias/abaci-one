provider "kubernetes" {
  config_path = pathexpand(var.kubeconfig_path)
}

provider "helm" {
  kubernetes {
    config_path = pathexpand(var.kubeconfig_path)
  }
}

# Create namespace for abaci workloads
resource "kubernetes_namespace" "abaci" {
  metadata {
    name = var.namespace

    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
    }
  }
}

# Example: Redis deployment (optional - can use this instead of Docker Redis)
# Uncomment when ready to migrate Redis to k3s
#
# resource "helm_release" "redis" {
#   name       = "redis"
#   repository = "https://charts.bitnami.com/bitnami"
#   chart      = "redis"
#   namespace  = kubernetes_namespace.abaci.metadata[0].name
#
#   set {
#     name  = "architecture"
#     value = "standalone"
#   }
#
#   set {
#     name  = "auth.enabled"
#     value = "false"
#   }
# }
