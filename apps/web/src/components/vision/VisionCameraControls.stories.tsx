import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { css } from '../../../styled-system/css'

// =============================================================================
// Mock Types (matching the real implementation)
// =============================================================================

interface MockDevice {
  deviceId: string
  label: string
}

type CameraSource = 'local' | 'phone'

// =============================================================================
// Mock Camera Controls Component
// =============================================================================

interface VisionCameraControlsProps {
  /** Camera source: local or phone */
  cameraSource: CameraSource
  /** Available camera devices */
  availableDevices: MockDevice[]
  /** Currently selected device ID */
  selectedDeviceId: string | null
  /** Whether torch is available */
  isTorchAvailable: boolean
  /** Whether torch is on */
  isTorchOn: boolean
  /** Current facing mode */
  facingMode: 'user' | 'environment'
  /** Whether phone is connected (for remote camera) */
  isPhoneConnected?: boolean
  /** Remote torch available */
  remoteTorchAvailable?: boolean
  /** Remote torch on */
  remoteTorchOn?: boolean
  /** Callback when camera is selected */
  onCameraSelect?: (deviceId: string) => void
  /** Callback when camera is flipped */
  onFlipCamera?: () => void
  /** Callback when torch is toggled */
  onToggleTorch?: () => void
  /** Callback when camera source changes */
  onCameraSourceChange?: (source: CameraSource) => void
}

/**
 * VisionCameraControls - UI for camera selection, torch control, and camera source toggle
 *
 * This component demonstrates the unified camera controls that appear in AbacusVisionBridge:
 * - Camera selector dropdown (always visible for local camera, even with 1 device)
 * - Flip camera button (only when multiple cameras available)
 * - Unified torch button (works for both local and remote cameras)
 * - Camera source toggle (local vs phone)
 */
function VisionCameraControls({
  cameraSource,
  availableDevices,
  selectedDeviceId,
  isTorchAvailable,
  isTorchOn,
  facingMode,
  isPhoneConnected = false,
  remoteTorchAvailable = false,
  remoteTorchOn = false,
  onCameraSelect,
  onFlipCamera,
  onToggleTorch,
  onCameraSourceChange,
}: VisionCameraControlsProps) {
  // Determine if torch button should show
  const showTorchButton =
    (cameraSource === 'local' && isTorchAvailable) ||
    (cameraSource === 'phone' && isPhoneConnected && remoteTorchAvailable)

  // Get current torch state based on source
  const currentTorchOn = cameraSource === 'local' ? isTorchOn : remoteTorchOn

  return (
    <div
      data-component="vision-camera-controls"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        p: 4,
        bg: 'gray.900',
        borderRadius: 'xl',
        maxWidth: '400px',
        width: '100%',
      })}
    >
      {/* Header */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        })}
      >
        <span className={css({ fontSize: 'lg' })}>📷</span>
        <span className={css({ color: 'white', fontWeight: 'medium' })}>Camera Controls</span>
      </div>

      {/* Camera source selector */}
      <div
        data-element="camera-source"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          bg: 'gray.800',
          borderRadius: 'md',
        })}
      >
        <span className={css({ color: 'gray.400', fontSize: 'sm' })}>Source:</span>
        <button
          type="button"
          onClick={() => onCameraSourceChange?.('local')}
          className={css({
            px: 3,
            py: 1,
            fontSize: 'sm',
            border: 'none',
            borderRadius: 'md',
            cursor: 'pointer',
            bg: cameraSource === 'local' ? 'blue.600' : 'gray.700',
            color: 'white',
            _hover: { bg: cameraSource === 'local' ? 'blue.500' : 'gray.600' },
          })}
        >
          Local Camera
        </button>
        <button
          type="button"
          onClick={() => onCameraSourceChange?.('phone')}
          className={css({
            px: 3,
            py: 1,
            fontSize: 'sm',
            border: 'none',
            borderRadius: 'md',
            cursor: 'pointer',
            bg: cameraSource === 'phone' ? 'blue.600' : 'gray.700',
            color: 'white',
            _hover: { bg: cameraSource === 'phone' ? 'blue.500' : 'gray.600' },
          })}
        >
          Phone Camera
        </button>
      </div>

      {/* Camera controls - unified for both local and phone */}
      <div
        data-element="camera-controls"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        })}
      >
        {/* Camera selector - always show for local camera (even with 1 device) */}
        {cameraSource === 'local' && availableDevices.length > 0 && (
          <select
            data-element="camera-selector"
            value={selectedDeviceId ?? ''}
            onChange={(e) => onCameraSelect?.(e.target.value)}
            className={css({
              flex: 1,
              p: 2,
              bg: 'gray.800',
              color: 'white',
              border: '1px solid',
              borderColor: 'gray.600',
              borderRadius: 'md',
              fontSize: 'sm',
              minWidth: '150px',
            })}
          >
            {availableDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        )}

        {/* Flip camera button - only show if multiple cameras available */}
        {cameraSource === 'local' && availableDevices.length > 1 && (
          <button
            type="button"
            onClick={onFlipCamera}
            data-action="flip-camera"
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              bg: 'gray.700',
              color: 'white',
              border: 'none',
              borderRadius: 'md',
              cursor: 'pointer',
              fontSize: 'lg',
              _hover: { bg: 'gray.600' },
            })}
            title={`Switch to ${facingMode === 'environment' ? 'front' : 'back'} camera`}
          >
            🔄
          </button>
        )}

        {/* Torch toggle button - unified for both local and remote */}
        {showTorchButton && (
          <button
            type="button"
            onClick={onToggleTorch}
            data-action="toggle-torch"
            data-status={currentTorchOn ? 'on' : 'off'}
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              bg: currentTorchOn ? 'yellow.600' : 'gray.700',
              color: 'white',
              border: 'none',
              borderRadius: 'md',
              cursor: 'pointer',
              fontSize: 'lg',
              _hover: { bg: currentTorchOn ? 'yellow.500' : 'gray.600' },
            })}
            title={currentTorchOn ? 'Turn off flash' : 'Turn on flash'}
          >
            {currentTorchOn ? '🔦' : '💡'}
          </button>
        )}

        {/* Phone status when using phone camera */}
        {cameraSource === 'phone' && (
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 'sm',
              color: isPhoneConnected ? 'green.400' : 'gray.400',
            })}
          >
            <span
              className={css({
                width: 2,
                height: 2,
                borderRadius: 'full',
                bg: isPhoneConnected ? 'green.500' : 'gray.500',
              })}
            />
            {isPhoneConnected ? 'Phone Connected' : 'Waiting for phone...'}
          </div>
        )}
      </div>

      {/* Info about wide-angle preference */}
      <div
        data-element="wide-angle-info"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          bg: 'blue.900/50',
          borderRadius: 'md',
          fontSize: 'xs',
          color: 'blue.300',
        })}
      >
        <span>📐</span>
        <span>Cameras default to widest angle lens (zoom: 1)</span>
      </div>
    </div>
  )
}

// =============================================================================
// Storybook Meta
// =============================================================================

const meta: Meta<typeof VisionCameraControls> = {
  title: 'Vision/VisionCameraControls',
  component: VisionCameraControls,
  decorators: [
    (Story) => (
      <div
        className={css({
          padding: '2rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '300px',
          bg: 'gray.950',
        })}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'dark' },
  },
}

export default meta
type Story = StoryObj<typeof VisionCameraControls>

// =============================================================================
// Mock Data
// =============================================================================

const singleCamera: MockDevice[] = [{ deviceId: 'camera-1', label: 'FaceTime HD Camera' }]

const multipleCameras: MockDevice[] = [
  { deviceId: 'camera-1', label: 'FaceTime HD Camera' },
  { deviceId: 'camera-2', label: 'iPhone Continuity Camera (Wide)' },
  { deviceId: 'camera-3', label: 'iPhone Continuity Camera (Ultra Wide)' },
  { deviceId: 'camera-4', label: 'Desk View Camera' },
]

const iphoneCameras: MockDevice[] = [
  { deviceId: 'camera-wide', label: 'Back Camera (Wide)' },
  { deviceId: 'camera-ultrawide', label: 'Back Camera (Ultra Wide)' },
  { deviceId: 'camera-front', label: 'Front Camera' },
]

// =============================================================================
// Stories: Single Camera
// =============================================================================

export const SingleCameraNoTorch: Story = {
  name: 'Single Camera - No Torch',
  args: {
    cameraSource: 'local',
    availableDevices: singleCamera,
    selectedDeviceId: 'camera-1',
    isTorchAvailable: false,
    isTorchOn: false,
    facingMode: 'environment',
  },
}

export const SingleCameraWithTorch: Story = {
  name: 'Single Camera - With Torch',
  args: {
    cameraSource: 'local',
    availableDevices: singleCamera,
    selectedDeviceId: 'camera-1',
    isTorchAvailable: true,
    isTorchOn: false,
    facingMode: 'environment',
  },
}

export const SingleCameraTorchOn: Story = {
  name: 'Single Camera - Torch On',
  args: {
    cameraSource: 'local',
    availableDevices: singleCamera,
    selectedDeviceId: 'camera-1',
    isTorchAvailable: true,
    isTorchOn: true,
    facingMode: 'environment',
  },
}

// =============================================================================
// Stories: Multiple Cameras
// =============================================================================

export const MultipleCameras: Story = {
  name: 'Multiple Cameras - Desktop',
  args: {
    cameraSource: 'local',
    availableDevices: multipleCameras,
    selectedDeviceId: 'camera-2',
    isTorchAvailable: true,
    isTorchOn: false,
    facingMode: 'environment',
  },
}

export const MultipleCamerasUltraWideSelected: Story = {
  name: 'Multiple Cameras - Ultra Wide Selected',
  args: {
    cameraSource: 'local',
    availableDevices: multipleCameras,
    selectedDeviceId: 'camera-3',
    isTorchAvailable: true,
    isTorchOn: false,
    facingMode: 'environment',
  },
}

// =============================================================================
// Stories: Phone Camera
// =============================================================================

export const PhoneCameraWaiting: Story = {
  name: 'Phone Camera - Waiting for Connection',
  args: {
    cameraSource: 'phone',
    availableDevices: [],
    selectedDeviceId: null,
    isTorchAvailable: false,
    isTorchOn: false,
    facingMode: 'environment',
    isPhoneConnected: false,
    remoteTorchAvailable: false,
    remoteTorchOn: false,
  },
}

export const PhoneCameraConnected: Story = {
  name: 'Phone Camera - Connected',
  args: {
    cameraSource: 'phone',
    availableDevices: [],
    selectedDeviceId: null,
    isTorchAvailable: false,
    isTorchOn: false,
    facingMode: 'environment',
    isPhoneConnected: true,
    remoteTorchAvailable: true,
    remoteTorchOn: false,
  },
}

export const PhoneCameraTorchOn: Story = {
  name: 'Phone Camera - Torch On',
  args: {
    cameraSource: 'phone',
    availableDevices: [],
    selectedDeviceId: null,
    isTorchAvailable: false,
    isTorchOn: false,
    facingMode: 'environment',
    isPhoneConnected: true,
    remoteTorchAvailable: true,
    remoteTorchOn: true,
  },
}

// =============================================================================
// Stories: Interactive
// =============================================================================

function InteractiveCameraControls() {
  const [cameraSource, setCameraSource] = useState<CameraSource>('local')
  const [selectedDeviceId, setSelectedDeviceId] = useState('camera-2')
  const [isTorchOn, setIsTorchOn] = useState(false)
  const [remoteTorchOn, setRemoteTorchOn] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')

  return (
    <VisionCameraControls
      cameraSource={cameraSource}
      availableDevices={multipleCameras}
      selectedDeviceId={selectedDeviceId}
      isTorchAvailable={true}
      isTorchOn={isTorchOn}
      facingMode={facingMode}
      isPhoneConnected={true}
      remoteTorchAvailable={true}
      remoteTorchOn={remoteTorchOn}
      onCameraSourceChange={setCameraSource}
      onCameraSelect={setSelectedDeviceId}
      onFlipCamera={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
      onToggleTorch={() => {
        if (cameraSource === 'local') {
          setIsTorchOn((t) => !t)
        } else {
          setRemoteTorchOn((t) => !t)
        }
      }}
    />
  )
}

export const Interactive: Story = {
  name: 'Interactive Demo',
  render: () => <InteractiveCameraControls />,
}

// =============================================================================
// Stories: Feature Showcase
// =============================================================================

export const FeatureShowcase: Story = {
  name: 'Feature Showcase - All Features',
  render: () => (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        maxWidth: '800px',
      })}
    >
      <div
        className={css({
          p: 4,
          bg: 'gray.800',
          borderRadius: 'lg',
          color: 'white',
        })}
      >
        <h2 className={css({ fontSize: 'xl', fontWeight: 'bold', mb: 4 })}>
          Camera Control Features
        </h2>

        <div className={css({ display: 'flex', flexDirection: 'column', gap: 4 })}>
          <div>
            <h3
              className={css({
                fontSize: 'md',
                fontWeight: 'semibold',
                color: 'blue.300',
                mb: 2,
              })}
            >
              1. Camera Selector Always Visible
            </h3>
            <p className={css({ color: 'gray.400', fontSize: 'sm', mb: 2 })}>
              The camera dropdown now shows even with just 1 camera, so you can always see which
              device is selected.
            </p>
            <VisionCameraControls
              cameraSource="local"
              availableDevices={singleCamera}
              selectedDeviceId="camera-1"
              isTorchAvailable={false}
              isTorchOn={false}
              facingMode="environment"
            />
          </div>

          <div>
            <h3
              className={css({
                fontSize: 'md',
                fontWeight: 'semibold',
                color: 'yellow.300',
                mb: 2,
              })}
            >
              2. Unified Torch Control
            </h3>
            <p className={css({ color: 'gray.400', fontSize: 'sm', mb: 2 })}>
              The torch button works for both local and remote cameras. It automatically controls
              the active camera&apos;s flash.
            </p>
            <div className={css({ display: 'flex', gap: 4, flexWrap: 'wrap' })}>
              <VisionCameraControls
                cameraSource="local"
                availableDevices={singleCamera}
                selectedDeviceId="camera-1"
                isTorchAvailable={true}
                isTorchOn={true}
                facingMode="environment"
              />
              <VisionCameraControls
                cameraSource="phone"
                availableDevices={[]}
                selectedDeviceId={null}
                isTorchAvailable={false}
                isTorchOn={false}
                facingMode="environment"
                isPhoneConnected={true}
                remoteTorchAvailable={true}
                remoteTorchOn={true}
              />
            </div>
          </div>

          <div>
            <h3
              className={css({
                fontSize: 'md',
                fontWeight: 'semibold',
                color: 'green.300',
                mb: 2,
              })}
            >
              3. Wide-Angle Lens Preference
            </h3>
            <p className={css({ color: 'gray.400', fontSize: 'sm', mb: 2 })}>
              Cameras default to their widest field of view using{' '}
              <code className={css({ bg: 'gray.700', px: 1, borderRadius: 'sm' })}>
                zoom: &#123; ideal: 1 &#125;
              </code>{' '}
              constraint, ensuring you capture the full abacus.
            </p>
            <VisionCameraControls
              cameraSource="local"
              availableDevices={iphoneCameras}
              selectedDeviceId="camera-ultrawide"
              isTorchAvailable={true}
              isTorchOn={false}
              facingMode="environment"
            />
          </div>
        </div>
      </div>
    </div>
  ),
}

// =============================================================================
// Stories: Comparison
// =============================================================================

export const LocalVsPhoneComparison: Story = {
  name: 'Local vs Phone Camera Comparison',
  render: () => (
    <div className={css({ display: 'flex', gap: 6, flexWrap: 'wrap' })}>
      <div className={css({ display: 'flex', flexDirection: 'column', gap: 2 })}>
        <span
          className={css({
            color: 'white',
            fontSize: 'sm',
            fontWeight: 'bold',
          })}
        >
          Local Camera (Multiple)
        </span>
        <VisionCameraControls
          cameraSource="local"
          availableDevices={multipleCameras}
          selectedDeviceId="camera-2"
          isTorchAvailable={true}
          isTorchOn={false}
          facingMode="environment"
        />
      </div>

      <div className={css({ display: 'flex', flexDirection: 'column', gap: 2 })}>
        <span
          className={css({
            color: 'white',
            fontSize: 'sm',
            fontWeight: 'bold',
          })}
        >
          Phone Camera (Connected)
        </span>
        <VisionCameraControls
          cameraSource="phone"
          availableDevices={[]}
          selectedDeviceId={null}
          isTorchAvailable={false}
          isTorchOn={false}
          facingMode="environment"
          isPhoneConnected={true}
          remoteTorchAvailable={true}
          remoteTorchOn={false}
        />
      </div>
    </div>
  ),
}
