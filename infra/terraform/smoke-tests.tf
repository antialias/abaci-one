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
    # Daily at 08:00 in the node's time zone, Central (14:00 UTC in winter).
    schedule = "0 8 * * *"
    # Tonight's run replaces any run still going, so a stuck run never holds
    # up the nights after it. With Forbid, a run whose pod waited for CPU held
    # the Job open for 16 days in November 2026 and every night was skipped.
    # A good run takes 3-4 minutes; the schedule is the only limit, and
    # KubeJobNotCompleted reports a run still going after 12 hours.
    concurrency_policy            = "Replace"
    successful_jobs_history_limit = 3
    failed_jobs_history_limit     = 3

    job_template {
      metadata {
        labels = {
          app = "smoke-tests"
        }
      }

      spec {
        # No second run of the whole suite: Playwright already retries each
        # failing test twice (the image sets CI=true), so by the time the
        # runner exits non-zero the failure is real, and KubeJobFailed says so.
        backoff_limit = 0

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
                # Test against prod HTTPS so cookies (__Host- prefix) and TLS work
                # exactly like a real user. This also tests ingress and DNS.
                name  = "BASE_URL"
                value = "https://abaci.one"
              }

              env {
                # Report results via internal service (no auth needed, avoids ingress)
                name  = "RESULTS_API_URL"
                value = "http://abaci-app.${kubernetes_namespace.abaci.metadata[0].name}.svc.cluster.local/api/smoke-test-results"
              }

              env {
                # Directory to save HTML reports (on shared PVC)
                name  = "REPORT_DIR"
                value = "/artifacts/smoke-reports"
              }

              env {
                # Push run-result metrics to the Prometheus Pushgateway as a
                # single series (job="smoke-tests", app="abaci-app"), instead of
                # relying on per-pod in-memory gauges on abaci-app. See
                # monitoring.tf (kubernetes_deployment.pushgateway).
                name  = "PUSHGATEWAY_URL"
                value = "http://${kubernetes_service.pushgateway.metadata[0].name}.${kubernetes_service.pushgateway.metadata[0].namespace}.svc.cluster.local:9091"
              }

              env {
                # auth.setup.ts signs the admin session with prod's AUTH_SECRET
                # and, since #261, reads it only from this variable. It comes
                # from the app's own secret by reference, so a rotation
                # reaches the next run. The secret is named, not referenced as
                # kubernetes_secret.app_env, so a -target apply of this CronJob
                # never pulls the app's secret into the plan.
                name = "E2E_PROD_AUTH_SECRET"
                value_from {
                  secret_key_ref {
                    name = "app-env"
                    key  = "AUTH_SECRET"
                  }
                }
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
