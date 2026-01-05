'use client'

import { useAbacusSettings } from '@/hooks/useAbacusSettings'
import { css } from '../../../../../styled-system/css'
import { useRithmomachia } from '../../Provider'
import { BoardDisplay } from '../board/BoardDisplay'

export interface PlayingPhaseProps {
  onOpenGuide: () => void
  isGuideOpen: boolean
}

export function PlayingPhase({ onOpenGuide, isGuideOpen }: PlayingPhaseProps) {
  const { state, lastError, clearError } = useRithmomachia()

  // Get abacus settings for native abacus numbers
  const { data: abacusSettings } = useAbacusSettings()
  const useNativeAbacusNumbers = abacusSettings?.nativeAbacusNumbers ?? false

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      })}
    >
      {/* Compact Header Bar */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: '4',
          py: '3',
          bg: 'rgba(255, 255, 255, 0.95)',
          borderBottom: '2px solid',
          borderColor: 'rgba(251, 191, 36, 0.3)',
          flexShrink: 0,
          gap: '4',
        })}
      >
        {/* Captured pieces info */}
        <div
          className={css({
            display: 'flex',
            gap: { base: '4', md: '6' },
            alignItems: 'center',
            flex: 1,
          })}
        >
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
              fontSize: { base: 'sm', md: 'md' },
              fontWeight: 'semibold',
              color: 'gray.700',
            })}
          >
            <span>⚪</span>
            <span className={css({ display: { base: 'none', sm: 'inline' } })}>White:</span>
            <span className={css({ color: 'gray.900' })}>{state.capturedPieces.W.length}</span>
          </div>

          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
              fontSize: { base: 'sm', md: 'md' },
              fontWeight: 'semibold',
              color: 'gray.700',
            })}
          >
            <span>⚫</span>
            <span className={css({ display: { base: 'none', sm: 'inline' } })}>Black:</span>
            <span className={css({ color: 'gray.900' })}>{state.capturedPieces.B.length}</span>
          </div>
        </div>

        {/* Guide Button */}
        {!isGuideOpen && (
          <button
            type="button"
            data-action="open-guide-playing"
            onClick={onOpenGuide}
            className={css({
              px: { base: '3', md: '4' },
              py: { base: '1.5', md: '2' },
              bg: 'linear-gradient(135deg, #7c2d12, #92400e)',
              color: 'white',
              border: '2px solid rgba(251, 191, 36, 0.6)',
              borderRadius: 'lg',
              fontSize: { base: 'sm', md: 'md' },
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.2s',
              flexShrink: 0,
              _hover: {
                bg: 'linear-gradient(135deg, #92400e, #7c2d12)',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              },
            })}
          >
            <span>📖</span>
            <span className={css({ display: { base: 'none', sm: 'inline' } })}>Guide</span>
          </button>
        )}
      </div>

      {/* Error Banner */}
      {lastError && (
        <div
          className={css({
            mx: '4',
            mt: '4',
            p: '4',
            bg: 'red.100',
            borderColor: 'red.400',
            borderWidth: '2px',
            borderRadius: 'md',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          })}
        >
          <span className={css({ color: 'red.800', fontWeight: 'semibold' })}>⚠️ {lastError}</span>
          <button
            type="button"
            onClick={clearError}
            className={css({
              px: '3',
              py: '1',
              bg: 'red.200',
              color: 'red.800',
              borderRadius: 'sm',
              fontWeight: 'semibold',
              cursor: 'pointer',
              _hover: { bg: 'red.300' },
            })}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Board Area - takes remaining space */}
      <div
        className={css({
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: '4',
          overflow: 'auto',
        })}
      >
        <BoardDisplay />
      </div>
    </div>
  )
}
