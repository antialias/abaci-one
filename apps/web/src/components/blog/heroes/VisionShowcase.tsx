'use client'

import { css } from '../../../../styled-system/css'
import { AbacusReact } from '@soroban/abacus-react'

/**
 * Hero component showcasing three vision features:
 * 1. Camera crop / observation mode
 * 2. Virtual abacus mirror (bead recognition)
 * 3. ArUco tag auto-crop calibration
 */
export default function VisionShowcase() {
  return (
    <div
      data-component="vision-showcase"
      className={css({
        display: 'flex',
        width: '100%',
        height: '100%',
        bg: '#0d1117',
        overflow: 'hidden',
      })}
    >
      {/* Panel 1: Observation Mode */}
      <div
        data-element="panel-observation"
        className={css({
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(255,255,255,0.1)',
          position: 'relative',
          overflow: 'hidden',
        })}
      >
        <PanelLabel>Observation Mode</PanelLabel>
        <div
          className={css({
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bg: '#111827',
          })}
        >
          <div className={css({ transform: 'scale(0.7)', transformOrigin: 'center' })}>
            <AbacusReact
              value={42}
              columns={5}
              interactive={false}
              animated={false}
              showNumbers={false}
            />
          </div>

          {/* Vision badge */}
          <div
            data-element="vision-badge"
            className={css({
              position: 'absolute',
              top: '6px',
              left: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              px: '6px',
              py: '2px',
              bg: 'rgba(0, 0, 0, 0.6)',
              borderRadius: '4px',
              fontSize: '10px',
              color: '#22d3ee',
            })}
          >
            <span>📷</span>
            <span>Vision</span>
          </div>

          {/* Detection overlay */}
          <div
            data-element="detection-overlay"
            className={css({
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              px: '8px',
              py: '4px',
              bg: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(4px)',
            })}
          >
            <div className={css({ display: 'flex', alignItems: 'center', gap: '6px' })}>
              <span
                className={css({
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: 'white',
                  fontFamily: 'mono',
                })}
              >
                42
              </span>
              <span className={css({ fontSize: '9px', color: '#9ca3af' })}>94%</span>
            </div>
            <div className={css({ display: 'flex', alignItems: 'center', gap: '4px' })}>
              <div
                className={css({
                  w: '6px',
                  h: '6px',
                  borderRadius: 'full',
                  bg: '#22c55e',
                  animation: 'pulse 2s infinite',
                })}
              />
              <span className={css({ fontSize: '9px', color: '#4ade80' })}>Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* Panel 2: Mirror Mode */}
      <div
        data-element="panel-mirror"
        className={css({
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(255,255,255,0.1)',
          position: 'relative',
          overflow: 'hidden',
        })}
      >
        <PanelLabel>Mirror Mode</PanelLabel>
        <div
          className={css({
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bg: '#111827',
            p: '4px',
          })}
        >
          <div className={css({ transform: 'scale(0.7)', transformOrigin: 'center' })}>
            <AbacusReact
              value={42}
              columns={5}
              interactive={false}
              animated={false}
              showNumbers={true}
              colorScheme="place-value"
            />
          </div>

          {/* Small camera preview thumbnail */}
          <div
            data-element="video-preview-thumb"
            className={css({
              position: 'absolute',
              bottom: '6px',
              right: '6px',
              width: '40px',
              height: '32px',
              borderRadius: '4px',
              overflow: 'hidden',
              border: '1.5px solid rgba(255,255,255,0.6)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              bg: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <div className={css({ transform: 'scale(0.15)', transformOrigin: 'center' })}>
              <AbacusReact
                value={42}
                columns={5}
                interactive={false}
                animated={false}
                showNumbers={false}
              />
            </div>
          </div>

          {/* Stable value badge */}
          <div
            data-element="stable-badge"
            className={css({
              position: 'absolute',
              top: '6px',
              right: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              px: '6px',
              py: '2px',
              bg: 'rgba(0, 0, 0, 0.6)',
              borderRadius: '4px',
            })}
          >
            <div
              className={css({
                w: '6px',
                h: '6px',
                borderRadius: 'full',
                bg: '#22c55e',
              })}
            />
            <span className={css({ fontSize: '9px', color: '#4ade80', fontWeight: 600 })}>
              Stable
            </span>
          </div>
        </div>
      </div>

      {/* Panel 3: ArUco Auto-Crop */}
      <div
        data-element="panel-autocrop"
        className={css({
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        })}
      >
        <PanelLabel>Auto-Crop Calibration</PanelLabel>
        <div
          className={css({
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bg: '#111827',
          })}
        >
          <div className={css({ transform: 'scale(0.7)', transformOrigin: 'center' })}>
            <AbacusReact
              value={42}
              columns={5}
              interactive={false}
              animated={false}
              showNumbers={false}
            />
          </div>

          {/* SVG calibration overlay */}
          <svg
            data-element="calibration-overlay"
            viewBox="0 0 200 100"
            preserveAspectRatio="none"
            className={css({
              position: 'absolute',
              inset: '20% 8% 15% 8%',
              pointerEvents: 'none',
            })}
          >
            {/* Darkened mask outside quad */}
            <defs>
              <mask id="hero-quad-mask">
                <rect width="200" height="100" fill="white" />
                <polygon points="8,8 192,5 195,92 5,95" fill="black" />
              </mask>
            </defs>
            <rect width="200" height="100" fill="rgba(0,0,0,0.4)" mask="url(#hero-quad-mask)" />

            {/* Green quadrilateral border */}
            <polygon
              points="8,8 192,5 195,92 5,95"
              fill="none"
              stroke="#4ade80"
              strokeWidth="1.5"
              strokeDasharray="6,3"
            />

            {/* Yellow column dividers */}
            <line x1="46" y1="7" x2="43" y2="93" stroke="#facc15" strokeWidth="1.5" />
            <line x1="84" y1="6" x2="83" y2="93" stroke="#facc15" strokeWidth="1.5" />
            <line x1="122" y1="6" x2="122" y2="93" stroke="#facc15" strokeWidth="1.5" />
            <line x1="158" y1="5" x2="160" y2="93" stroke="#facc15" strokeWidth="1.5" />

            {/* Cyan beam line */}
            <line
              x1="7"
              y1="28"
              x2="194"
              y2="26"
              stroke="#22d3ee"
              strokeWidth="1"
              strokeDasharray="3,3"
              opacity="0.7"
            />
          </svg>

          {/* Corner handles */}
          <CornerHandle style={{ top: '18%', left: '6%' }} />
          <CornerHandle style={{ top: '16%', right: '6%' }} />
          <CornerHandle style={{ bottom: '13%', left: '5.5%' }} />
          <CornerHandle style={{ bottom: '11%', right: '5.5%' }} />

          {/* ArUco marker indicators */}
          <ArucoMarker style={{ top: '17%', left: '3%' }} id={0} />
          <ArucoMarker style={{ top: '15%', right: '3%' }} id={1} />
          <ArucoMarker style={{ bottom: '12%', right: '3%' }} id={2} />
          <ArucoMarker style={{ bottom: '14%', left: '3%' }} id={3} />

          {/* Marker count badge */}
          <div
            data-element="marker-badge"
            className={css({
              position: 'absolute',
              top: '6px',
              left: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              px: '6px',
              py: '2px',
              bg: 'rgba(0, 0, 0, 0.6)',
              borderRadius: '4px',
              fontSize: '9px',
              color: '#4ade80',
              fontWeight: 600,
            })}
          >
            4/4 markers
          </div>
        </div>
      </div>
    </div>
  )
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-element="panel-label"
      className={css({
        px: '8px',
        py: '3px',
        bg: 'rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        fontSize: '10px',
        fontWeight: 600,
        color: '#9ca3af',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        textAlign: 'center',
      })}
    >
      {children}
    </div>
  )
}

function CornerHandle({ style }: { style: React.CSSProperties }) {
  return (
    <div
      data-element="corner-handle"
      style={{
        ...style,
        position: 'absolute',
        width: '8px',
        height: '8px',
        backgroundColor: '#4ade80',
        border: '1.5px solid white',
        borderRadius: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}
    />
  )
}

function ArucoMarker({ style, id }: { style: React.CSSProperties; id: number }) {
  return (
    <div
      data-element="aruco-marker"
      style={{
        ...style,
        position: 'absolute',
        pointerEvents: 'none',
      }}
    >
      {/* Tiny stylized ArUco-like marker */}
      <svg width="12" height="12" viewBox="0 0 12 12">
        <rect width="12" height="12" fill="black" />
        <rect x="1" y="1" width="10" height="10" fill="white" />
        <rect x="2" y="2" width="8" height="8" fill="black" />
        {/* Unique pattern per marker ID */}
        {id === 0 && <rect x="3" y="3" width="2" height="2" fill="white" />}
        {id === 0 && <rect x="7" y="7" width="2" height="2" fill="white" />}
        {id === 1 && <rect x="7" y="3" width="2" height="2" fill="white" />}
        {id === 1 && <rect x="3" y="7" width="2" height="2" fill="white" />}
        {id === 2 && <rect x="3" y="3" width="2" height="6" fill="white" />}
        {id === 3 && <rect x="3" y="3" width="6" height="2" fill="white" />}
      </svg>
    </div>
  )
}
