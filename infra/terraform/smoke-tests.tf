# Smoke Tests CronJob
#
# Runs Playwright smoke tests every 15 minutes and reports results to the app API.
# Results are exposed via /api/smoke-test-status for Gatus monitoring.

resource "kubernetes_cron_job_v1" "smoke_tests" {
  metadata {
    name      = "smoke-tests"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    labels = {
      app = "smoke-tests"
    }
  }

  spec {
    schedule                      = "*/15 * * * *" # Every 15 minutes
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
              image             = "ghcr.io/antialias/soroban-abacus-flashcards-smoke-tests:latest"
              image_pull_policy = "Always"

              env {
                # Test against the app service (load balances across all pods)
                name  = "BASE_URL"
                value = "http://abaci-app.${kubernetes_namespace.abaci.metadata[0].name}.svc.cluster.local"
              }

              env {
                # Report results to the primary pod (requires write access to DB)
                name  = "RESULTS_API_URL"
                value = "http://abaci-app-primary.${kubernetes_namespace.abaci.metadata[0].name}.svc.cluster.local/api/smoke-test-results"
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
            }

            # Chromium needs shared memory for rendering
            volume {
              name = "dshm"
              empty_dir {
                medium     = "Memory"
                size_limit = "256Mi"
              }
            }

            restart_policy = "Never"
          }
        }
      }
    }
  }
}
