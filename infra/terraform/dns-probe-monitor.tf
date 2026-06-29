# =============================================================================
# DNS Probe monitoring — home router / NAS BIND DNS reliability
# =============================================================================
# Codifies + extends the dns-probe monitoring chain that was hand-applied to the
# cluster ~2026-05-22 and never version-controlled. Epic: home-infra #13
# (whole-house DNS outage on 2026-06-28 when the Google Wifi router's DNS
# forwarder wedged). Pieces:
#
#   1. Scrape  — the off-cluster NAS dns-exporter (192.168.86.51:9109) via a
#      headless Service + manual Endpoints + ServiceMonitor (job="dns-exporter").
#   2. Alerts  — the dns-probe-alerts PrometheusRule: the existing slow cold/warm
#      rules PLUS new fast dual-probe (#14) early-warning rules. All warning-tier,
#      email via Alertmanager -> Gmail. Hard-outage paging stays with Uptime Kuma
#      (home-infra #15); these cover the leading indicators Kuma can't (#16).
#   3. Dashboard — "DNS Probe — Router Reliability" (uid dns-probe), extended with
#      a fast dual-probe "pre-outage signal" panel row.
#
# All three applies use the same null_resource + kubectl idiom as
# null_resource.app_service_monitor / node_saturation_tuned_rule (kubernetes_manifest
# is avoided — it validates CRDs at plan time, before the operator CRDs exist). They
# are idempotent (kubectl apply), so they cleanly reconcile the pre-existing
# hand-applied objects with NO terraform import step (the scrape/rule/dashboard were
# all hand-applied ~2026-05-22 and are not in TF state). The dashboard is applied via
# null_resource rather than a native kubernetes_config_map specifically to avoid an
# "already exists" error / import dance against that pre-existing ConfigMap.

resource "null_resource" "dns_exporter_scrape" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl wait --for=condition=Established crd/servicemonitors.monitoring.coreos.com --timeout=120s
      kubectl apply -f ${path.module}/files/dns-probe-scrape.yaml
    EOT
  }

  triggers = {
    manifest = filemd5("${path.module}/files/dns-probe-scrape.yaml")
  }
}

resource "null_resource" "dns_probe_alerts" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl wait --for=condition=Established crd/prometheusrules.monitoring.coreos.com --timeout=120s
      kubectl apply -f ${path.module}/files/dns-probe-rule.yaml
    EOT
  }

  triggers = {
    rule = filemd5("${path.module}/files/dns-probe-rule.yaml")
  }
}

# Grafana picks this up via the kube-prometheus-stack sidecar (the
# grafana_dashboard="1" label). Applied as a ConfigMap built from the JSON file; the
# create|label|apply pipe is idempotent and keeps the label in the applied manifest
# (so a future apply never strips it).
resource "null_resource" "grafana_dashboard_dns_probe" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl -n monitoring create configmap grafana-dashboard-dns-probe \
        --from-file=dns-probe.json=${path.module}/files/dns-probe-dashboard.json \
        --dry-run=client -o yaml \
        | kubectl label --local -f - grafana_dashboard=1 -o yaml \
        | kubectl apply -f -
    EOT
  }

  triggers = {
    dashboard = filemd5("${path.module}/files/dns-probe-dashboard.json")
  }
}
