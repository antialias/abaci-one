# Dev Artifacts Server
#
# Serves static build artifacts at dev.abaci.one:
# - /smoke-reports/  - Playwright HTML reports from smoke tests
# - /storybook/      - Component library documentation
# - /coverage/       - Test coverage reports (future)
#
# Architecture:
# - NFS-backed PVC shared between artifact producers and nginx
# - nginx serves files read-only with directory listing enabled
# - Smoke tests CronJob writes reports directly to filesystem

# NFS PersistentVolume for dev artifacts
resource "kubernetes_persistent_volume" "dev_artifacts" {
  metadata {
    name = "dev-artifacts-pv"
    labels = {
      type = "nfs"
      app  = "dev-artifacts"
    }
  }

  spec {
    capacity = {
      storage = "10Gi"
    }
    access_modes                     = ["ReadWriteMany"]
    persistent_volume_reclaim_policy = "Retain"
    storage_class_name               = "nfs"

    persistent_volume_source {
      nfs {
        server = var.nfs_server
        path   = "/volume1/homes/antialias/projects/abaci.one/data/dev-artifacts"
      }
    }
  }
}

resource "kubernetes_persistent_volume_claim" "dev_artifacts" {
  metadata {
    name      = "dev-artifacts"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  spec {
    access_modes       = ["ReadWriteMany"]
    storage_class_name = "nfs"

    resources {
      requests = {
        storage = "10Gi"
      }
    }

    selector {
      match_labels = {
        type = "nfs"
        app  = "dev-artifacts"
      }
    }
  }
}

# nginx ConfigMap for custom configuration
resource "kubernetes_config_map" "dev_artifacts_nginx" {
  metadata {
    name      = "dev-artifacts-nginx"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  data = {
    "default.conf" = <<-EOT
      server {
          listen 80;
          server_name _;

          root /usr/share/nginx/html;

          # Enable directory listing for subdirectories
          autoindex on;
          autoindex_exact_size off;
          autoindex_localtime on;

          # Serve index page at root
          location = / {
              root /usr/share/nginx/static;
              try_files /index.html =404;
          }

          # Serve static files with caching
          location / {
              try_files $uri $uri/ =404;

              # Cache static assets
              location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
                  expires 1d;
                  add_header Cache-Control "public, immutable";
              }

              # HTML files - no cache for fresh reports
              location ~* \.html$ {
                  expires -1;
                  add_header Cache-Control "no-store, no-cache, must-revalidate";
              }
          }

          # Redirect Storybook to GitHub Pages (built by GitHub Actions)
          location /storybook {
              return 301 https://antialias.github.io/abaci-one/;
          }
          location /storybook/ {
              return 301 https://antialias.github.io/abaci-one/;
          }

          # Redirect coverage to GitHub Pages
          location /coverage {
              return 301 https://antialias.github.io/abaci-one/coverage/;
          }
          location /coverage/ {
              return 301 https://antialias.github.io/abaci-one/coverage/;
          }

          # Health check endpoint
          location /health {
              return 200 'ok';
              add_header Content-Type text/plain;
          }
      }
    EOT

    "index.html" = <<-EOT
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Abaci Dev Portal</title>
    <style>
        :root {
            --bg: #0f172a;
            --card-bg: #1e293b;
            --card-border: #334155;
            --text: #f1f5f9;
            --text-muted: #94a3b8;
            --accent: #38bdf8;
            --accent-hover: #7dd3fc;
            --green: #4ade80;
            --yellow: #facc15;
            --purple: #a78bfa;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            padding: 2rem;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
        }

        header {
            text-align: center;
            margin-bottom: 3rem;
        }

        h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            background: linear-gradient(135deg, var(--accent), var(--purple));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .subtitle {
            color: var(--text-muted);
            font-size: 1.1rem;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1.5rem;
        }

        .card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 12px;
            padding: 1.5rem;
            transition: transform 0.2s, border-color 0.2s;
            text-decoration: none;
            color: inherit;
            display: block;
        }

        .card:hover {
            transform: translateY(-2px);
            border-color: var(--accent);
        }

        .card-icon {
            font-size: 2rem;
            margin-bottom: 1rem;
        }

        .card-title {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
            color: var(--text);
        }

        .card-desc {
            color: var(--text-muted);
            font-size: 0.9rem;
            line-height: 1.5;
        }

        .card-url {
            margin-top: 1rem;
            font-size: 0.8rem;
            color: var(--accent);
            font-family: 'SF Mono', Monaco, monospace;
        }

        .section-title {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--text-muted);
            margin-bottom: 1rem;
            margin-top: 2rem;
        }

        .badge {
            display: inline-block;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            margin-left: 0.5rem;
        }

        .badge-live { background: var(--green); color: #000; }
        .badge-soon { background: var(--yellow); color: #000; }

        footer {
            text-align: center;
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid var(--card-border);
            color: var(--text-muted);
            font-size: 0.9rem;
        }

        footer a {
            color: var(--accent);
            text-decoration: none;
        }

        footer a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Abaci Dev Portal</h1>
            <p class="subtitle">Development resources and monitoring tools</p>
        </header>

        <div class="section-title">Testing & QA</div>
        <div class="grid">
            <a href="/smoke-reports/" class="card">
                <div class="card-icon">🧪</div>
                <div class="card-title">Smoke Test Reports <span class="badge badge-live">Live</span></div>
                <div class="card-desc">Playwright E2E test results with screenshots, traces, and video recordings. Updated every 15 minutes.</div>
                <div class="card-url">/smoke-reports/</div>
            </a>

            <a href="/storybook/" class="card">
                <div class="card-icon">📚</div>
                <div class="card-title">Storybook <span class="badge badge-live">Live</span></div>
                <div class="card-desc">Interactive component library with documentation, props tables, and live examples. Hosted on GitHub Pages.</div>
                <div class="card-url">GitHub Pages</div>
            </a>

            <a href="https://antialias.github.io/abaci-one/coverage/" class="card">
                <div class="card-icon">📊</div>
                <div class="card-title">Test Coverage <span class="badge badge-live">Live</span></div>
                <div class="card-desc">Code coverage reports showing tested vs untested code paths. Updated on every push to main.</div>
                <div class="card-url">GitHub Pages</div>
            </a>
        </div>

        <div class="section-title">Monitoring</div>
        <div class="grid">
            <a href="https://grafana.dev.abaci.one" class="card">
                <div class="card-icon">📈</div>
                <div class="card-title">Grafana <span class="badge badge-live">Live</span></div>
                <div class="card-desc">Dashboards for application metrics, performance monitoring, and alerting.</div>
                <div class="card-url">grafana.dev.abaci.one</div>
            </a>

            <a href="https://prometheus.dev.abaci.one" class="card">
                <div class="card-icon">🔥</div>
                <div class="card-title">Prometheus <span class="badge badge-live">Live</span></div>
                <div class="card-desc">Metrics storage and PromQL query interface for debugging and analysis.</div>
                <div class="card-url">prometheus.dev.abaci.one</div>
            </a>

            <a href="https://status.abaci.one" class="card">
                <div class="card-icon">🟢</div>
                <div class="card-title">Status Page <span class="badge badge-live">Live</span></div>
                <div class="card-desc">Public uptime monitoring and incident status powered by Gatus.</div>
                <div class="card-url">status.abaci.one</div>
            </a>
        </div>

        <div class="section-title">Quick Links</div>
        <div class="grid">
            <a href="https://abaci.one" class="card">
                <div class="card-icon">🧮</div>
                <div class="card-title">Production App</div>
                <div class="card-desc">The live Abaci flashcards application.</div>
                <div class="card-url">abaci.one</div>
            </a>

            <a href="https://github.com/antialias/soroban-abacus-flashcards" class="card">
                <div class="card-icon">🐙</div>
                <div class="card-title">GitHub Repository</div>
                <div class="card-desc">Source code, issues, and pull requests.</div>
                <div class="card-url">github.com/antialias/...</div>
            </a>
        </div>

        <footer>
            <p>Built with ❤️ for learning math with the soroban abacus</p>
            <p style="margin-top: 0.5rem;">
                <a href="https://abaci.one">abaci.one</a>
            </p>
        </footer>
    </div>
</body>
</html>
    EOT
  }
}

# nginx Deployment
resource "kubernetes_deployment" "dev_artifacts" {
  metadata {
    name      = "dev-artifacts"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    labels = {
      app = "dev-artifacts"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "dev-artifacts"
      }
    }

    template {
      metadata {
        labels = {
          app = "dev-artifacts"
        }
      }

      spec {
        container {
          name  = "nginx"
          image = "nginx:1.25-alpine"

          port {
            container_port = 80
          }

          volume_mount {
            name       = "artifacts"
            mount_path = "/usr/share/nginx/html"
            read_only  = true
          }

          volume_mount {
            name       = "nginx-config"
            mount_path = "/etc/nginx/conf.d/default.conf"
            sub_path   = "default.conf"
            read_only  = true
          }

          volume_mount {
            name       = "nginx-config"
            mount_path = "/usr/share/nginx/static/index.html"
            sub_path   = "index.html"
            read_only  = true
          }

          resources {
            requests = {
              memory = "32Mi"
              cpu    = "10m"
            }
            limits = {
              memory = "64Mi"
              cpu    = "100m"
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 80
            }
            initial_delay_seconds = 5
            period_seconds        = 30
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 80
            }
            initial_delay_seconds = 2
            period_seconds        = 10
          }
        }

        volume {
          name = "artifacts"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.dev_artifacts.metadata[0].name
          }
        }

        volume {
          name = "nginx-config"
          config_map {
            name = kubernetes_config_map.dev_artifacts_nginx.metadata[0].name
          }
        }
      }
    }
  }
}

# Service for nginx
resource "kubernetes_service" "dev_artifacts" {
  metadata {
    name      = "dev-artifacts"
    namespace = kubernetes_namespace.abaci.metadata[0].name
  }

  spec {
    selector = {
      app = "dev-artifacts"
    }

    port {
      port        = 80
      target_port = 80
    }

    type = "ClusterIP"
  }
}

# Ingress for dev.abaci.one
resource "kubernetes_ingress_v1" "dev_artifacts" {
  metadata {
    name      = "dev-artifacts"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    annotations = {
      "cert-manager.io/cluster-issuer"                   = var.use_staging_certs ? "letsencrypt-staging" : "letsencrypt-prod"
      "traefik.ingress.kubernetes.io/router.entrypoints" = "websecure"
      "traefik.ingress.kubernetes.io/router.middlewares" = "${kubernetes_namespace.abaci.metadata[0].name}-hsts@kubernetescrd"
    }
  }

  spec {
    ingress_class_name = "traefik"

    tls {
      hosts       = ["dev.${var.app_domain}"]
      secret_name = "dev-artifacts-tls"
    }

    rule {
      host = "dev.${var.app_domain}"

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.dev_artifacts.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }

  depends_on = [null_resource.cert_manager_issuers]
}

# HTTP to HTTPS redirect for dev subdomain
resource "kubernetes_ingress_v1" "dev_artifacts_http_redirect" {
  metadata {
    name      = "dev-artifacts-http-redirect"
    namespace = kubernetes_namespace.abaci.metadata[0].name
    annotations = {
      "traefik.ingress.kubernetes.io/router.entrypoints" = "web"
      "traefik.ingress.kubernetes.io/router.middlewares" = "${kubernetes_namespace.abaci.metadata[0].name}-redirect-https@kubernetescrd"
    }
  }

  spec {
    ingress_class_name = "traefik"

    rule {
      host = "dev.${var.app_domain}"

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.dev_artifacts.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }
}
