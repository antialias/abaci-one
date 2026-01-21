# cert-manager for automatic Let's Encrypt SSL certificates

resource "helm_release" "cert_manager" {
  name             = "cert-manager"
  repository       = "https://charts.jetstack.io"
  chart            = "cert-manager"
  namespace        = "cert-manager"
  create_namespace = true
  version          = "v1.14.4"

  set {
    name  = "installCRDs"
    value = "true"
  }

  set {
    name  = "global.leaderElection.namespace"
    value = "cert-manager"
  }
}

# ClusterIssuers need to be applied after cert-manager CRDs are installed
# Using local-exec since kubernetes_manifest validates CRDs at plan time

resource "null_resource" "cert_manager_issuers" {
  depends_on = [helm_release.cert_manager]

  provisioner "local-exec" {
    command = <<-EOT
      export KUBECONFIG=${pathexpand(var.kubeconfig_path)}

      # Wait for cert-manager webhook to be ready
      kubectl wait --for=condition=Available deployment/cert-manager-webhook -n cert-manager --timeout=120s

      # Apply ClusterIssuers
      cat <<EOF | kubectl apply -f -
      apiVersion: cert-manager.io/v1
      kind: ClusterIssuer
      metadata:
        name: letsencrypt-prod
      spec:
        acme:
          server: https://acme-v02.api.letsencrypt.org/directory
          email: ${var.letsencrypt_email}
          privateKeySecretRef:
            name: letsencrypt-prod-key
          solvers:
          - http01:
              ingress:
                class: traefik
      ---
      apiVersion: cert-manager.io/v1
      kind: ClusterIssuer
      metadata:
        name: letsencrypt-staging
      spec:
        acme:
          server: https://acme-staging-v02.api.letsencrypt.org/directory
          email: ${var.letsencrypt_email}
          privateKeySecretRef:
            name: letsencrypt-staging-key
          solvers:
          - http01:
              ingress:
                class: traefik
      EOF
    EOT
  }

  triggers = {
    email = var.letsencrypt_email
  }
}
