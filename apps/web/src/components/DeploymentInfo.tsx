'use client'

import { useDeploymentInfo } from '@/contexts/DeploymentInfoContext'
import { DeploymentInfoContent } from './DeploymentInfoContent'
import { DeploymentInfoModal } from './DeploymentInfoModal'

export function DeploymentInfo() {
  const { isOpen, toggle } = useDeploymentInfo()

  return (
    <DeploymentInfoModal externalOpen={isOpen} onExternalOpenChange={toggle}>
      <DeploymentInfoContent />
    </DeploymentInfoModal>
  )
}
