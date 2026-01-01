'use client'

import { useMyAbacus } from '@/contexts/MyAbacusContext'
import { css } from '../../../styled-system/css'
import { AbacusVisionBridge } from './AbacusVisionBridge'

/**
 * Modal for configuring abacus vision settings
 *
 * Renders AbacusVisionBridge directly in a draggable modal.
 * The bridge component handles all camera/calibration configuration.
 */
export function VisionSetupModal() {
  const {
    isVisionSetupOpen,
    closeVisionSetup,
    visionConfig,
    isVisionSetupComplete,
    setVisionEnabled,
    setVisionCamera,
    setVisionCalibration,
    setVisionRemoteSession,
    dock,
  } = useMyAbacus()

  const handleClearSettings = () => {
    setVisionCamera(null)
    setVisionCalibration(null)
    setVisionRemoteSession(null)
    setVisionEnabled(false)
  }

  const handleToggleVision = () => {
    setVisionEnabled(!visionConfig.enabled)
  }

  if (!isVisionSetupOpen) return null

  return (
    <div
      data-component="vision-setup-modal"
      className={css({
        position: 'fixed',
        inset: 0,
        bg: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      })}
      onClick={closeVisionSetup}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          closeVisionSetup()
        }
      }}
    >
      {/* AbacusVisionBridge is a motion.div with drag - stopPropagation prevents backdrop close */}
      <div onClick={(e) => e.stopPropagation()}>
        <AbacusVisionBridge
          columnCount={dock?.columns ?? 5}
          onValueDetected={() => {
            // Value detected - configuration is working
          }}
          onClose={closeVisionSetup}
          onConfigurationChange={(config) => {
            // Save configuration to context as it changes
            if (config.cameraDeviceId !== undefined) {
              setVisionCamera(config.cameraDeviceId)
            }
            if (config.calibration !== undefined) {
              setVisionCalibration(config.calibration)
            }
            if (config.remoteCameraSessionId !== undefined) {
              setVisionRemoteSession(config.remoteCameraSessionId)
            }
          }}
          // Start with phone camera selected if remote session is configured but no local camera
          initialCameraSource={
            visionConfig.remoteCameraSessionId && !visionConfig.cameraDeviceId ? 'phone' : 'local'
          }
          // Show enable/disable and clear buttons
          showVisionControls={true}
          isVisionEnabled={visionConfig.enabled}
          isVisionSetupComplete={isVisionSetupComplete}
          onToggleVision={handleToggleVision}
          onClearSettings={handleClearSettings}
        />
      </div>
    </div>
  )
}
