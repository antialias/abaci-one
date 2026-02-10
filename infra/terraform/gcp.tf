# Google Cloud project and OAuth configuration for abaci.one
#
# Creates a dedicated GCP project for authentication services
# (Google OAuth sign-in for the app).

resource "google_project" "abaci" {
  name            = "Abaci One"
  project_id      = var.gcp_project
  billing_account = var.gcp_billing_account
}

# Enable the APIs needed for OAuth
resource "google_project_service" "iap" {
  project = google_project.abaci.project_id
  service = "iap.googleapis.com"

  disable_on_destroy = false
}
