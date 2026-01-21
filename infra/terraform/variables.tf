variable "kubeconfig_path" {
  description = "Path to the kubeconfig file"
  type        = string
  default     = "~/.kube/k3s-config"
}

variable "namespace" {
  description = "Default namespace for resources"
  type        = string
  default     = "abaci"
}
