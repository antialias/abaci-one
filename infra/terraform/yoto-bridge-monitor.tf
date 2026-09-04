# =============================================================================
# Yoto bridge monitoring — player telemetry and abaci song-sync state
# =============================================================================
# The bridge runs off-cluster on the NAS at 192.168.86.51:9117. This applies the
# standard headless Service + manual Endpoints + ServiceMonitor scrape wiring.
# Alerting remains intentionally absent while the monitoring rebuild is parked.

resource "null_resource" "yoto_bridge_scrape" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl wait --for=condition=Established crd/servicemonitors.monitoring.coreos.com --timeout=120s
      kubectl apply -f ${path.module}/files/yoto-bridge-scrape.yaml
    EOT
  }

  triggers = {
    manifest = filemd5("${path.module}/files/yoto-bridge-scrape.yaml")
  }
}

resource "null_resource" "grafana_dashboard_yoto_suzuki" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl -n monitoring create configmap grafana-dashboard-yoto-suzuki \
        --from-file=yoto-suzuki.json=${path.module}/files/yoto-suzuki-dashboard.json \
        --dry-run=client -o yaml \
        | kubectl label --local -f - grafana_dashboard=1 -o yaml \
        | kubectl apply -f -
    EOT
  }

  triggers = {
    dashboard = filemd5("${path.module}/files/yoto-suzuki-dashboard.json")
  }
}
