# Monitoring Stack - Prometheus + Grafana
#
# Deploys kube-prometheus-stack for metrics collection and visualization.
# - Grafana: grafana.dev.abaci.one (dashboards and alerting UI)
# - Prometheus: prometheus.dev.abaci.one (metrics storage and queries)
#
# Architecture:
# - Prometheus scrapes /metrics from abaci-app pods
# - Grafana provides dashboards and alerting UI
# - ServiceMonitor defines what to scrape and how often

resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = "monitoring"

    labels = {
      "app.kubernetes.io/managed-by" = "terraform"
    }
  }
}

# kube-prometheus-stack Helm release
resource "helm_release" "kube_prometheus_stack" {
  name       = "kube-prometheus-stack"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = "58.0.0"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  # Timeout for large CRD installation
  timeout = 900

  values = [yamlencode({
    prometheus = {
      prometheusSpec = {
        retention = "15d"
        storageSpec = {
          volumeClaimTemplate = {
            spec = {
              storageClassName = "local-path"
              resources = {
                requests = {
                  storage = "10Gi"
                }
              }
            }
          }
        }
        # Allow ServiceMonitors from any namespace
        serviceMonitorSelectorNilUsesHelmValues = false
        # Resource limits for small cluster
        resources = {
          requests = {
            memory = "512Mi"
            cpu    = "200m"
          }
          limits = {
            memory = "2Gi"
            cpu    = "1000m"
          }
        }
      }
    }
    grafana = {
      adminPassword = var.grafana_admin_password
      persistence = {
        enabled          = true
        size             = "2Gi"
        storageClassName = "local-path"
      }
      # Disable built-in ingress - we create our own
      ingress = {
        enabled = false
      }
      # Resource limits
      resources = {
        requests = {
          memory = "128Mi"
          cpu    = "100m"
        }
        limits = {
          memory = "512Mi"
          cpu    = "500m"
        }
      }
      # Sidecar for dashboard provisioning from ConfigMaps
      sidecar = {
        dashboards = {
          enabled = true
          label   = "grafana_dashboard"
          # Watch ConfigMaps in all namespaces
          searchNamespace = "ALL"
        }
      }
    }
    # Disable alertmanager for now (can enable later)
    alertmanager = {
      enabled = false
    }
    # Disable components not needed for single-app monitoring
    kubeStateMetrics = {
      enabled = true
    }
    nodeExporter = {
      enabled = true
    }
    # Disable some default ServiceMonitors we don't need
    kubeApiServer = {
      enabled = false
    }
    kubeControllerManager = {
      enabled = false
    }
    kubeScheduler = {
      enabled = false
    }
    kubeProxy = {
      enabled = false
    }
    kubeEtcd = {
      enabled = false
    }
  })]

  depends_on = [kubernetes_namespace.monitoring]
}

# =============================================================================
# Grafana Tempo - Distributed Tracing
# =============================================================================
# Receives traces via OTLP from instrumented applications.
# Integrates with Grafana for trace visualization.

resource "helm_release" "tempo" {
  name       = "tempo"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "tempo"
  version    = "1.7.2"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  timeout = 300

  values = [yamlencode({
    tempo = {
      # Retention period for traces
      retention = "168h" # 7 days
      # Resource limits for small cluster
      resources = {
        requests = {
          memory = "256Mi"
          cpu    = "100m"
        }
        limits = {
          memory = "512Mi"
          cpu    = "500m"
        }
      }
    }
    # Enable trace ingestion via OTLP
    traces = {
      otlp = {
        grpc = {
          enabled = true
        }
        http = {
          enabled = true
        }
      }
    }
    # Persistence for trace data
    persistence = {
      enabled          = true
      size             = "5Gi"
      storageClassName = "local-path"
    }
  })]

  depends_on = [kubernetes_namespace.monitoring]
}

# Add Tempo as a datasource in Grafana
# The kube-prometheus-stack Grafana sidecar will pick this up
resource "kubernetes_config_map" "grafana_datasource_tempo" {
  metadata {
    name      = "grafana-datasource-tempo"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_datasource = "1"
    }
  }

  data = {
    "tempo-datasource.yaml" = yamlencode({
      apiVersion = 1
      datasources = [{
        name      = "Tempo"
        type      = "tempo"
        access    = "proxy"
        url       = "http://tempo:3100"
        isDefault = false
        jsonData = {
          tracesToLogsV2 = {
            datasourceUid = "prometheus"
          }
          tracesToMetrics = {
            datasourceUid = "prometheus"
          }
          serviceMap = {
            datasourceUid = "prometheus"
          }
          nodeGraph = {
            enabled = true
          }
          lokiSearch = {
            datasourceUid = ""
          }
        }
      }]
    })
  }

  depends_on = [helm_release.tempo, helm_release.kube_prometheus_stack]
}

# Grafana Ingress with TLS (grafana.dev.abaci.one)
resource "kubernetes_ingress_v1" "grafana" {
  metadata {
    name      = "grafana"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    annotations = {
      "cert-manager.io/cluster-issuer"                   = var.use_staging_certs ? "letsencrypt-staging" : "letsencrypt-prod"
      "traefik.ingress.kubernetes.io/router.entrypoints" = "websecure"
    }
  }

  spec {
    ingress_class_name = "traefik"

    tls {
      hosts       = ["grafana.dev.${var.app_domain}"]
      secret_name = "grafana-tls"
    }

    rule {
      host = "grafana.dev.${var.app_domain}"

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = "kube-prometheus-stack-grafana"
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }

  depends_on = [helm_release.kube_prometheus_stack, null_resource.cert_manager_issuers]
}

# HTTP to HTTPS redirect for grafana subdomain
resource "kubernetes_ingress_v1" "grafana_http_redirect" {
  metadata {
    name      = "grafana-http-redirect"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    annotations = {
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web"
      # Use the redirect middleware from the abaci namespace
      "traefik.ingress.kubernetes.io/router.middlewares" = "${var.namespace}-redirect-https@kubernetescrd"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = "grafana.dev.${var.app_domain}"

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = "kube-prometheus-stack-grafana"
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }

  depends_on = [helm_release.kube_prometheus_stack]
}

# Prometheus Ingress with TLS (prometheus.dev.abaci.one)
resource "kubernetes_ingress_v1" "prometheus" {
  metadata {
    name      = "prometheus"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    annotations = {
      "cert-manager.io/cluster-issuer"                   = var.use_staging_certs ? "letsencrypt-staging" : "letsencrypt-prod"
      "traefik.ingress.kubernetes.io/router.entrypoints" = "websecure"
    }
  }

  spec {
    ingress_class_name = "traefik"

    tls {
      hosts       = ["prometheus.dev.${var.app_domain}"]
      secret_name = "prometheus-tls"
    }

    rule {
      host = "prometheus.dev.${var.app_domain}"

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = "kube-prometheus-stack-prometheus"
              port {
                number = 9090
              }
            }
          }
        }
      }
    }
  }

  depends_on = [helm_release.kube_prometheus_stack, null_resource.cert_manager_issuers]
}

# HTTP to HTTPS redirect for prometheus subdomain
resource "kubernetes_ingress_v1" "prometheus_http_redirect" {
  metadata {
    name      = "prometheus-http-redirect"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    annotations = {
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web"
      # Use the redirect middleware from the abaci namespace
      "traefik.ingress.kubernetes.io/router.middlewares" = "${var.namespace}-redirect-https@kubernetescrd"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = "prometheus.dev.${var.app_domain}"

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = "kube-prometheus-stack-prometheus"
              port {
                number = 9090
              }
            }
          }
        }
      }
    }
  }

  depends_on = [helm_release.kube_prometheus_stack]
}

# ServiceMonitor for abaci-app
# This tells Prometheus to scrape /metrics from the app pods
# Using null_resource with kubectl because kubernetes_manifest validates CRDs at plan time,
# but the ServiceMonitor CRD only exists after kube-prometheus-stack is installed.
resource "null_resource" "app_service_monitor" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}

      # Wait for CRDs to be available
      kubectl wait --for=condition=Established crd/servicemonitors.monitoring.coreos.com --timeout=120s

      # Apply ServiceMonitor
      cat <<EOF | kubectl apply -f -
      apiVersion: monitoring.coreos.com/v1
      kind: ServiceMonitor
      metadata:
        name: abaci-app
        namespace: ${kubernetes_namespace.monitoring.metadata[0].name}
        labels:
          app: abaci-app
      spec:
        selector:
          matchLabels:
            app: abaci-app
        namespaceSelector:
          matchNames:
          - ${var.namespace}
        endpoints:
        - port: http
          path: /api/metrics
          interval: 30s
      EOF
    EOT
  }

  triggers = {
    namespace     = kubernetes_namespace.monitoring.metadata[0].name
    app_namespace = var.namespace
  }
}

# =============================================================================
# Grafana Dashboard Provisioning via ConfigMap
# =============================================================================
# The Grafana sidecar watches for ConfigMaps with label grafana_dashboard="1"
# and automatically imports the dashboard JSON.

resource "kubernetes_config_map" "grafana_dashboard_product" {
  metadata {
    name      = "grafana-dashboard-product"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "product-metrics.json" = jsonencode({
      annotations = {
        list = []
      }
      editable             = true
      fiscalYearStartMonth = 0
      graphTooltip         = 0
      id                   = null
      links                = []
      panels = [
        # Row 1: Key Metrics
        {
          collapsed = false
          gridPos   = { h = 1, w = 24, x = 0, y = 0 }
          id        = 100
          panels    = []
          title     = "Key Metrics"
          type      = "row"
        },
        # Active Sessions Stat
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "thresholds" }
              thresholds = {
                mode = "absolute"
                steps = [
                  { color = "green", value = null },
                  { color = "yellow", value = 10 },
                  { color = "red", value = 50 }
                ]
              }
              unit = "short"
            }
          }
          gridPos = { h = 4, w = 4, x = 0, y = 1 }
          id      = 1
          options = {
            colorMode   = "value"
            graphMode   = "area"
            justifyMode = "auto"
            orientation = "auto"
            reduceOptions = {
              calcs  = ["lastNotNull"]
              fields = ""
              values = false
            }
            textMode = "auto"
          }
          targets = [{
            expr         = "sessions_active{app=\"abaci-app\"}"
            legendFormat = "Active Sessions"
            refId        = "A"
          }]
          title = "Active Sessions"
          type  = "stat"
        },
        # Socket.IO Connections
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "thresholds" }
              thresholds = {
                mode = "absolute"
                steps = [
                  { color = "green", value = null },
                  { color = "yellow", value = 20 },
                  { color = "red", value = 100 }
                ]
              }
              unit = "short"
            }
          }
          gridPos = { h = 4, w = 4, x = 4, y = 1 }
          id      = 2
          options = {
            colorMode   = "value"
            graphMode   = "area"
            justifyMode = "auto"
            orientation = "auto"
            reduceOptions = {
              calcs  = ["lastNotNull"]
              fields = ""
              values = false
            }
            textMode = "auto"
          }
          targets = [{
            expr         = "sum(socketio_connections_active{app=\"abaci-app\"})"
            legendFormat = "Socket.IO"
            refId        = "A"
          }]
          title = "Socket.IO Connections"
          type  = "stat"
        },
        # Daily Unique Visitors
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "thresholds" }
              thresholds = {
                mode = "absolute"
                steps = [
                  { color = "blue", value = null }
                ]
              }
              unit = "short"
            }
          }
          gridPos = { h = 4, w = 4, x = 8, y = 1 }
          id      = 3
          options = {
            colorMode   = "value"
            graphMode   = "none"
            justifyMode = "auto"
            orientation = "auto"
            reduceOptions = {
              calcs  = ["lastNotNull"]
              fields = ""
              values = false
            }
            textMode = "auto"
          }
          targets = [{
            expr         = "unique_visitors_daily{app=\"abaci-app\"}"
            legendFormat = "Unique"
            refId        = "A"
          }]
          title = "Daily Unique Visitors"
          type  = "stat"
        },
        # Request Rate
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "thresholds" }
              thresholds = {
                mode = "absolute"
                steps = [
                  { color = "green", value = null }
                ]
              }
              unit = "reqps"
            }
          }
          gridPos = { h = 4, w = 4, x = 12, y = 1 }
          id      = 4
          options = {
            colorMode   = "value"
            graphMode   = "area"
            justifyMode = "auto"
            orientation = "auto"
            reduceOptions = {
              calcs  = ["lastNotNull"]
              fields = ""
              values = false
            }
            textMode = "auto"
          }
          targets = [{
            expr         = "sum(rate(http_requests_total{app=\"abaci-app\"}[5m]))"
            legendFormat = "req/s"
            refId        = "A"
          }]
          title = "Request Rate"
          type  = "stat"
        },
        # Error Rate
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "thresholds" }
              thresholds = {
                mode = "absolute"
                steps = [
                  { color = "green", value = null },
                  { color = "yellow", value = 0.01 },
                  { color = "red", value = 0.05 }
                ]
              }
              unit = "percentunit"
            }
          }
          gridPos = { h = 4, w = 4, x = 16, y = 1 }
          id      = 5
          options = {
            colorMode   = "value"
            graphMode   = "area"
            justifyMode = "auto"
            orientation = "auto"
            reduceOptions = {
              calcs  = ["lastNotNull"]
              fields = ""
              values = false
            }
            textMode = "auto"
          }
          targets = [{
            expr         = "sum(rate(http_requests_total{app=\"abaci-app\",status_code=~\"5..\"}[5m])) / sum(rate(http_requests_total{app=\"abaci-app\"}[5m])) or vector(0)"
            legendFormat = "Error %"
            refId        = "A"
          }]
          title = "Error Rate"
          type  = "stat"
        },
        # Memory Usage
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "thresholds" }
              thresholds = {
                mode = "absolute"
                steps = [
                  { color = "green", value = null },
                  { color = "yellow", value = 536870912 },
                  { color = "red", value = 1073741824 }
                ]
              }
              unit = "bytes"
            }
          }
          gridPos = { h = 4, w = 4, x = 20, y = 1 }
          id      = 6
          options = {
            colorMode   = "value"
            graphMode   = "area"
            justifyMode = "auto"
            orientation = "auto"
            reduceOptions = {
              calcs  = ["lastNotNull"]
              fields = ""
              values = false
            }
            textMode = "auto"
          }
          targets = [{
            expr         = "avg(nodejs_heap_size_used_bytes{app=\"abaci-app\"})"
            legendFormat = "Heap"
            refId        = "A"
          }]
          title = "Avg Heap Memory"
          type  = "stat"
        },
        # Row 2: Traffic
        {
          collapsed = false
          gridPos   = { h = 1, w = 24, x = 0, y = 5 }
          id        = 101
          panels    = []
          title     = "Traffic"
          type      = "row"
        },
        # Request Rate Over Time
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              custom = {
                axisBorderShow    = false
                axisCenteredZero  = false
                axisColorMode     = "text"
                axisLabel         = ""
                axisPlacement     = "auto"
                barAlignment      = 0
                drawStyle         = "line"
                fillOpacity       = 10
                gradientMode      = "none"
                hideFrom          = { legend = false, tooltip = false, viz = false }
                insertNulls       = false
                lineInterpolation = "linear"
                lineWidth         = 1
                pointSize         = 5
                scaleDistribution = { type = "linear" }
                showPoints        = "never"
                spanNulls         = false
                stacking          = { group = "A", mode = "none" }
                thresholdsStyle   = { mode = "off" }
              }
              unit = "reqps"
            }
          }
          gridPos = { h = 8, w = 12, x = 0, y = 6 }
          id      = 10
          options = {
            legend  = { calcs = [], displayMode = "list", placement = "bottom", showLegend = true }
            tooltip = { mode = "multi", sort = "desc" }
          }
          targets = [{
            expr         = "sum(rate(http_requests_total{app=\"abaci-app\"}[5m])) by (status_code)"
            legendFormat = "{{status_code}}"
            refId        = "A"
          }]
          title = "Request Rate by Status"
          type  = "timeseries"
        },
        # Response Time
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              custom = {
                axisBorderShow    = false
                axisCenteredZero  = false
                axisColorMode     = "text"
                axisLabel         = ""
                axisPlacement     = "auto"
                barAlignment      = 0
                drawStyle         = "line"
                fillOpacity       = 10
                gradientMode      = "none"
                hideFrom          = { legend = false, tooltip = false, viz = false }
                insertNulls       = false
                lineInterpolation = "linear"
                lineWidth         = 1
                pointSize         = 5
                scaleDistribution = { type = "linear" }
                showPoints        = "never"
                spanNulls         = false
                stacking          = { group = "A", mode = "none" }
                thresholdsStyle   = { mode = "off" }
              }
              unit = "s"
            }
          }
          gridPos = { h = 8, w = 12, x = 12, y = 6 }
          id      = 11
          options = {
            legend  = { calcs = [], displayMode = "list", placement = "bottom", showLegend = true }
            tooltip = { mode = "multi", sort = "desc" }
          }
          targets = [
            {
              expr         = "histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket{app=\"abaci-app\"}[5m])) by (le))"
              legendFormat = "P50"
              refId        = "A"
            },
            {
              expr         = "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{app=\"abaci-app\"}[5m])) by (le))"
              legendFormat = "P95"
              refId        = "B"
            },
            {
              expr         = "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{app=\"abaci-app\"}[5m])) by (le))"
              legendFormat = "P99"
              refId        = "C"
            }
          ]
          title = "Response Time Percentiles"
          type  = "timeseries"
        },
        # Row 3: Application Activity
        {
          collapsed = false
          gridPos   = { h = 1, w = 24, x = 0, y = 14 }
          id        = 102
          panels    = []
          title     = "Application Activity"
          type      = "row"
        },
        # Arcade Games
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              custom = {
                axisBorderShow    = false
                axisCenteredZero  = false
                axisColorMode     = "text"
                axisLabel         = ""
                axisPlacement     = "auto"
                barAlignment      = 0
                drawStyle         = "bars"
                fillOpacity       = 50
                gradientMode      = "none"
                hideFrom          = { legend = false, tooltip = false, viz = false }
                insertNulls       = false
                lineInterpolation = "linear"
                lineWidth         = 1
                pointSize         = 5
                scaleDistribution = { type = "linear" }
                showPoints        = "never"
                spanNulls         = false
                stacking          = { group = "A", mode = "normal" }
                thresholdsStyle   = { mode = "off" }
              }
              unit = "short"
            }
          }
          gridPos = { h = 8, w = 8, x = 0, y = 15 }
          id      = 20
          options = {
            legend  = { calcs = [], displayMode = "list", placement = "bottom", showLegend = true }
            tooltip = { mode = "multi", sort = "desc" }
          }
          targets = [{
            expr         = "sum(increase(arcade_games_completed_total{app=\"abaci-app\"}[1h])) by (game)"
            legendFormat = "{{game}}"
            refId        = "A"
          }]
          title = "Arcade Games Completed (1h)"
          type  = "timeseries"
        },
        # Worksheets Generated
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              custom = {
                axisBorderShow    = false
                axisCenteredZero  = false
                axisColorMode     = "text"
                axisLabel         = ""
                axisPlacement     = "auto"
                barAlignment      = 0
                drawStyle         = "bars"
                fillOpacity       = 50
                gradientMode      = "none"
                hideFrom          = { legend = false, tooltip = false, viz = false }
                insertNulls       = false
                lineInterpolation = "linear"
                lineWidth         = 1
                pointSize         = 5
                scaleDistribution = { type = "linear" }
                showPoints        = "never"
                spanNulls         = false
                stacking          = { group = "A", mode = "normal" }
                thresholdsStyle   = { mode = "off" }
              }
              unit = "short"
            }
          }
          gridPos = { h = 8, w = 8, x = 8, y = 15 }
          id      = 21
          options = {
            legend  = { calcs = [], displayMode = "list", placement = "bottom", showLegend = true }
            tooltip = { mode = "multi", sort = "desc" }
          }
          targets = [{
            expr         = "sum(increase(worksheet_generations_total{app=\"abaci-app\"}[1h])) by (operator)"
            legendFormat = "{{operator}}"
            refId        = "A"
          }]
          title = "Worksheets Generated (1h)"
          type  = "timeseries"
        },
        # Page Views
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              custom = {
                axisBorderShow    = false
                axisCenteredZero  = false
                axisColorMode     = "text"
                axisLabel         = ""
                axisPlacement     = "auto"
                barAlignment      = 0
                drawStyle         = "bars"
                fillOpacity       = 50
                gradientMode      = "none"
                hideFrom          = { legend = false, tooltip = false, viz = false }
                insertNulls       = false
                lineInterpolation = "linear"
                lineWidth         = 1
                pointSize         = 5
                scaleDistribution = { type = "linear" }
                showPoints        = "never"
                spanNulls         = false
                stacking          = { group = "A", mode = "normal" }
                thresholdsStyle   = { mode = "off" }
              }
              unit = "short"
            }
          }
          gridPos = { h = 8, w = 8, x = 16, y = 15 }
          id      = 22
          options = {
            legend  = { calcs = [], displayMode = "list", placement = "bottom", showLegend = true }
            tooltip = { mode = "multi", sort = "desc" }
          }
          targets = [{
            expr         = "topk(10, sum(increase(page_views_total{app=\"abaci-app\"}[1h])) by (path))"
            legendFormat = "{{path}}"
            refId        = "A"
          }]
          title = "Top Page Views (1h)"
          type  = "timeseries"
        },
        # Row 4: System Health
        {
          collapsed = false
          gridPos   = { h = 1, w = 24, x = 0, y = 23 }
          id        = 103
          panels    = []
          title     = "System Health"
          type      = "row"
        },
        # Memory Usage Over Time
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              custom = {
                axisBorderShow    = false
                axisCenteredZero  = false
                axisColorMode     = "text"
                axisLabel         = ""
                axisPlacement     = "auto"
                barAlignment      = 0
                drawStyle         = "line"
                fillOpacity       = 20
                gradientMode      = "none"
                hideFrom          = { legend = false, tooltip = false, viz = false }
                insertNulls       = false
                lineInterpolation = "linear"
                lineWidth         = 1
                pointSize         = 5
                scaleDistribution = { type = "linear" }
                showPoints        = "never"
                spanNulls         = false
                stacking          = { group = "A", mode = "none" }
                thresholdsStyle   = { mode = "off" }
              }
              unit = "bytes"
            }
          }
          gridPos = { h = 8, w = 8, x = 0, y = 24 }
          id      = 30
          options = {
            legend  = { calcs = [], displayMode = "list", placement = "bottom", showLegend = true }
            tooltip = { mode = "multi", sort = "desc" }
          }
          targets = [
            {
              expr         = "nodejs_heap_size_used_bytes{app=\"abaci-app\"}"
              legendFormat = "{{pod}} Used"
              refId        = "A"
            },
            {
              expr         = "nodejs_heap_size_total_bytes{app=\"abaci-app\"}"
              legendFormat = "{{pod}} Total"
              refId        = "B"
            }
          ]
          title = "Heap Memory"
          type  = "timeseries"
        },
        # Event Loop Lag
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              custom = {
                axisBorderShow    = false
                axisCenteredZero  = false
                axisColorMode     = "text"
                axisLabel         = ""
                axisPlacement     = "auto"
                barAlignment      = 0
                drawStyle         = "line"
                fillOpacity       = 10
                gradientMode      = "none"
                hideFrom          = { legend = false, tooltip = false, viz = false }
                insertNulls       = false
                lineInterpolation = "linear"
                lineWidth         = 1
                pointSize         = 5
                scaleDistribution = { type = "linear" }
                showPoints        = "never"
                spanNulls         = false
                stacking          = { group = "A", mode = "none" }
                thresholdsStyle   = { mode = "off" }
              }
              unit = "s"
            }
          }
          gridPos = { h = 8, w = 8, x = 8, y = 24 }
          id      = 31
          options = {
            legend  = { calcs = [], displayMode = "list", placement = "bottom", showLegend = true }
            tooltip = { mode = "multi", sort = "desc" }
          }
          targets = [{
            expr         = "nodejs_eventloop_lag_seconds{app=\"abaci-app\"}"
            legendFormat = "{{pod}}"
            refId        = "A"
          }]
          title = "Event Loop Lag"
          type  = "timeseries"
        },
        # Active Handles/Requests
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              custom = {
                axisBorderShow    = false
                axisCenteredZero  = false
                axisColorMode     = "text"
                axisLabel         = ""
                axisPlacement     = "auto"
                barAlignment      = 0
                drawStyle         = "line"
                fillOpacity       = 10
                gradientMode      = "none"
                hideFrom          = { legend = false, tooltip = false, viz = false }
                insertNulls       = false
                lineInterpolation = "linear"
                lineWidth         = 1
                pointSize         = 5
                scaleDistribution = { type = "linear" }
                showPoints        = "never"
                spanNulls         = false
                stacking          = { group = "A", mode = "none" }
                thresholdsStyle   = { mode = "off" }
              }
              unit = "short"
            }
          }
          gridPos = { h = 8, w = 8, x = 16, y = 24 }
          id      = 32
          options = {
            legend  = { calcs = [], displayMode = "list", placement = "bottom", showLegend = true }
            tooltip = { mode = "multi", sort = "desc" }
          }
          targets = [
            {
              expr         = "nodejs_active_handles_total{app=\"abaci-app\"}"
              legendFormat = "{{pod}} Handles"
              refId        = "A"
            },
            {
              expr         = "nodejs_active_requests_total{app=\"abaci-app\"}"
              legendFormat = "{{pod}} Requests"
              refId        = "B"
            }
          ]
          title = "Active Handles & Requests"
          type  = "timeseries"
        }
      ]
      refresh       = "30s"
      schemaVersion = 39
      tags          = ["product", "application", "abaci"]
      templating    = { list = [] }
      time          = { from = "now-1h", to = "now" }
      timepicker    = {}
      timezone      = "browser"
      title         = "Product Metrics"
      uid           = "product-metrics"
      version       = 1
    })
  }

  depends_on = [helm_release.kube_prometheus_stack]
}

# Ops Metrics Dashboard - Infrastructure and CI/CD monitoring
resource "kubernetes_config_map" "grafana_dashboard_ops" {
  metadata {
    name      = "grafana-dashboard-ops"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "ops-metrics.json" = jsonencode({
      annotations = { list = [] }
      editable    = true
      panels = [
        # Row: Gitea Runner
        {
          collapsed = false
          gridPos   = { h = 1, w = 24, x = 0, y = 0 }
          id        = 100
          title     = "Gitea Runner"
          type      = "row"
        },
        # Gitea Runner Memory
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              unit  = "bytes"
            }
          }
          gridPos = { h = 8, w = 8, x = 0, y = 1 }
          id      = 101
          options = {
            legend  = { calcs = ["last"], displayMode = "table", placement = "bottom" }
            tooltip = { mode = "multi" }
          }
          targets = [
            {
              expr         = "container_memory_working_set_bytes{namespace=\"gitea-runner\", container!=\"\", container!=\"POD\"}"
              legendFormat = "{{container}}"
              refId        = "A"
            }
          ]
          title = "Runner Memory Usage"
          type  = "timeseries"
        },
        # Gitea Runner CPU
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              unit  = "percentunit"
            }
          }
          gridPos = { h = 8, w = 8, x = 8, y = 1 }
          id      = 102
          options = {
            legend  = { calcs = ["mean", "max"], displayMode = "table", placement = "bottom" }
            tooltip = { mode = "multi" }
          }
          targets = [
            {
              expr         = "rate(container_cpu_usage_seconds_total{namespace=\"gitea-runner\", container!=\"\", container!=\"POD\"}[5m])"
              legendFormat = "{{container}}"
              refId        = "A"
            }
          ]
          title = "Runner CPU Usage"
          type  = "timeseries"
        },
        # Gitea Runner Network I/O
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              unit  = "Bps"
            }
          }
          gridPos = { h = 8, w = 8, x = 16, y = 1 }
          id      = 103
          options = {
            legend  = { calcs = ["mean"], displayMode = "table", placement = "bottom" }
            tooltip = { mode = "multi" }
          }
          targets = [
            {
              expr         = "rate(container_network_receive_bytes_total{namespace=\"gitea-runner\"}[5m])"
              legendFormat = "RX"
              refId        = "A"
            },
            {
              expr         = "rate(container_network_transmit_bytes_total{namespace=\"gitea-runner\"}[5m])"
              legendFormat = "TX"
              refId        = "B"
            }
          ]
          title = "Runner Network I/O"
          type  = "timeseries"
        },
        # Row: Node Resources
        {
          collapsed = false
          gridPos   = { h = 1, w = 24, x = 0, y = 9 }
          id        = 200
          title     = "Node Resources"
          type      = "row"
        },
        # Node Memory Gauge
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = {
                mode = "thresholds"
              }
              max = 1
              min = 0
              thresholds = {
                mode = "percentage"
                steps = [
                  { color = "green", value = null },
                  { color = "yellow", value = 70 },
                  { color = "red", value = 85 }
                ]
              }
              unit = "percentunit"
            }
          }
          gridPos = { h = 8, w = 6, x = 0, y = 10 }
          id      = 201
          options = {
            orientation          = "auto"
            reduceOptions        = { calcs = ["lastNotNull"], fields = "", values = false }
            showThresholdLabels  = false
            showThresholdMarkers = true
          }
          targets = [
            {
              expr  = "1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)"
              refId = "A"
            }
          ]
          title = "Node Memory %"
          type  = "gauge"
        },
        # Node Memory Breakdown
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              unit  = "bytes"
            }
          }
          gridPos = { h = 8, w = 10, x = 6, y = 10 }
          id      = 202
          options = {
            legend  = { calcs = ["last"], displayMode = "table", placement = "right" }
            tooltip = { mode = "multi" }
          }
          targets = [
            {
              expr         = "node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes"
              legendFormat = "Used"
              refId        = "A"
            },
            {
              expr         = "node_memory_Cached_bytes"
              legendFormat = "Cached"
              refId        = "B"
            },
            {
              expr         = "node_memory_Buffers_bytes"
              legendFormat = "Buffers"
              refId        = "C"
            },
            {
              expr         = "node_memory_MemAvailable_bytes"
              legendFormat = "Available"
              refId        = "D"
            }
          ]
          title = "Node Memory Breakdown"
          type  = "timeseries"
        },
        # Node CPU Usage
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              unit  = "percentunit"
              max   = 1
            }
          }
          gridPos = { h = 8, w = 8, x = 16, y = 10 }
          id      = 203
          options = {
            legend  = { calcs = ["mean", "max"], displayMode = "table", placement = "bottom" }
            tooltip = { mode = "multi" }
          }
          targets = [
            {
              expr         = "1 - avg(rate(node_cpu_seconds_total{mode=\"idle\"}[5m]))"
              legendFormat = "Total CPU"
              refId        = "A"
            },
            {
              expr         = "avg(rate(node_cpu_seconds_total{mode=\"iowait\"}[5m]))"
              legendFormat = "I/O Wait"
              refId        = "B"
            }
          ]
          title = "Node CPU Usage"
          type  = "timeseries"
        },
        # Row: Disk I/O
        {
          collapsed = false
          gridPos   = { h = 1, w = 24, x = 0, y = 18 }
          id        = 300
          title     = "Disk I/O"
          type      = "row"
        },
        # Disk Read/Write Throughput
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              unit  = "Bps"
            }
          }
          gridPos = { h = 8, w = 12, x = 0, y = 19 }
          id      = 301
          options = {
            legend  = { calcs = ["mean", "max"], displayMode = "table", placement = "bottom" }
            tooltip = { mode = "multi" }
          }
          targets = [
            {
              expr         = "rate(node_disk_read_bytes_total[5m])"
              legendFormat = "Read {{device}}"
              refId        = "A"
            },
            {
              expr         = "rate(node_disk_written_bytes_total[5m])"
              legendFormat = "Write {{device}}"
              refId        = "B"
            }
          ]
          title = "Disk Throughput"
          type  = "timeseries"
        },
        # Disk I/O Utilization
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              unit  = "percentunit"
              max   = 1
            }
          }
          gridPos = { h = 8, w = 12, x = 12, y = 19 }
          id      = 302
          options = {
            legend  = { calcs = ["mean", "max"], displayMode = "table", placement = "bottom" }
            tooltip = { mode = "multi" }
          }
          targets = [
            {
              expr         = "rate(node_disk_io_time_seconds_total[5m])"
              legendFormat = "{{device}} Util %"
              refId        = "A"
            }
          ]
          title = "Disk I/O Utilization"
          type  = "timeseries"
        },
        # Row: Pod Status
        {
          collapsed = false
          gridPos   = { h = 1, w = 24, x = 0, y = 27 }
          id        = 400
          title     = "Pod Status"
          type      = "row"
        },
        # Namespace Memory by Pod
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              unit  = "bytes"
            }
          }
          gridPos = { h = 8, w = 12, x = 0, y = 28 }
          id      = 401
          options = {
            legend  = { calcs = ["last"], displayMode = "table", placement = "right" }
            tooltip = { mode = "multi" }
          }
          targets = [
            {
              expr         = "sum by (namespace) (container_memory_working_set_bytes{container!=\"\", container!=\"POD\"})"
              legendFormat = "{{namespace}}"
              refId        = "A"
            }
          ]
          title = "Memory by Namespace"
          type  = "timeseries"
        },
        # Container Restarts
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              unit  = "short"
            }
          }
          gridPos = { h = 8, w = 12, x = 12, y = 28 }
          id      = 402
          options = {
            legend  = { calcs = ["last"], displayMode = "table", placement = "right" }
            tooltip = { mode = "multi" }
          }
          targets = [
            {
              expr         = "increase(kube_pod_container_status_restarts_total[1h])"
              legendFormat = "{{namespace}}/{{pod}}"
              refId        = "A"
            }
          ]
          title = "Container Restarts (1h)"
          type  = "timeseries"
        },
        # =================================================================
        # Row: E2E Smoke Tests
        # =================================================================
        {
          collapsed = false
          gridPos   = { h = 1, w = 24, x = 0, y = 36 }
          id        = 500
          title     = "E2E Smoke Tests"
          type      = "row"
        },
        # Status indicator - big PASSED/FAILED
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "thresholds" }
              mappings = [
                {
                  options = {
                    "0" = { text = "FAILED", color = "red", index = 0 }
                    "1" = { text = "PASSED", color = "green", index = 1 }
                  }
                  type = "value"
                }
              ]
              thresholds = {
                mode = "absolute"
                steps = [
                  { color = "red", value = null },
                  { color = "green", value = 1 }
                ]
              }
              unit = "none"
            }
          }
          gridPos = { h = 6, w = 4, x = 0, y = 37 }
          id      = 501
          options = {
            colorMode   = "background"
            graphMode   = "none"
            justifyMode = "center"
            orientation = "auto"
            reduceOptions = {
              calcs  = ["lastNotNull"]
              fields = ""
              values = false
            }
            textMode = "value"
          }
          targets = [{
            expr  = "smoke_test_last_status{app=\"abaci-app\"}"
            refId = "A"
          }]
          title = "Smoke Test Status"
          type  = "stat"
        },
        # Time since last run
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "thresholds" }
              thresholds = {
                mode = "absolute"
                steps = [
                  { color = "green", value = null },
                  { color = "yellow", value = 86400 },
                  { color = "red", value = 90000 }
                ]
              }
              unit = "s"
            }
          }
          gridPos = { h = 6, w = 4, x = 4, y = 37 }
          id      = 502
          options = {
            colorMode   = "value"
            graphMode   = "none"
            justifyMode = "auto"
            orientation = "auto"
            reduceOptions = {
              calcs  = ["lastNotNull"]
              fields = ""
              values = false
            }
            textMode = "auto"
          }
          targets = [{
            expr         = "time() - smoke_test_last_run_timestamp_seconds{app=\"abaci-app\"}"
            legendFormat = "Age"
            refId        = "A"
          }]
          title = "Time Since Last Run"
          type  = "stat"
        },
        # Duration of last run
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "thresholds" }
              thresholds = {
                mode = "absolute"
                steps = [
                  { color = "green", value = null },
                  { color = "yellow", value = 60 },
                  { color = "red", value = 120 }
                ]
              }
              unit = "s"
            }
          }
          gridPos = { h = 6, w = 4, x = 8, y = 37 }
          id      = 503
          options = {
            colorMode   = "value"
            graphMode   = "area"
            justifyMode = "auto"
            orientation = "auto"
            reduceOptions = {
              calcs  = ["lastNotNull"]
              fields = ""
              values = false
            }
            textMode = "auto"
          }
          targets = [{
            expr         = "smoke_test_last_duration_seconds{app=\"abaci-app\"}"
            legendFormat = "Duration"
            refId        = "A"
          }]
          title = "Suite Duration"
          type  = "stat"
        },
        # Tests passed / total
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "thresholds" }
              thresholds = {
                mode = "absolute"
                steps = [
                  { color = "red", value = null },
                  { color = "green", value = 1 }
                ]
              }
              unit = "none"
            }
          }
          gridPos = { h = 6, w = 4, x = 12, y = 37 }
          id      = 504
          options = {
            colorMode   = "value"
            graphMode   = "none"
            justifyMode = "auto"
            orientation = "horizontal"
            reduceOptions = {
              calcs  = ["lastNotNull"]
              fields = ""
              values = false
            }
            textMode = "auto"
          }
          targets = [
            {
              expr         = "smoke_test_last_passed_count{app=\"abaci-app\"}"
              legendFormat = "Passed"
              refId        = "A"
            },
            {
              expr         = "smoke_test_last_failed_count{app=\"abaci-app\"}"
              legendFormat = "Failed"
              refId        = "B"
            }
          ]
          title = "Test Results"
          type  = "stat"
        },
        # Pass rate percentage
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "thresholds" }
              max   = 1
              min   = 0
              thresholds = {
                mode = "absolute"
                steps = [
                  { color = "red", value = null },
                  { color = "yellow", value = 0.8 },
                  { color = "green", value = 1 }
                ]
              }
              unit = "percentunit"
            }
          }
          gridPos = { h = 6, w = 4, x = 16, y = 37 }
          id      = 505
          options = {
            orientation          = "auto"
            reduceOptions        = { calcs = ["lastNotNull"], fields = "", values = false }
            showThresholdLabels  = false
            showThresholdMarkers = true
          }
          targets = [{
            expr  = "smoke_test_last_passed_count{app=\"abaci-app\"} / smoke_test_last_total_count{app=\"abaci-app\"}"
            refId = "A"
          }]
          title = "Pass Rate"
          type  = "gauge"
        },
        # Total runs counter
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "thresholds" }
              thresholds = {
                mode = "absolute"
                steps = [
                  { color = "blue", value = null }
                ]
              }
              unit = "short"
            }
          }
          gridPos = { h = 6, w = 4, x = 20, y = 37 }
          id      = 506
          options = {
            colorMode   = "value"
            graphMode   = "area"
            justifyMode = "auto"
            orientation = "auto"
            reduceOptions = {
              calcs  = ["lastNotNull"]
              fields = ""
              values = false
            }
            textMode = "auto"
          }
          targets = [{
            expr         = "sum(smoke_test_runs_total{app=\"abaci-app\"})"
            legendFormat = "Total Runs"
            refId        = "A"
          }]
          title = "Total Runs"
          type  = "stat"
        },
        # Run history - pass/fail over time
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              custom = {
                axisBorderShow    = false
                axisCenteredZero  = false
                axisColorMode     = "text"
                axisLabel         = ""
                axisPlacement     = "auto"
                barAlignment      = 0
                drawStyle         = "bars"
                fillOpacity       = 80
                gradientMode      = "none"
                hideFrom          = { legend = false, tooltip = false, viz = false }
                insertNulls       = false
                lineInterpolation = "linear"
                lineWidth         = 1
                pointSize         = 5
                scaleDistribution = { type = "linear" }
                showPoints        = "never"
                spanNulls         = false
                stacking          = { group = "A", mode = "normal" }
                thresholdsStyle   = { mode = "off" }
              }
              unit = "short"
            }
            overrides = [
              {
                matcher    = { id = "byName", options = "passed" }
                properties = [{ id = "color", value = { fixedColor = "green", mode = "fixed" } }]
              },
              {
                matcher    = { id = "byName", options = "failed" }
                properties = [{ id = "color", value = { fixedColor = "red", mode = "fixed" } }]
              },
              {
                matcher    = { id = "byName", options = "error" }
                properties = [{ id = "color", value = { fixedColor = "orange", mode = "fixed" } }]
              }
            ]
          }
          gridPos = { h = 8, w = 12, x = 0, y = 43 }
          id      = 507
          options = {
            legend  = { calcs = [], displayMode = "list", placement = "bottom", showLegend = true }
            tooltip = { mode = "multi", sort = "desc" }
          }
          targets = [
            {
              expr         = "increase(smoke_test_runs_total{app=\"abaci-app\", status=\"passed\"}[1d])"
              legendFormat = "passed"
              refId        = "A"
            },
            {
              expr         = "increase(smoke_test_runs_total{app=\"abaci-app\", status=\"failed\"}[1d])"
              legendFormat = "failed"
              refId        = "B"
            },
            {
              expr         = "increase(smoke_test_runs_total{app=\"abaci-app\", status=\"error\"}[1d])"
              legendFormat = "error"
              refId        = "C"
            }
          ]
          title = "Run History (daily)"
          type  = "timeseries"
        },
        # Duration over time
        {
          datasource = { type = "prometheus", uid = "prometheus" }
          fieldConfig = {
            defaults = {
              color = { mode = "palette-classic" }
              custom = {
                axisBorderShow    = false
                axisCenteredZero  = false
                axisColorMode     = "text"
                axisLabel         = ""
                axisPlacement     = "auto"
                barAlignment      = 0
                drawStyle         = "line"
                fillOpacity       = 20
                gradientMode      = "scheme"
                hideFrom          = { legend = false, tooltip = false, viz = false }
                insertNulls       = false
                lineInterpolation = "smooth"
                lineWidth         = 2
                pointSize         = 6
                scaleDistribution = { type = "linear" }
                showPoints        = "always"
                spanNulls         = 3600
                stacking          = { group = "A", mode = "none" }
                thresholdsStyle   = { mode = "area" }
              }
              thresholds = {
                mode = "absolute"
                steps = [
                  { color = "green", value = null },
                  { color = "yellow", value = 60 },
                  { color = "red", value = 120 }
                ]
              }
              unit = "s"
            }
          }
          gridPos = { h = 8, w = 12, x = 12, y = 43 }
          id      = 508
          options = {
            legend  = { calcs = ["mean", "max"], displayMode = "table", placement = "bottom", showLegend = true }
            tooltip = { mode = "multi", sort = "desc" }
          }
          targets = [{
            expr         = "smoke_test_last_duration_seconds{app=\"abaci-app\"}"
            legendFormat = "Duration"
            refId        = "A"
          }]
          title = "Suite Duration Over Time"
          type  = "timeseries"
        }
      ]
      refresh       = "30s"
      schemaVersion = 39
      tags          = ["ops", "infrastructure"]
      templating    = { list = [] }
      time          = { from = "now-1h", to = "now" }
      timepicker    = {}
      timezone      = "browser"
      title         = "Ops Metrics"
      uid           = "ops-metrics"
      version       = 1
    })
  }

  depends_on = [helm_release.kube_prometheus_stack]
}
