import { FeatureFlagsClient } from './FeatureFlagsClient'

/**
 * Admin page for managing feature flags.
 *
 * Global on/off toggles with optional JSON config for feature gating.
 */
export default function FeatureFlagsPage() {
  return <FeatureFlagsClient />
}
