output "namespace" {
  description = "The namespace created for abaci workloads"
  value       = kubernetes_namespace.abaci.metadata[0].name
}

output "app_service" {
  description = "App service details"
  value = {
    name      = kubernetes_service.app.metadata[0].name
    namespace = kubernetes_service.app.metadata[0].namespace
    port      = 80
  }
}

output "redis_service" {
  description = "Redis service details"
  value = {
    name      = kubernetes_service.redis.metadata[0].name
    namespace = kubernetes_service.redis.metadata[0].namespace
    url       = "redis://redis.${kubernetes_namespace.abaci.metadata[0].name}.svc.cluster.local:6379"
  }
}

output "ingress_info" {
  description = "Ingress information"
  value = {
    domain     = var.app_domain
    tls_secret = "abaci-tls"
  }
}

output "stripe_info" {
  description = "Stripe resource IDs (empty when Stripe is disabled)"
  value = local.stripe_enabled ? {
    product_id       = stripe_product.family[0].id
    monthly_price_id = stripe_price.family_monthly[0].id
    annual_price_id  = stripe_price.family_annual[0].id
    webhook_url      = stripe_webhook_endpoint.app[0].url
  } : null
}

output "switchover_checklist" {
  description = "Steps to switch traffic from Docker to k8s"
  value       = <<-EOT
    To switch traffic from Docker Compose to k8s:

    1. Ensure k8s pods are healthy:
       kubectl get pods -n abaci

    2. Update port forwarding on router:
       - Forward ports 80 and 443 to k3s-node VM (192.168.86.37)
       - Or update DNS to point to VM's public IP

    3. Verify SSL certificate is issued:
       kubectl get certificate -n abaci

    4. Test the site via k8s

    5. To rollback: revert port forwarding to NAS
  EOT
}
