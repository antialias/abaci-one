# =============================================================================
# OpenClaw Gateway monitoring — hauntbot failure visibility
# =============================================================================
# Codifies the scrape of OpenClaw's native diagnostics metrics. The gateway runs
# on the NAS at 192.168.86.51:18789 (compose project openclaw-deploy; image built
# from the openclaw-image repo), so this is the same off-cluster idiom as
# dns-probe-monitor.tf / claude-usage-monitor.tf: headless Service + manual
# Endpoints + ServiceMonitor, job="openclaw-gateway".
#
# WHY: home-infra epic #99 ("a broken bot must be able to say it's broken"). The
# 2026-08-30 outage was invisible to every existing signal — the Docker
# healthcheck and the HTTP monitor both reported green throughout, because they
# only prove the HTTP server is listening, not that a message produces a reply.
# OpenClaw's official `diagnostics-prometheus` plugin exports the contract that
# actually matters:
#
#   openclaw_message_received_total{channel,source}
#   openclaw_message_processed_total{channel,outcome,reason}
#   openclaw_message_dispatch_completed_total{channel,outcome,reason,source}
#   openclaw_message_delivery_started_total{channel,delivery_kind}
#   openclaw_model_call_total{provider,outcome,error_category,transport,api}
#   openclaw_model_failover_total{from_provider,to_provider,reason,lane}
#   openclaw_run_completed_total{channel,outcome,provider,trigger}
#
# received vs delivery_started IS the message-in -> reply-out contract, measured
# continuously and natively. It replaces the synthetic prober originally scoped as
# home-infra #107, and avoids the session-store bloat that OpenClaw's own
# docs/gateway/health.md warns about for polling /v1/chat/completions.
#
# SCRAPE ONLY — THERE IS DELIBERATELY NO PrometheusRule HERE.
# Alerting is under a standing moratorium (home-infra memory
# project_alerting_rebuild_parked; rebuild is platform#13): the current alert
# stack is saturated and gets torn down before new rules land. Collecting metrics
# is instrumentation and is exactly what the rebuild needs as input; adding alert
# rules is not. Do not "finish the job" by copying the claude-usage rule file here
# without that decision being made explicitly.
#
# AUTH — unlike the other off-cluster targets, this endpoint is operator-scoped.
# The bearer token lives in the `openclaw-gateway-token` Secret in the monitoring
# namespace. It is NOT in git and NOT managed by Terraform; the create/rotate
# recipe is in the header of files/openclaw-scrape.yaml. A missing Secret presents
# as a 401 on the target, not as a plugin fault.
#
# Same null_resource + idempotent-kubectl idiom as the other two monitor files
# (kubernetes_manifest is avoided — it validates CRDs at plan time, before the
# operator CRDs exist). Idempotent, so it cleanly reconciles the objects applied
# by hand on 2026-08-30 with NO terraform import step.

resource "null_resource" "openclaw_scrape" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl wait --for=condition=Established crd/servicemonitors.monitoring.coreos.com --timeout=120s
      kubectl apply -f ${path.module}/files/openclaw-scrape.yaml
    EOT
  }

  triggers = {
    manifest = filemd5("${path.module}/files/openclaw-scrape.yaml")
  }
}

# Dashboard "OpenClaw Gateway — failure visibility" (uid openclaw-gateway).
# Grafana picks this up via the kube-prometheus-stack sidecar (grafana_dashboard="1"),
# same ConfigMap idiom as claude-usage / dns-probe.
#
# STILL NO ALERT RULES. A dashboard is pure observation and is exactly what the
# platform#13 alerting rebuild needs as input; a PrometheusRule is not. Do not
# "complete the set" by copying claude-usage-rule.yaml here.
#
# The "Est. silent turns" panel is deliberately labelled approximate — a reply that
# emits both text and media counts twice in delivery_started, biasing it low. It is a
# lead into the log line, not a metric to alert on. See home-infra #100.
resource "null_resource" "grafana_dashboard_openclaw" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl -n monitoring create configmap grafana-dashboard-openclaw \
        --from-file=openclaw.json=${path.module}/files/openclaw-dashboard.json \
        --dry-run=client -o yaml \
        | kubectl label --local -f - grafana_dashboard=1 -o yaml \
        | kubectl apply -f -
    EOT
  }

  triggers = {
    dashboard = filemd5("${path.module}/files/openclaw-dashboard.json")
  }
}
