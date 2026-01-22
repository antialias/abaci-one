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

variable "app_domain" {
  description = "Domain name for the application"
  type        = string
  default     = "abaci.one"
}

variable "app_image" {
  description = "Docker image for the application"
  type        = string
  default     = "ghcr.io/antialias/soroban-abacus-flashcards:latest"
}

variable "app_replicas" {
  description = "Number of app replicas"
  type        = number
  default     = 2
}

variable "letsencrypt_email" {
  description = "Email for Let's Encrypt certificate notifications"
  type        = string
}

variable "use_staging_certs" {
  description = "Use Let's Encrypt staging (for testing, avoids rate limits)"
  type        = bool
  default     = false
}

variable "auth_secret" {
  description = "Secret key for NextAuth.js session encryption"
  type        = string
  sensitive   = true
}

variable "nfs_server" {
  description = "NFS server IP address (NAS)"
  type        = string
  default     = "192.168.86.51"
}
