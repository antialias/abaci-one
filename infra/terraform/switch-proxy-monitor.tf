# =============================================================================
# claude-switch-proxy monitoring — the routing plane's durable record
# =============================================================================
# Scrapes /_switch/metrics on the NAS proxy (192.168.86.51:8787), the same
# off-cluster idiom as openclaw-monitor.tf / claude-usage-monitor.tf /
# yoto-bridge-monitor.tf: headless Service + manual Endpoints + ServiceMonitor,
# job="switch-proxy".
#
# The proxy's health evidence lives in a bounded in-memory ring that a deploy
# restart erases, so these series are the only thing that can answer "what did
# the degraded-member classifier see overnight". Spec: home-infra-agent-
# resources/services/claude-switch-proxy/docs/degraded-failover/60-spec-v2.md
# §6.2(1).
#
# AUTH — like openclaw-gateway, this endpoint is not exempt from the proxy's
# default-deny client gate. The bearer lives in the `switch-proxy-client-secret`
# Secret in the monitoring namespace and must equal the NAS's live
# SWITCH_CLIENT_SECRET. It is NOT in git and NOT managed by Terraform; the
# create/rotate recipe is in the header of files/switch-proxy-scrape.yaml. A
# missing or stale Secret presents as a 401 on the target, not a proxy fault.
#
# SCRAPE ONLY — THERE IS DELIBERATELY NO PrometheusRule HERE. Alerting is under
# a standing moratorium (platform#13). Do not "finish the job" by adding one.
#
# Same null_resource + idempotent-kubectl idiom as the sibling monitor files
# (kubernetes_manifest is avoided — it validates CRDs at plan time, before the
# operator CRDs exist).

resource "null_resource" "switch_proxy_scrape" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl wait --for=condition=Established crd/servicemonitors.monitoring.coreos.com --timeout=120s
      kubectl apply -f ${path.module}/files/switch-proxy-scrape.yaml
    EOT
  }

  triggers = {
    manifest = filemd5("${path.module}/files/switch-proxy-scrape.yaml")
  }
}
