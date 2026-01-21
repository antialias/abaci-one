output "namespace" {
  description = "The namespace created for abaci workloads"
  value       = kubernetes_namespace.abaci.metadata[0].name
}

output "cluster_info" {
  description = "k3s cluster information"
  value = {
    kubeconfig = var.kubeconfig_path
    namespace  = var.namespace
  }
}
