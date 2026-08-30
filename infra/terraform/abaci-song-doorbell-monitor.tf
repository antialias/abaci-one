# =============================================================================
# abaci → Yoto song sync — doorbell receiver scrape
# =============================================================================
# The abaci.one easter egg: when a kid's session song is generated, it lands on
# that kid's Yoto card. abaci emits a detached HMAC ping after each committed
# song mutation; the receiver on the NAS (192.168.86.51:9117) debounces those
# into runs of the sync engine. Pure event-driven — there is no cron anywhere in
# the chain, by explicit design.
#
# That design is also why this scrape exists. Nothing in the pipeline speaks up:
# the emitter is fire-and-forget, the receiver's child output is reduced to byte
# counts (it can carry credentials), and OpenClaw has no record of any of it. The
# scrape is the only observability the system has.
#
#   1. Scrape — headless Service + manual Endpoints + ServiceMonitor
#      (job="abaci-song-doorbell"), same off-cluster idiom as claude-usage.
#   2. No alert rules. Alerting is saturated pending platform#13, and the rule
#      against piecemeal alerts applies here too. The metrics carry the two
#      verdicts `abaci_song_sync status --check` would give — yoto_auth_broken
#      and abaci_auth_ok — so a rule is a one-liner whenever that unparks.
#
# Receiver + engine source live elsewhere: home-infra
# services/abaci-song-doorbell (receiver, deploy.sh) and the openclaw-skills repo
# (suzuki-tracks/scripts/abaci_song_sync.py). Only the scrape belongs here.
#
# Same null_resource + idempotent-kubectl idiom as claude-usage-monitor.tf
# (avoids kubernetes_manifest CRD-at-plan-time issues).

resource "null_resource" "abaci_song_doorbell_scrape" {
  depends_on = [helm_release.kube_prometheus_stack]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}
      kubectl wait --for=condition=Established crd/servicemonitors.monitoring.coreos.com --timeout=120s
      kubectl apply -f ${path.module}/files/abaci-song-doorbell-scrape.yaml
    EOT
  }

  triggers = {
    manifest = filemd5("${path.module}/files/abaci-song-doorbell-scrape.yaml")
  }
}
