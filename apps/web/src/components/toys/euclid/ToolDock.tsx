import type { MutableRefObject, RefObject } from 'react'
import type { ActiveTool, MacroPhase } from './types'
import { ToolButton } from './ToolButton'

interface MacroInfo {
  propId: number
  title: string
}

interface ToolDockProps {
  activeTool: ActiveTool
  setActiveTool: (t: ActiveTool) => void
  playgroundMode: boolean
  isComplete: boolean
  isMobile: boolean
  isToolDockActive: boolean
  setIsToolDockActive: (v: boolean) => void
  hasConstructionSteps: boolean
  hasDraggablePoints: boolean
  availableMacros: MacroInfo[]
  macroPhase: MacroPhase
  handleMacroToolClick: () => void
  startWiggle: (i: number) => void
  givenSetupActive: boolean
  activeToolRef: MutableRefObject<ActiveTool>
  toolDockRef: React.Ref<HTMLDivElement>
}

export function ToolDock({
  activeTool,
  setActiveTool,
  playgroundMode,
  isComplete,
  isMobile,
  isToolDockActive,
  setIsToolDockActive,
  hasConstructionSteps,
  hasDraggablePoints,
  availableMacros,
  handleMacroToolClick,
  startWiggle,
  givenSetupActive,
  activeToolRef,
  toolDockRef,
}: ToolDockProps) {
  if (!hasConstructionSteps && !isComplete && !playgroundMode) return null

  return (
    <div
      data-element="tool-selector"
      ref={toolDockRef}
      onMouseEnter={() => setIsToolDockActive(true)}
      onMouseLeave={() => setIsToolDockActive(false)}
      onTouchStart={() => setIsToolDockActive(true)}
      onTouchEnd={() => setIsToolDockActive(false)}
      onPointerDown={() => setIsToolDockActive(true)}
      onPointerUp={() => setIsToolDockActive(false)}
      style={{
        position: 'absolute',
        display: 'flex',
        gap: 8,
        zIndex: 10,
        ...(isMobile
          ? {
              top: '50%',
              right: 12,
              transform: 'translateY(-50%)',
              flexDirection: 'column',
              padding: '8px 6px',
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.85)',
              border: '1px solid rgba(203, 213, 225, 0.8)',
              boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
              backdropFilter: 'blur(8px)',
              opacity: isToolDockActive ? 1 : 0.55,
              transition: 'opacity 0.2s ease',
            }
          : {
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
            }),
      }}
    >
      {(playgroundMode || (isComplete && hasDraggablePoints)) && (
        <ToolButton
          label="Move"
          icon={
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1" />
              <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v6" />
              <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
              <path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 17" />
            </svg>
          }
          active={activeTool === 'move'}
          onClick={() => setActiveTool('move')}
          size={isMobile ? 44 : 48}
        />
      )}
      {!givenSetupActive && (
        <ToolButton
          label="Compass"
          icon={
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="5" r="1" />
              <path d="M12 6l-4 14" />
              <path d="M12 6l4 14" />
              <path d="M6 18a6 6 0 0 0 12 0" />
            </svg>
          }
          active={activeTool === 'compass'}
          onClick={() => setActiveTool('compass')}
          size={isMobile ? 44 : 48}
        />
      )}
      <ToolButton
        label="Straightedge"
        icon={
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="4" y1="20" x2="20" y2="4" />
          </svg>
        }
        active={activeTool === 'straightedge'}
        onClick={() => setActiveTool('straightedge')}
        size={isMobile ? 44 : 48}
      />
      {availableMacros.length > 0 && !givenSetupActive && (
        <ToolButton
          label="Proposition"
          icon={
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Two overlapping circles — evokes prior constructions */}
              <circle cx="9" cy="12" r="5" />
              <circle cx="15" cy="12" r="5" />
            </svg>
          }
          active={activeTool === 'macro'}
          onClick={handleMacroToolClick}
          size={isMobile ? 44 : 48}
        />
      )}
      {playgroundMode && (
        <ToolButton
          label="Point"
          icon={
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
          }
          active={activeTool === 'point'}
          onClick={() => {
            setActiveTool('point')
            activeToolRef.current = 'point'
          }}
          size={isMobile ? 44 : 48}
        />
      )}
      {playgroundMode && !givenSetupActive && (
        <ToolButton
          label="Wiggle"
          icon={
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 12c1.5-3 3.5-3 5 0s3.5 3 5 0 3.5-3 5 0 3.5 3 5 0" />
            </svg>
          }
          active={false}
          onClick={() => startWiggle(0)}
          size={isMobile ? 44 : 48}
        />
      )}
    </div>
  )
}
