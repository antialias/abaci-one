# =============================================================================
# k3s node-health alerts — fast NotReady page + CPU-steal early warning
# =============================================================================
# Born from the 2026-07-18 abaci.one 502 storm: an eink-photo-frame CI run on
# this VM plus hypervisor steal (the VM owns ALL 4 hardware threads of the
# DS923+) starved kine until the node went NotReady for ~3 minutes, svclb
# withdrew the traefik LB IP, and NAS Traefik 502'd every route. The stock
# KubeNodeNotReady rule (for: 15m) never fired. Details: home-infra memory
# project_k3s_notready_502_2026_07_18.
#
#   K3sNodeNotReadyFast (for: 1m)  -> delivery=critical (HA iOS push + Telegram)
#   K3sHighCpuSteal     (for: 10m) -> delivery=telegram (leading indicator)
#
# Delivery goes through the NAS alert-bridge (192.168.86.51:9116) via the
# alertroute="k3s-node" AlertmanagerConfig, same chain as claude-usage-monitor.tf
# — see that file's header for the tiering philosophy (one critical per concern).
#
# Same null_resource + idempotent-kubectl idiom as dns-probe-monitor.tf (avoids
# kubernetes_manifest CRD-at-plan-time issues; no import step needed).

resource "null_resource" "k3s_node_health_alerts" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl wait --for=condition=Established crd/prometheusrules.monitoring.coreos.com --timeout=120s
      kubectl apply -f ${path.module}/files/k3s-node-health-rule.yaml
    EOT
  }

  triggers = {
    rule = filemd5("${path.module}/files/k3s-node-health-rule.yaml")
  }
}

resource "null_resource" "k3s_node_health_alertmanagerconfig" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl wait --for=condition=Established crd/alertmanagerconfigs.monitoring.coreos.com --timeout=120s
      kubectl apply -f ${path.module}/files/k3s-node-health-alertmanagerconfig.yaml
    EOT
  }

  triggers = {
    amconfig = filemd5("${path.module}/files/k3s-node-health-alertmanagerconfig.yaml")
  }
}
