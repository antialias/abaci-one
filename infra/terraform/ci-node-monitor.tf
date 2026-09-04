# ci-node runs the external Woodpecker agent at 192.168.86.34. Its host metrics
# are exported by the platform repo's ci-memory-guard role and scraped here using
# the same off-cluster Service/Endpoints/ServiceMonitor pattern as the DNS and
# Claude usage exporters.
resource "null_resource" "ci_node_scrape" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl wait --for=condition=Established crd/servicemonitors.monitoring.coreos.com --timeout=120s
      kubectl apply -f ${path.module}/files/ci-node-scrape.yaml
    EOT
  }

  triggers = {
    manifest = filemd5("${path.module}/files/ci-node-scrape.yaml")
  }
}

resource "null_resource" "ci_node_alerts" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl wait --for=condition=Established crd/prometheusrules.monitoring.coreos.com --timeout=120s
      kubectl apply -f ${path.module}/files/ci-node-rule.yaml
    EOT
  }

  triggers = {
    rule = filemd5("${path.module}/files/ci-node-rule.yaml")
  }
}

resource "null_resource" "ci_node_alertmanagerconfig" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl wait --for=condition=Established crd/alertmanagerconfigs.monitoring.coreos.com --timeout=120s
      kubectl apply -f ${path.module}/files/ci-node-alertmanagerconfig.yaml
    EOT
  }

  triggers = {
    amconfig = filemd5("${path.module}/files/ci-node-alertmanagerconfig.yaml")
  }
}
