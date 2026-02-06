# Smoke Tests CronJob
#
# Runs Playwright smoke tests daily at 2 AM Central and reports results to the app API.
# Results are exposed via /api/smoke-test-status for Gatus monitoring.
# HTML reports are saved to the dev-artifacts PVC for viewing at dev.abaci.one/smoke-reports/

resource "kubernetes_cron_job_v1" "smoke_tests" {
  metadata {
    name      = "smoke-tests"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    labels = {
      app = "smoke-tests"
    }
  }

  spec {
    schedule                      = "0 8 * * *" # Daily at 2:00 AM Central (UTC-6 = 08:00 UTC)
    concurrency_policy            = "Forbid"       # Don't run if previous job still running
    successful_jobs_history_limit = 3
    failed_jobs_history_limit     = 3

    job_template {
      metadata {
        labels = {
          app = "smoke-tests"
        }
      }

      spec {
        # Retry once on failure
        backoff_limit = 1

        # Clean up completed/failed jobs after 1 hour
        ttl_seconds_after_finished = 3600

        template {
          metadata {
            labels = {
              app = "smoke-tests"
            }
          }

          spec {
            # Use the GHCR registry secret for pulling the image
            dynamic "image_pull_secrets" {
              for_each = var.ghcr_token != "" ? [1] : []
              content {
                name = kubernetes_secret.ghcr_registry[0].metadata[0].name
              }
            }

            container {
              name              = "playwright"
              image             = "ghcr.io/antialias/abaci-one-smoke-tests:latest"
              image_pull_policy = "Always"

              env {
                # Test against the app service (load balances across all pods)
                name  = "BASE_URL"
                value = "http://abaci-app.${kubernetes_namespace.abaci.metadata[0].name}.svc.cluster.local"
              }

              env {
                # Report results to the app service (any pod can write via libSQL)
                name  = "RESULTS_API_URL"
                value = "http://abaci-app.${kubernetes_namespace.abaci.metadata[0].name}.svc.cluster.local/api/smoke-test-results"
              }

              env {
                # Directory to save HTML reports (on shared PVC)
                name  = "REPORT_DIR"
                value = "/artifacts/smoke-reports"
              }

              resources {
                requests = {
                  memory = "512Mi"
                  cpu    = "200m"
                }
                limits = {
                  memory = "1Gi"
                  cpu    = "1000m"
                }
              }

              # Playwright with Chromium needs /dev/shm for shared memory
              volume_mount {
                name       = "dshm"
                mount_path = "/dev/shm"
              }

              # Mount dev-artifacts PVC for saving HTML reports
              volume_mount {
                name       = "artifacts"
                mount_path = "/artifacts"
              }
            }

            # Chromium needs shared memory for rendering
            volume {
              name = "dshm"
              empty_dir {
                medium     = "Memory"
                size_limit = "256Mi"
              }
            }

            # Shared storage for artifacts (HTML reports)
            volume {
              name = "artifacts"
              persistent_volume_claim {
                claim_name = kubernetes_persistent_volume_claim.dev_artifacts.metadata[0].name
              }
            }

            restart_policy = "Never"
          }
        }
      }
    }
  }
}
