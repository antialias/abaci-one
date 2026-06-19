# Netwatch Remediation Controller monitoring
#
# Scrapes the netwatch-controller on the NAS (host-networked, :9111) — the
# self-healing watchdog that reboots the cable modem on sustained, reboot-fixable
# failure (notify-and-veto via a dedicated Telegram bot). Code lives in the
# antialias/netwatch repo (controller/); the modem exporter it reads is wired up
# by modem-monitor.tf.
#
# Same off-cluster pattern as modem-monitor.tf / dns-probe-monitor.tf:
#   - Service (no selector) + Endpoints pinned to the NAS controller
#   - ServiceMonitor so Prometheus scrapes it
#   - PrometheusRule (controller-down only — the controller is the primary
#     notifier; Kuma covers health independently)
#   - Grafana dashboard ConfigMap (auto-imported by the Grafana sidecar)

locals {
  netwatch_controller_ip   = "192.168.86.51" # NAS LAN address
  netwatch_controller_port = 9111
}

resource "kubernetes_service" "netwatch_controller" {
  metadata {
    name      = "netwatch-controller"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      app = "netwatch-controller"
    }
  }

  spec {
    cluster_ip = "None"

    port {
      name        = "metrics"
      port        = local.netwatch_controller_port
      target_port = local.netwatch_controller_port
      protocol    = "TCP"
    }
  }
}

resource "kubernetes_endpoints" "netwatch_controller" {
  metadata {
    name      = "netwatch-controller"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  subset {
    address {
      ip = local.netwatch_controller_ip
    }
    port {
      name     = "metrics"
      port     = local.netwatch_controller_port
      protocol = "TCP"
    }
  }
}

resource "null_resource" "netwatch_controller_service_monitor" {
  depends_on = [
    helm_release.kube_prometheus_stack,
    kubernetes_service.netwatch_controller,
    kubernetes_endpoints.netwatch_controller,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}

      kubectl wait --for=condition=Established crd/servicemonitors.monitoring.coreos.com --timeout=120s

      cat <<EOF | kubectl apply -f -
      apiVersion: monitoring.coreos.com/v1
      kind: ServiceMonitor
      metadata:
        name: netwatch-controller
        namespace: ${kubernetes_namespace.monitoring.metadata[0].name}
        labels:
          app: netwatch-controller
      spec:
        selector:
          matchLabels:
            app: netwatch-controller
        endpoints:
        - port: metrics
          path: /metrics
          interval: 1m
          scrapeTimeout: 30s
      EOF
    EOT
  }

  triggers = {
    config = "v1-${local.netwatch_controller_ip}:${local.netwatch_controller_port}"
  }
}

# PrometheusRule — controller liveness only. Modem signal alerts live in
# modem-monitor.tf; modem health is also pushed to Uptime Kuma independently.
resource "null_resource" "netwatch_controller_alerts" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}

      kubectl wait --for=condition=Established crd/prometheusrules.monitoring.coreos.com --timeout=120s

      cat <<EOF | kubectl apply -f -
      apiVersion: monitoring.coreos.com/v1
      kind: PrometheusRule
      metadata:
        name: netwatch-controller-alerts
        namespace: ${kubernetes_namespace.monitoring.metadata[0].name}
        labels:
          app: kube-prometheus-stack
          release: kube-prometheus-stack
      spec:
        groups:
        - name: netwatch-controller
          rules:
          - alert: NetwatchControllerDown
            expr: up{job="netwatch-controller"} == 0
            for: 10m
            labels:
              severity: warning
            annotations:
              summary: "netwatch remediation controller is not scrapeable"
              description: "Prometheus cannot reach the netwatch-controller on ${local.netwatch_controller_ip}:${local.netwatch_controller_port}. Self-healing + the Kuma heartbeat are likely down."
          - alert: NetwatchCircuitBreakerOpen
            expr: netwatch_circuit_breaker_open == 1
            for: 5m
            labels:
              severity: warning
            annotations:
              summary: "netwatch auto-reboot is paused (circuit breaker open)"
              description: "Repeated modem reboots did not restore connectivity — likely an ISP-side outage. Auto-reboot is paused; manual attention may be needed."
      EOF
    EOT
  }

  triggers = {
    rule_version = "1"
  }
}

# Grafana dashboard — remediation controller state.
resource "kubernetes_config_map" "grafana_dashboard_netwatch" {
  metadata {
    name      = "grafana-dashboard-netwatch"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "netwatch.json" = jsonencode({
      annotations          = { list = [] }
      editable             = true
      fiscalYearStartMonth = 0
      graphTooltip         = 0
      id                   = null
      links                = []
      panels = [
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color    = { mode = "thresholds" }
              mappings = [{ type = "value", options = { "0" = { text = "DEGRADED", color = "red", index = 0 }, "1" = { text = "HEALTHY", color = "green", index = 1 } } }]
              thresholds = { mode = "absolute", steps = [{ color = "red", value = null }, { color = "green", value = 1 }] }
            }
          }
          gridPos = { h = 4, w = 4, x = 0, y = 0 }
          id      = 1
          options = { colorMode = "background", graphMode = "none", justifyMode = "center", reduceOptions = { calcs = ["lastNotNull"], fields = "", values = false }, textMode = "value" }
          targets = [{ expr = "netwatch_health", refId = "A" }]
          title   = "Connectivity Health"
          type    = "stat"
        },
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color    = { mode = "thresholds" }
              mappings = [{ type = "value", options = { "0" = { text = "DRY-RUN", color = "yellow", index = 0 }, "1" = { text = "ARMED", color = "green", index = 1 } } }]
              thresholds = { mode = "absolute", steps = [{ color = "yellow", value = null }] }
            }
          }
          gridPos = { h = 4, w = 4, x = 4, y = 0 }
          id      = 2
          options = { colorMode = "background", graphMode = "none", justifyMode = "center", reduceOptions = { calcs = ["lastNotNull"], fields = "", values = false }, textMode = "value" }
          targets = [{ expr = "netwatch_reboot_enabled", refId = "A" }]
          title   = "Mode"
          type    = "stat"
        },
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color    = { mode = "thresholds" }
              mappings = [{ type = "value", options = { "0" = { text = "none", color = "green", index = 0 }, "1" = { text = "PENDING", color = "orange", index = 1 } } }]
              thresholds = { mode = "absolute", steps = [{ color = "green", value = null }, { color = "orange", value = 1 }] }
            }
          }
          gridPos = { h = 4, w = 4, x = 8, y = 0 }
          id      = 3
          options = { colorMode = "background", graphMode = "none", justifyMode = "center", reduceOptions = { calcs = ["lastNotNull"], fields = "", values = false }, textMode = "value" }
          targets = [{ expr = "netwatch_pending_reboot", refId = "A" }]
          title   = "Pending Reboot"
          type    = "stat"
        },
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color    = { mode = "thresholds" }
              mappings = [{ type = "value", options = { "0" = { text = "closed", color = "green", index = 0 }, "1" = { text = "OPEN", color = "red", index = 1 } } }]
              thresholds = { mode = "absolute", steps = [{ color = "green", value = null }, { color = "red", value = 1 }] }
            }
          }
          gridPos = { h = 4, w = 4, x = 12, y = 0 }
          id      = 4
          options = { colorMode = "background", graphMode = "none", justifyMode = "center", reduceOptions = { calcs = ["lastNotNull"], fields = "", values = false }, textMode = "value" }
          targets = [{ expr = "netwatch_circuit_breaker_open", refId = "A" }]
          title   = "Circuit Breaker"
          type    = "stat"
        },
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color      = { mode = "thresholds" }
              thresholds = { mode = "absolute", steps = [{ color = "green", value = null }, { color = "yellow", value = 1 }, { color = "red", value = 3 }] }
              unit       = "short"
            }
          }
          gridPos = { h = 4, w = 4, x = 16, y = 0 }
          id      = 5
          options = { colorMode = "background", graphMode = "area", justifyMode = "auto", reduceOptions = { calcs = ["lastNotNull"], fields = "", values = false }, textMode = "auto" }
          targets = [{ expr = "netwatch_reboots_24h", refId = "A" }]
          title   = "Reboots (24h)"
          type    = "stat"
        },
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color    = { mode = "thresholds" }
              mappings = [{ type = "value", options = { "0" = { text = "no", color = "yellow", index = 0 }, "1" = { text = "yes", color = "green", index = 1 } } }]
              thresholds = { mode = "absolute", steps = [{ color = "yellow", value = null }, { color = "green", value = 1 }] }
            }
          }
          gridPos = { h = 4, w = 4, x = 20, y = 0 }
          id      = 6
          options = { colorMode = "background", graphMode = "none", justifyMode = "center", reduceOptions = { calcs = ["lastNotNull"], fields = "", values = false }, textMode = "value" }
          targets = [{ expr = "netwatch_chat_linked", refId = "A" }]
          title   = "Telegram Linked"
          type    = "stat"
        },
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color  = { mode = "palette-classic" }
              custom = { drawStyle = "line", fillOpacity = 15, lineWidth = 2, showPoints = "never" }
              unit   = "ms"
              min    = 0
            }
          }
          gridPos = { h = 8, w = 12, x = 0, y = 4 }
          id      = 7
          options = { legend = { calcs = ["mean", "max"], displayMode = "list", placement = "bottom", showLegend = true }, tooltip = { mode = "single", sort = "none" } }
          targets = [{ expr = "netwatch_wan_latency_ms", legendFormat = "WAN probe", refId = "A" }]
          title   = "WAN Probe Latency"
          type    = "timeseries"
        },
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color  = { mode = "palette-classic" }
              custom = { drawStyle = "line", fillOpacity = 20, lineWidth = 2, showPoints = "never" }
              max    = 1
              min    = 0
              unit   = "short"
            }
          }
          gridPos = { h = 8, w = 12, x = 12, y = 4 }
          id      = 8
          options = { legend = { calcs = ["lastNotNull"], displayMode = "list", placement = "bottom", showLegend = true }, tooltip = { mode = "multi", sort = "desc" } }
          targets = [
            { expr = "netwatch_health", legendFormat = "health", refId = "A" },
            { expr = "netwatch_wan_up", legendFormat = "WAN up", refId = "B" },
            { expr = "netwatch_modem_reachable", legendFormat = "modem reachable", refId = "C" }
          ]
          title = "Health / WAN / Modem (1=ok)"
          type  = "timeseries"
        },
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color  = { mode = "palette-classic" }
              custom = { drawStyle = "line", fillOpacity = 10, lineWidth = 2, showPoints = "always" }
              unit   = "short"
              min    = 0
            }
          }
          gridPos = { h = 8, w = 12, x = 0, y = 12 }
          id      = 9
          options = { legend = { calcs = ["lastNotNull"], displayMode = "list", placement = "bottom", showLegend = true }, tooltip = { mode = "multi", sort = "desc" } }
          targets = [
            { expr = "netwatch_reboots_total", legendFormat = "real reboots", refId = "A" },
            { expr = "netwatch_dryrun_reboots_total", legendFormat = "dry-run reboots", refId = "B" }
          ]
          title = "Reboots (cumulative)"
          type  = "timeseries"
        },
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color  = { mode = "thresholds" }
              custom = { drawStyle = "line", fillOpacity = 15, lineWidth = 2, showPoints = "never", thresholdsStyle = { mode = "dashed" } }
              thresholds = { mode = "absolute", steps = [{ color = "red", value = null }, { color = "yellow", value = 16 }, { color = "green", value = 30 }] }
              unit = "short"
              min  = 0
            }
          }
          gridPos = { h = 8, w = 12, x = 12, y = 12 }
          id      = 10
          options = { legend = { calcs = ["min", "lastNotNull"], displayMode = "list", placement = "bottom", showLegend = true }, tooltip = { mode = "single", sort = "none" } }
          targets = [{ expr = "netwatch_downstream_channels_locked", legendFormat = "DS locked", refId = "A" }]
          title   = "Downstream Channels (as the controller sees them)"
          type    = "timeseries"
        }
      ]
      refresh       = "30s"
      schemaVersion = 39
      tags          = ["netwatch", "remediation", "modem", "haunt-house"]
      templating    = { list = [] }
      time          = { from = "now-24h", to = "now" }
      timepicker    = {}
      timezone      = "browser"
      title         = "Netwatch — Remediation"
      uid           = "netwatch-remediation"
      version       = 1
    })
  }

  depends_on = [helm_release.kube_prometheus_stack]
}
