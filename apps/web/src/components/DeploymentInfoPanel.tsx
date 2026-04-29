'use client'

import { DeploymentInfoModal, DeploymentInfoContent } from '@tidepool/debug-panel'
import { useAbacusDeploymentInfo } from '@/hooks/useAbacusDeploymentInfo'

/**
 * Renders the deployment info modal + content.
 * Must be inside a DeploymentInfoProvider (set up in ClientProviders).
 */
export function DeploymentInfoPanel() {
  const { data, isLoading, error } = useAbacusDeploymentInfo()
  return (
    <DeploymentInfoModal>
      <DeploymentInfoContent data={data} isLoading={isLoading} error={error} />
    </DeploymentInfoModal>
  )
}
