# =============================================================================
# Claude Code usage monitoring — subscription quota (5h/7d) across both accounts
# =============================================================================
# Codifies the claude-usage monitoring chain hand-applied to the cluster
# 2026-07-12 (meta-metrics project: track my Claude Code weekly/5h limits in high
# resolution across both accounts, alert violently near the cap, fuse into
# remediation suggestions). The exporter itself lives in the home-infra repo
# (services/claude-usage-exporter) and runs on the NAS at 192.168.86.51:9115,
# polling Anthropic's OAuth usage endpoints per account. Pieces here:
#
#   1. Scrape  — headless Service + manual Endpoints + ServiceMonitor
#      (job="claude-usage-exporter"), same off-cluster idiom as dns-exporter.
#   2. Dashboard — "Claude Code Usage — quota, burn & switchover" (uid
#      claude-usage). Generated: edit it with infra/tools/patch-claude-usage-
#      dashboard.py, never by hand (the switchover row shifts every other panel).
#   3. Alerts  — the claude-usage-alerts PrometheusRule. Delivery is NOT email:
#      each rule carries alertroute="claude-usage" so Alertmanager routes it to
#      the NAS alert-bridge (192.168.86.51:9116), which fans out per the
#      `delivery` label — delivery="critical" = HA critical iOS push (bypasses
#      DND) + Telegram, anything else = Telegram only. The webhook receiver +
#      route live in files/claude-usage-alertmanagerconfig.yaml; the alert-bridge
#      itself is in the home-infra repo (services/alert-bridge).
#
# ALERT TIERING — this is the load-bearing idea, don't undo it by accident:
# once the switch-proxy (home-infra services/claude-switch-proxy) can route
# around a hot account, "one account is at 95%" stopped being an emergency — the
# proxy just uses the other one. Paging for it is crying wolf, and a page you
# learn to ignore is worse than no page. So there is exactly ONE
# delivery="critical" rule — ClaudeAllAccountsWeeklyExhausted, "every account is
# hot, switching cannot save you". Everything else is Telegram. Aggregate rules
# (min()/count()) MUST carry a static namespace="monitoring" label or Alertmanager
# silently EMAILS them instead of paging; see the invariant note in the rule file.
# Both properties are enforced offline by infra/tools/claude-usage-rule-test.sh
# and on the live cluster by infra/tools/verify-claude-usage-alerts.sh.
#
# Same null_resource + idempotent-kubectl idiom as dns-probe-monitor.tf (avoids
# kubernetes_manifest CRD-at-plan-time issues; reconciles the pre-existing
# hand-applied objects with no import step).

resource "null_resource" "claude_usage_scrape" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl wait --for=condition=Established crd/servicemonitors.monitoring.coreos.com --timeout=120s
      kubectl apply -f ${path.module}/files/claude-usage-scrape.yaml
    EOT
  }

  triggers = {
    manifest = filemd5("${path.module}/files/claude-usage-scrape.yaml")
  }
}

resource "null_resource" "claude_usage_alerts" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl wait --for=condition=Established crd/prometheusrules.monitoring.coreos.com --timeout=120s
      kubectl apply -f ${path.module}/files/claude-usage-rule.yaml
    EOT
  }

  triggers = {
    rule = filemd5("${path.module}/files/claude-usage-rule.yaml")
  }
}

# Routes the alertroute="claude-usage" alerts to the NAS alert-bridge (Telegram +
# HA critical push) instead of email. A namespaced AlertmanagerConfig CR (selected
# by the stack's alertmanagerConfigSelector={}), so it changes routing LIVE with no
# Helm re-apply — same null_resource+kubectl idiom as the rule/scrape above.
resource "null_resource" "claude_usage_alertmanagerconfig" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl wait --for=condition=Established crd/alertmanagerconfigs.monitoring.coreos.com --timeout=120s
      kubectl apply -f ${path.module}/files/claude-usage-alertmanagerconfig.yaml
    EOT
  }

  triggers = {
    amconfig = filemd5("${path.module}/files/claude-usage-alertmanagerconfig.yaml")
  }
}

# Grafana picks this up via the kube-prometheus-stack sidecar (grafana_dashboard="1").
resource "null_resource" "grafana_dashboard_claude_usage" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl -n monitoring create configmap grafana-dashboard-claude-usage \
        --from-file=claude-usage.json=${path.module}/files/claude-usage-dashboard.json \
        --dry-run=client -o yaml \
        | kubectl label --local -f - grafana_dashboard=1 -o yaml \
        | kubectl apply -f -
    EOT
  }

  triggers = {
    dashboard = filemd5("${path.module}/files/claude-usage-dashboard.json")
  }
}
