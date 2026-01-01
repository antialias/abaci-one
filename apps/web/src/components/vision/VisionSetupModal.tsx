'use client'

import { useState } from 'react'
import { useMyAbacus } from '@/contexts/MyAbacusContext'
import { Modal, ModalContent } from '@/components/common/Modal'
import { AbacusVisionBridge } from './AbacusVisionBridge'
import { css } from '../../../styled-system/css'

/**
 * Modal for configuring abacus vision settings
 *
 * Shows status and launches AbacusVisionBridge for configuration.
 * AbacusVisionBridge saves camera/calibration to MyAbacusContext.
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

  // State for showing the configuration UI
  const [isConfiguring, setIsConfiguring] = useState(false)

  const handleClearSettings = () => {
    setVisionCamera(null)
    setVisionCalibration(null)
    setVisionRemoteSession(null)
    setVisionEnabled(false)
  }

  return (
    <Modal isOpen={isVisionSetupOpen} onClose={closeVisionSetup}>
      <ModalContent
        title="📷 Abacus Vision"
        description="Use a camera to detect your physical abacus"
        borderColor="rgba(34, 211, 238, 0.3)"
        titleColor="rgba(34, 211, 238, 1)"
      >
        <div className={css({ display: 'flex', flexDirection: 'column', gap: 4 })}>
          {/* Status display */}
          <div
            data-element="vision-status"
            className={css({
              bg: 'rgba(0, 0, 0, 0.3)',
              borderRadius: 'lg',
              p: 4,
            })}
          >
            <h3 className={css({ fontSize: 'sm', fontWeight: 'bold', color: 'gray.300', mb: 2 })}>
              Status
            </h3>
            <div className={css({ display: 'flex', flexDirection: 'column', gap: 2 })}>
              <StatusRow
                label="Camera"
                value={visionConfig.cameraDeviceId ? 'Configured' : 'Not configured'}
                isConfigured={visionConfig.cameraDeviceId !== null}
              />
              <StatusRow
                label="Calibration"
                value={visionConfig.calibration ? 'Configured' : 'Not configured'}
                isConfigured={visionConfig.calibration !== null}
              />
              <StatusRow
                label="Remote Phone"
                value={visionConfig.remoteCameraSessionId ? 'Connected' : 'Not connected'}
                isConfigured={visionConfig.remoteCameraSessionId !== null}
              />
              <StatusRow
                label="Vision Mode"
                value={visionConfig.enabled ? 'Enabled' : 'Disabled'}
                isConfigured={visionConfig.enabled}
              />
            </div>
          </div>

          {/* Actions */}
          <div className={css({ display: 'flex', flexDirection: 'column', gap: 2 })}>
            {isVisionSetupComplete && (
              <button
                type="button"
                data-action="toggle-vision"
                onClick={() => {
                  setVisionEnabled(!visionConfig.enabled)
                }}
                className={css({
                  px: 4,
                  py: 3,
                  bg: visionConfig.enabled ? 'red.600' : 'green.600',
                  color: 'white',
                  borderRadius: 'lg',
                  fontWeight: 'semibold',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  _hover: {
                    bg: visionConfig.enabled ? 'red.700' : 'green.700',
                    transform: 'scale(1.02)',
                  },
                })}
              >
                {visionConfig.enabled ? 'Disable Vision' : 'Enable Vision'}
              </button>
            )}

            <button
              type="button"
              data-action="configure-camera"
              onClick={() => setIsConfiguring(true)}
              className={css({
                px: 4,
                py: 3,
                bg: 'cyan.600',
                color: 'white',
                borderRadius: 'lg',
                fontWeight: 'semibold',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                _hover: {
                  bg: 'cyan.700',
                  transform: 'scale(1.02)',
                },
              })}
            >
              {isVisionSetupComplete ? 'Reconfigure Camera' : 'Configure Camera & Calibration'}
            </button>

            {isVisionSetupComplete && (
              <button
                type="button"
                data-action="clear-settings"
                onClick={handleClearSettings}
                className={css({
                  px: 4,
                  py: 2,
                  bg: 'transparent',
                  color: 'gray.400',
                  borderRadius: 'lg',
                  fontWeight: 'medium',
                  border: '1px solid',
                  borderColor: 'gray.600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  _hover: {
                    borderColor: 'gray.500',
                    color: 'gray.300',
                  },
                })}
              >
                Clear All Settings
              </button>
            )}
          </div>

          {/* Close button */}
          <button
            type="button"
            data-action="close-modal"
            onClick={closeVisionSetup}
            className={css({
              mt: 2,
              px: 4,
              py: 2,
              bg: 'gray.700',
              color: 'white',
              borderRadius: 'lg',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                bg: 'gray.600',
              },
            })}
          >
            Close
          </button>
        </div>
      </ModalContent>

      {/* AbacusVisionBridge overlay for configuration */}
      {isConfiguring && (
        <div
          data-element="vision-config-overlay"
          className={css({
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bg: 'rgba(0, 0, 0, 0.8)',
            zIndex: 1000,
          })}
        >
          <AbacusVisionBridge
            columnCount={dock?.columns ?? 5}
            onValueDetected={(value) => {
              // Value detected - configuration is working
              console.log('[VisionSetupModal] Value detected:', value)
            }}
            onClose={() => setIsConfiguring(false)}
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
          />
        </div>
      )}
    </Modal>
  )
}

/**
 * Status row component
 */
function StatusRow({
  label,
  value,
  isConfigured,
}: {
  label: string
  value: string
  isConfigured: boolean
}) {
  return (
    <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
      <span className={css({ color: 'gray.400', fontSize: 'sm' })}>{label}</span>
      <span
        className={css({
          fontSize: 'sm',
          fontWeight: 'medium',
          color: isConfigured ? 'green.400' : 'gray.500',
        })}
      >
        {value}
      </span>
    </div>
  )
}
