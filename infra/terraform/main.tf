provider "kubernetes" {
  config_path = pathexpand(var.kubeconfig_path)
}

provider "helm" {
  kubernetes {
    config_path = pathexpand(var.kubeconfig_path)
  }
}

provider "google" {
  project = var.gcp_project
}

provider "stripe" {
  api_key = var.stripe_secret_key
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
