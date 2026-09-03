# =============================================================================
# Claude Code context/compaction metrics (cc-metrics)
# =============================================================================
# Scrape + dashboard for the cc-metrics collector (home-infra repo,
# services/cc-metrics): Claude Code hooks on the owner's Mac parse the session
# transcript and ship events to the collector on the NAS (192.168.86.51:9119),
# which exposes cc_* series — context composition (fixed prefix vs tool results
# vs prompts …), compaction frequency/drivers, token kinds per call, labelled by
# arm (claude-switch-proxy vs direct) for A/B comparison.
#
#   1. Scrape    — headless Service + manual Endpoints + ServiceMonitor
#                  (job="cc-metrics"), same off-cluster idiom as claude-usage.
#   2. Dashboards — files/cc-metrics-dashboard.json (uid cc-metrics, everyday view)
#                  and files/cc-metrics-ab-dashboard.json (uid cc-ab, the proxy-vs-
#                  direct A/B view over paired scripted sessions), both in ONE
#                  ConfigMap, picked up by the kube-prometheus-stack sidecar via
#                  grafana_dashboard="1". Generated, never hand-edited:
#                  home-infra services/cc-metrics/dashboard/gen_dashboard.py [main|ab].
#
# No alert rules on purpose: alerting is parked until the platform#13 rebuild.
#
# Same null_resource + idempotent-kubectl idiom as claude-usage-monitor.tf.
# Apply with kubectl (the local-exec commands below), NOT `terraform apply` —
# this working copy is usually mid-work.

resource "null_resource" "cc_metrics_scrape" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl wait --for=condition=Established crd/servicemonitors.monitoring.coreos.com --timeout=120s
      kubectl apply -f ${path.module}/files/cc-metrics-scrape.yaml
    EOT
  }

  triggers = {
    manifest = filemd5("${path.module}/files/cc-metrics-scrape.yaml")
  }
}

# Grafana picks this up via the kube-prometheus-stack sidecar (grafana_dashboard="1").
resource "null_resource" "grafana_dashboard_cc_metrics" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl -n monitoring create configmap grafana-dashboard-cc-metrics \
        --from-file=cc-metrics.json=${path.module}/files/cc-metrics-dashboard.json \
        --from-file=cc-metrics-ab.json=${path.module}/files/cc-metrics-ab-dashboard.json \
        --dry-run=client -o yaml \
        | kubectl label --local -f - grafana_dashboard=1 -o yaml \
        | kubectl apply -f -
    EOT
  }

  triggers = {
    dashboard    = filemd5("${path.module}/files/cc-metrics-dashboard.json")
    dashboard_ab = filemd5("${path.module}/files/cc-metrics-ab-dashboard.json")
  }
}
