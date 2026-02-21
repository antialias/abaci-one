# Stripe billing resources
#
# Creates the Family Plan product, monthly/annual prices, and webhook endpoint.
# All resources are conditional on stripe_secret_key being set — when empty,
# nothing is created and the app runs without paid features.

locals {
  stripe_enabled = var.stripe_secret_key != ""
}

# ---------------------------------------------------------------------------
# Product
# ---------------------------------------------------------------------------

resource "stripe_product" "family" {
  count = local.stripe_enabled ? 1 : 0

  name        = "Abaci Family Plan"
  description = "Unlimited students, longer sessions, and more worksheet parsing."
}

# ---------------------------------------------------------------------------
# Prices
# ---------------------------------------------------------------------------

resource "stripe_price" "family_monthly" {
  count = local.stripe_enabled ? 1 : 0

  product     = stripe_product.family[0].id
  currency    = "usd"
  unit_amount = 600 # $6.00

  recurring {
    interval       = "month"
    interval_count = 1
  }
}

resource "stripe_price" "family_annual" {
  count = local.stripe_enabled ? 1 : 0

  product     = stripe_product.family[0].id
  currency    = "usd"
  unit_amount = 5000 # $50.00

  recurring {
    interval       = "year"
    interval_count = 1
  }
}

# ---------------------------------------------------------------------------
# Webhook endpoint
# ---------------------------------------------------------------------------

resource "stripe_webhook_endpoint" "app" {
  count = local.stripe_enabled ? 1 : 0

  url = "https://${var.app_domain}/api/billing/webhook"

  enabled_events = [
    "checkout.session.completed",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_failed",
  ]

  description = "Abaci billing webhook (managed by Terraform)"
}
