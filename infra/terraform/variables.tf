variable "kubeconfig_path" {
  description = "Path to the kubeconfig file"
  type        = string
  default     = "~/.kube/k3s-config"
}

variable "gcp_project" {
  description = "Google Cloud project ID"
  type        = string
}

variable "gcp_billing_account" {
  description = "Google Cloud billing account ID"
  type        = string
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
  default     = "ghcr.io/antialias/abaci-one:main"
}

variable "app_replicas" {
  description = "Number of app replicas"
  type        = number
  default     = 3
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

variable "openai_api_key" {
  description = "OpenAI API key for LLM features (flowchart generation, etc.)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "nfs_server" {
  description = "NFS server IP address (NAS)"
  type        = string
  default     = "192.168.86.51"
}

variable "ghcr_token" {
  description = "GitHub Personal Access Token with read:packages scope for ghcr.io registry access"
  type        = string
  sensitive   = true
  default     = ""
}

variable "ghcr_username" {
  description = "GitHub username for ghcr.io registry access"
  type        = string
  default     = "antialias"
}

variable "grafana_admin_password" {
  description = "Admin password for Grafana dashboard"
  type        = string
  sensitive   = true
}

# Gitea Configuration
variable "gitea_admin_user" {
  description = "Gitea admin username"
  type        = string
  default     = "antialias"
}

variable "gitea_admin_email" {
  description = "Gitea admin email"
  type        = string
  default     = "hallock@gmail.com"
}

variable "gitea_admin_password" {
  description = "Gitea admin password"
  type        = string
  sensitive   = true
}

variable "gitea_runner_token" {
  description = "Gitea Actions runner registration token (get from Gitea admin UI after setup)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "github_mirror_token" {
  description = "GitHub PAT for push mirroring (needs repo scope)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "gitea_repo_name" {
  description = "Repository name to create/migrate in Gitea"
  type        = string
  default     = "soroban-abacus-flashcards"
}

variable "github_repo_url" {
  description = "GitHub repo URL to migrate from"
  type        = string
  default     = "https://github.com/antialias/soroban-abacus-flashcards.git"
}

# Authentication (Google OAuth + Gmail SMTP magic links)
variable "auth_google_id" {
  description = "Google OAuth client ID (created via gcloud)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "auth_google_secret" {
  description = "Google OAuth client secret (created via gcloud)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "email_server" {
  description = "SMTP connection string for magic link emails (e.g. smtps://user:pass@smtp.gmail.com:465)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "email_from" {
  description = "From address for magic link emails"
  type        = string
  default     = "Abaci One <hallock@gmail.com>"
}

# Stripe Billing
variable "stripe_secret_key" {
  description = "Stripe secret API key (live or test)"
  type        = string
  sensitive   = true
  default     = ""
}


# Note: stripe_family_monthly_price_id, stripe_family_annual_price_id, and
# stripe_webhook_secret are managed by Terraform via stripe.tf resources.
# Only stripe_secret_key needs to be provided manually.

# ArgoCD Configuration
variable "coverage_api_token" {
  description = "Bearer token for the /api/coverage-results endpoint (used by GitHub Actions)"
  type        = string
  sensitive   = true
  default     = ""
}

# Web Push (VAPID keys)
variable "vapid_public_key" {
  description = "VAPID public key for Web Push notifications"
  type        = string
  default     = ""
}

variable "vapid_private_key" {
  description = "VAPID private key for Web Push notifications"
  type        = string
  sensitive   = true
  default     = ""
}

variable "argocd_domain" {
  description = "Domain for ArgoCD UI (leave empty to use port-forward only)"
  type        = string
  default     = ""
}
