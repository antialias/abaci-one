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

variable "llm_switch_api_key" {
  description = "Client secret for the claude-switch-proxy (feeds LLM_CLAUDE_CODE_API_KEY). Deliberately its own variable — never reuse openai_api_key: the proxy secret must never reach api.openai.com, and the OpenAI key must never reach the proxy."
  type        = string
  sensitive   = true
  default     = ""
}

variable "llm_default_provider" {
  description = "Default @soroban/llm-client text/vision provider (LLM_DEFAULT_PROVIDER). \"claude_code\" runs every call as `claude -p` through the claude-switch-proxy (needs an image with the claude CLI); kill switch = set \"openai\" and apply — it answers streamed calls in one piece (\"anthropic\" would also work but no LLM_ANTHROPIC_API_KEY is wired here). Realtime voice and TTS stay on OpenAI regardless. Deliberately defaults to \"openai\", so an unrelated scoped apply can never flip the provider ahead of the code; production sets \"claude_code\" in terraform.tfvars."
  type        = string
  default     = "openai"
}

variable "llm_claude_code_base_url" {
  description = "Root URL of the claude-switch-proxy for Claude Code (LLM_CLAUDE_CODE_BASE_URL → ANTHROPIC_BASE_URL). No /v1: Claude Code appends /v1/messages itself."
  type        = string
  default     = "http://192.168.86.51:8787"
}

variable "llm_claude_code_model" {
  description = "Model or class id the claude_code provider asks the proxy for (LLM_CLAUDE_CODE_DEFAULT_MODEL), e.g. claude-sonnet-5, or claude-abaci once the brain has that class."
  type        = string
  default     = "claude-sonnet-5"
}

variable "elevenlabs_api_base_url" {
  description = "Base URL for ElevenLabs music (ELEVENLABS_API_BASE_URL). Empty = https://api.elevenlabs.io. The switch proxy's door is http://192.168.86.51:8788/elevenlabs; with it, elevenlabs_music_api_key must be the app's proxy login (base64 \"name:password\")."
  type        = string
  default     = ""
}

variable "switch_media_url" {
  description = "Base URL of the switch proxy's media door (SWITCH_MEDIA_URL). All image generation goes through its Images API, by image class."
  type        = string
  default     = "http://192.168.86.51:8788"
}

variable "switch_media_login" {
  description = "The app's switch proxy login for image generation (SWITCH_MEDIA_LOGIN), sent as a Bearer token. Empty = image generation off."
  type        = string
  sensitive   = true
  default     = ""
}

variable "elevenlabs_music_api_key" {
  description = "ElevenLabs Music API key for session song generation"
  type        = string
  sensitive   = true
  default     = ""
}

variable "kid_songs_sync_token" {
  description = "Bearer token for the NAS kid-song sync"
  type        = string
  sensitive   = true
  nullable    = false
  validation {
    condition     = length(var.kid_songs_sync_token) >= 16
    error_message = "kid_songs_sync_token must contain at least 16 characters."
  }
}

variable "kid_songs_sync_player_ids" {
  description = "Comma-separated abaci player IDs allowed for the NAS kid-song sync"
  type        = string
  sensitive   = false
  nullable    = false
  validation {
    condition = length(trimspace(var.kid_songs_sync_player_ids)) > 0 && alltrue([
      for id in split(",", var.kid_songs_sync_player_ids) : can(regex("^[A-Za-z0-9_-]{1,64}$", trimspace(id)))
    ])
    error_message = "kid_songs_sync_player_ids must be a non-empty comma-separated list of valid player IDs."
  }
}

variable "kid_songs_doorbell_url" {
  description = "LAN receiver URL for kid-song synchronization doorbells"
  type        = string
  nullable    = false
  validation {
    condition     = var.kid_songs_doorbell_url == "http://192.168.86.51:9117/v1/abaci-song-sync"
    error_message = "kid_songs_doorbell_url must be the exact LAN receiver URL."
  }
}

variable "kid_songs_doorbell_secret" {
  description = "HMAC secret shared with the NAS kid-song doorbell receiver"
  type        = string
  sensitive   = true
  nullable    = false
  validation {
    condition     = length(var.kid_songs_doorbell_secret) >= 32
    error_message = "kid_songs_doorbell_secret must contain at least 32 characters."
  }
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

# --- claude-issue-bot (answers Gitea issue-comment questions; service deployed on the NAS) ---
# See infra/terraform/claude-issue-bot.tf and the antialias/claude-issue-bot repo.

variable "claude_bot_webhook_url" {
  description = "URL the Gitea system webhook POSTs issue_comment events to (claude-issue-bot on the NAS LAN)."
  type        = string
  default     = "http://192.168.86.51:8099/webhook"
}

variable "gitea_webhook_secret" {
  description = "Shared secret for the claude-issue-bot system webhook (HMAC-SHA256 over the raw body). Must match WEBHOOK_SECRET in the NAS .env. Empty until the pilot promotes to the system webhook."
  type        = string
  sensitive   = true
  default     = ""
}

variable "enable_claude_bot_system_webhook" {
  description = "Create the instance-wide claude-issue-bot webhooks (default webhook for future repos + a per-repo hook on every existing repo). Keep false during the per-repo pilot; flip to true (with gitea_webhook_secret set) to go instance-wide."
  type        = bool
  default     = false
}

variable "claude_bot_owner_uid" {
  description = "Gitea user id whose existing repos get a per-repo claude-issue-bot issue_comment webhook. All repos live under this single user (no orgs). UID 1 = antialias."
  type        = string
  default     = "1"
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

variable "admin_emails" {
  description = "Comma-separated email list that receives bootstrap admin access"
  type        = string
  default     = "hallock@gmail.com"
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

# Print service (Abacus Studio)
variable "secret_box_key" {
  description = "AES-256-GCM key sealing print-service credentials at rest (base64, must decode to exactly 32 bytes). Codifies the key already live in the cluster — set it to that value, never a fresh one: rotation orphans every sealed credential and forces re-pairing. No default on purpose: an unset value must fail the plan, not silently wipe the key."
  type        = string
  sensitive   = true
}
