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
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    app_namespace = var.namespace
  }
}
