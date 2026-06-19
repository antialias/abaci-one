# Cable Modem Monitoring (Motorola MB8611)
#
# Scrapes DOCSIS signal stats from the MB8611 cable modem via an off-cluster
# exporter on the NAS (`modem-exporter` container, host-networked), exposing
# Prometheus metrics at http://192.168.86.51:9110/metrics.
#
# Motivation: the download path silently collapsed (~5 Mbps) when most
# downstream channels dropped out of the bonding group while upload stayed
# healthy — a partial-lock state the modem won't self-heal without a reboot.
# This gives early warning (channels locked, SNR, codeword errors) so we can
# see a recurrence coming instead of waiting for someone to notice slowness.
#
# Same off-cluster pattern as dns-probe-monitor.tf:
#   - Service (no selector) + Endpoints pinned to the NAS exporter
#   - ServiceMonitor so Prometheus scrapes it
#   - PrometheusRule alerts (channels dropped / exporter down / low SNR)
#   - Grafana dashboard ConfigMap (auto-imported by the Grafana sidecar)

locals {
  modem_exporter_ip   = "192.168.86.51" # NAS LAN address
  modem_exporter_port = 9110
}

# Headless Service with no selector — the target lives outside the cluster,
# so the Endpoints object below supplies its address manually.
resource "kubernetes_service" "modem_exporter" {
  metadata {
    name      = "modem-exporter"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      app = "modem-exporter"
    }
  }

  spec {
    cluster_ip = "None"

    port {
      name        = "metrics"
      port        = local.modem_exporter_port
      target_port = local.modem_exporter_port
      protocol    = "TCP"
    }
  }
}

# Manual Endpoints pointing the Service at the NAS exporter.
resource "kubernetes_endpoints" "modem_exporter" {
  metadata {
    name      = "modem-exporter"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  subset {
    address {
      ip = local.modem_exporter_ip
    }
    port {
      name     = "metrics"
      port     = local.modem_exporter_port
      protocol = "TCP"
    }
  }
}

# ServiceMonitor — created via kubectl because kubernetes_manifest validates
# CRDs at plan time, but the ServiceMonitor CRD only exists after
# kube-prometheus-stack is installed (same pattern as dns-exporter).
resource "null_resource" "modem_exporter_service_monitor" {
  depends_on = [
    helm_release.kube_prometheus_stack,
    kubernetes_service.modem_exporter,
    kubernetes_endpoints.modem_exporter,
  ]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}

      kubectl wait --for=condition=Established crd/servicemonitors.monitoring.coreos.com --timeout=120s

      cat <<EOF | kubectl apply -f -
      apiVersion: monitoring.coreos.com/v1
      kind: ServiceMonitor
      metadata:
        name: modem-exporter
        namespace: ${kubernetes_namespace.monitoring.metadata[0].name}
        labels:
          app: modem-exporter
      spec:
        selector:
          matchLabels:
            app: modem-exporter
        endpoints:
        - port: metrics
          path: /metrics
          interval: 1m
          scrapeTimeout: 30s
      EOF
    EOT
  }

  triggers = {
    config = "v1-${local.modem_exporter_ip}:${local.modem_exporter_port}"
  }
}

# PrometheusRule — high-signal alerts only (kept deliberately minimal to avoid
# the alert-noise that got the old skill-health check deleted). The remediation
# controller on the NAS is the primary notifier; these back it up.
resource "null_resource" "modem_alerts" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}

      kubectl wait --for=condition=Established crd/prometheusrules.monitoring.coreos.com --timeout=120s

      cat <<EOF | kubectl apply -f -
      apiVersion: monitoring.coreos.com/v1
      kind: PrometheusRule
      metadata:
        name: modem-alerts
        namespace: ${kubernetes_namespace.monitoring.metadata[0].name}
        labels:
          app: kube-prometheus-stack
          release: kube-prometheus-stack
      spec:
        groups:
        - name: modem
          rules:
          - alert: ModemDownstreamChannelsDropped
            expr: modem_downstream_channels_locked < 30
            for: 5m
            labels:
              severity: warning
            annotations:
              summary: "Cable modem lost downstream channels"
              description: "Only {{ \$value }} downstream channels locked (baseline ~34). Partial-lock state — download throughput is likely degraded; a modem reboot usually re-locks them."
          - alert: ModemDownstreamChannelsCollapsed
            expr: modem_downstream_channels_locked < 16
            for: 3m
            labels:
              severity: critical
            annotations:
              summary: "Cable modem downstream bonding collapsed"
              description: "Only {{ \$value }} downstream channels locked. Download is severely degraded."
          - alert: ModemExporterDown
            expr: up{job="modem-exporter"} == 0 or modem_up == 0
            for: 10m
            labels:
              severity: warning
            annotations:
              summary: "modem-exporter on the NAS is not scrapeable"
              description: "Prometheus cannot read modem stats from ${local.modem_exporter_ip}:${local.modem_exporter_port} (exporter down or modem login failing)."
          - alert: ModemDownstreamLowSNR
            expr: min(modem_downstream_snr_db) < 30
            for: 15m
            labels:
              severity: warning
            annotations:
              summary: "Cable modem downstream SNR is low"
              description: "Lowest downstream SNR is {{ \$value }} dB (want >33). Marginal signal — channels may start dropping."
      EOF
    EOT
  }

  triggers = {
    rule_version = "1"
  }
}

# Grafana dashboard — modem DOCSIS health.
# The Grafana sidecar auto-imports ConfigMaps labelled grafana_dashboard="1".
resource "kubernetes_config_map" "grafana_dashboard_modem" {
  metadata {
    name      = "grafana-dashboard-modem"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "modem.json" = jsonencode({
      annotations          = { list = [] }
      editable             = true
      fiscalYearStartMonth = 0
      graphTooltip         = 0
      id                   = null
      links                = []
      panels = [
        # Downstream channels locked — the headline number
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "thresholds" }
              thresholds = {
                mode = "absolute"
                steps = [
                  { color = "red", value = null },
                  { color = "yellow", value = 16 },
                  { color = "green", value = 30 }
                ]
              }
              unit = "short"
            }
          }
          gridPos = { h = 4, w = 6, x = 0, y = 0 }
          id      = 1
          options = {
            colorMode     = "background"
            graphMode     = "area"
            justifyMode   = "auto"
            orientation   = "auto"
            reduceOptions = { calcs = ["lastNotNull"], fields = "", values = false }
            textMode      = "auto"
          }
          targets = [{
            expr         = "modem_downstream_channels_locked"
            legendFormat = "DS locked"
            refId        = "A"
          }]
          title = "Downstream Channels Locked"
          type  = "stat"
        },
        # Upstream channels locked
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color      = { mode = "thresholds" }
              thresholds = { mode = "absolute", steps = [{ color = "red", value = null }, { color = "green", value = 1 }] }
              unit       = "short"
            }
          }
          gridPos = { h = 4, w = 6, x = 6, y = 0 }
          id      = 2
          options = {
            colorMode     = "background"
            graphMode     = "area"
            justifyMode   = "auto"
            orientation   = "auto"
            reduceOptions = { calcs = ["lastNotNull"], fields = "", values = false }
            textMode      = "auto"
          }
          targets = [{
            expr         = "modem_upstream_channels_locked"
            legendFormat = "US locked"
            refId        = "A"
          }]
          title = "Upstream Channels Locked"
          type  = "stat"
        },
        # Modem online
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "thresholds" }
              mappings = [{
                type = "value"
                options = {
                  "0" = { text = "DOWN", color = "red", index = 0 }
                  "1" = { text = "UP", color = "green", index = 1 }
                }
              }]
              thresholds = { mode = "absolute", steps = [{ color = "red", value = null }, { color = "green", value = 1 }] }
              unit       = "none"
            }
          }
          gridPos = { h = 4, w = 6, x = 12, y = 0 }
          id      = 3
          options = {
            colorMode     = "background"
            graphMode     = "none"
            justifyMode   = "center"
            orientation   = "auto"
            reduceOptions = { calcs = ["lastNotNull"], fields = "", values = false }
            textMode      = "value"
          }
          targets = [{
            expr         = "modem_up"
            legendFormat = "Scrape OK"
            refId        = "A"
          }]
          title = "Exporter / Modem Reachable"
          type  = "stat"
        },
        # Modem uptime
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color      = { mode = "thresholds" }
              thresholds = { mode = "absolute", steps = [{ color = "blue", value = null }] }
              unit       = "s"
            }
          }
          gridPos = { h = 4, w = 6, x = 18, y = 0 }
          id      = 4
          options = {
            colorMode     = "value"
            graphMode     = "none"
            justifyMode   = "auto"
            orientation   = "auto"
            reduceOptions = { calcs = ["lastNotNull"], fields = "", values = false }
            textMode      = "auto"
          }
          targets = [{
            expr         = "modem_uptime_seconds"
            legendFormat = "Uptime"
            refId        = "A"
          }]
          title = "Modem Uptime"
          type  = "stat"
        },
        # Downstream channels locked over time
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color  = { mode = "palette-classic" }
              custom = { drawStyle = "line", fillOpacity = 15, lineWidth = 2, showPoints = "never" }
              unit   = "short"
              min    = 0
            }
          }
          gridPos = { h = 8, w = 12, x = 0, y = 4 }
          id      = 5
          options = {
            legend  = { calcs = ["min", "lastNotNull"], displayMode = "table", placement = "bottom", showLegend = true }
            tooltip = { mode = "multi", sort = "desc" }
          }
          targets = [
            {
              expr         = "modem_downstream_channels_locked"
              legendFormat = "Downstream locked"
              refId        = "A"
            },
            {
              expr         = "modem_upstream_channels_locked"
              legendFormat = "Upstream locked"
              refId        = "B"
            }
          ]
          title = "Channels Locked Over Time"
          type  = "timeseries"
        },
        # Per-channel SNR
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color  = { mode = "continuous-GrYlRd" }
              custom = { drawStyle = "line", fillOpacity = 0, lineWidth = 1, showPoints = "never" }
              unit   = "dB"
            }
          }
          gridPos = { h = 8, w = 12, x = 12, y = 4 }
          id      = 6
          options = {
            legend  = { calcs = ["min"], displayMode = "list", placement = "bottom", showLegend = false }
            tooltip = { mode = "multi", sort = "asc" }
          }
          targets = [{
            expr         = "modem_downstream_snr_db"
            legendFormat = "ch {{channel}} ({{freq_mhz}}MHz)"
            refId        = "A"
          }]
          title = "Downstream SNR by Channel (dB)"
          type  = "timeseries"
        },
        # Per-channel power
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color  = { mode = "palette-classic" }
              custom = { drawStyle = "line", fillOpacity = 0, lineWidth = 1, showPoints = "never" }
              unit   = "dBmV"
            }
          }
          gridPos = { h = 8, w = 12, x = 0, y = 12 }
          id      = 7
          options = {
            legend  = { calcs = ["min", "max"], displayMode = "list", placement = "bottom", showLegend = false }
            tooltip = { mode = "multi", sort = "asc" }
          }
          targets = [{
            expr         = "modem_downstream_power_dbmv"
            legendFormat = "ch {{channel}} ({{freq_mhz}}MHz)"
            refId        = "A"
          }]
          title = "Downstream Power by Channel (dBmV)"
          type  = "timeseries"
        },
        # Uncorrectable codeword rate per channel
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color  = { mode = "palette-classic" }
              custom = { drawStyle = "line", fillOpacity = 10, lineWidth = 1, showPoints = "never" }
              unit   = "cps"
              min    = 0
            }
          }
          gridPos = { h = 8, w = 12, x = 12, y = 12 }
          id      = 8
          options = {
            legend  = { calcs = ["max"], displayMode = "table", placement = "bottom", showLegend = true }
            tooltip = { mode = "multi", sort = "desc" }
          }
          targets = [{
            expr         = "rate(modem_downstream_uncorrected_total[5m])"
            legendFormat = "ch {{channel}}"
            refId        = "A"
          }]
          title = "Uncorrectable Codewords / sec by Channel"
          type  = "timeseries"
        }
      ]
      refresh       = "30s"
      schemaVersion = 39
      tags          = ["modem", "docsis", "infrastructure", "haunt-house"]
      templating    = { list = [] }
      time          = { from = "now-6h", to = "now" }
      timepicker    = {}
      timezone      = "browser"
      title         = "Cable Modem — DOCSIS Health"
      uid           = "modem-docsis"
      version       = 1
    })
  }

  depends_on = [helm_release.kube_prometheus_stack]
}
