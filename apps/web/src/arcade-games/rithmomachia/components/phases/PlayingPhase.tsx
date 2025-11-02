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
  const { state, isMyTurn, lastError, clearError, rosterStatus } = useRithmomachia()

  // Get abacus settings for native abacus numbers
  const { data: abacusSettings } = useAbacusSettings()
  const useNativeAbacusNumbers = abacusSettings?.nativeAbacusNumbers ?? false

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '4',
        p: '4',
      })}
    >
      {lastError && (
        <div
          className={css({
            width: '100%',
            p: '4',
            bg: 'red.100',
            borderColor: 'red.400',
            borderWidth: '2px',
            borderRadius: 'md',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
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

      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: '4',
          bg: 'gray.100',
          borderRadius: 'md',
          gap: '3',
        })}
      >
        <div>
          <span className={css({ fontWeight: 'bold' })}>Turn: </span>
          <span className={css({ color: state.turn === 'W' ? 'gray.800' : 'gray.600' })}>
            {state.turn === 'W' ? 'White' : 'Black'}
          </span>
        </div>
        <div className={css({ display: 'flex', gap: '2', alignItems: 'center' })}>
          {!isGuideOpen && (
            <button
              type="button"
              data-action="open-guide-playing"
              onClick={onOpenGuide}
              className={css({
                px: '3',
                py: '1',
                bg: 'linear-gradient(135deg, #7c2d12, #92400e)',
                color: 'white',
                border: '1px solid rgba(251, 191, 36, 0.6)',
                borderRadius: 'md',
                fontSize: 'sm',
                fontWeight: 'semibold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '1',
                transition: 'all 0.2s',
                _hover: {
                  bg: 'linear-gradient(135deg, #92400e, #7c2d12)',
                  transform: 'translateY(-1px)',
                },
              })}
            >
              <span>📖</span>
              <span>Guide</span>
            </button>
          )}
          {isMyTurn && (
            <div
              className={css({
                px: '3',
                py: '1',
                bg: 'green.100',
                color: 'green.800',
                borderRadius: 'md',
                fontSize: 'sm',
                fontWeight: 'semibold',
              })}
            >
              Your Turn
            </div>
          )}
          {!isMyTurn && rosterStatus.status === 'ok' && (
            <div
              className={css({
                px: '3',
                py: '1',
                bg: 'gray.200',
                color: 'gray.700',
                borderRadius: 'md',
                fontSize: 'sm',
                fontWeight: 'semibold',
              })}
            >
              Waiting for {state.turn === 'W' ? 'White' : 'Black'}
            </div>
          )}
        </div>
      </div>

      <BoardDisplay />

      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4',
        })}
      >
        <div className={css({ p: '4', bg: 'gray.100', borderRadius: 'md' })}>
          <h3 className={css({ fontWeight: 'bold', mb: '2' })}>White Captured</h3>
          <div className={css({ fontSize: 'sm' })}>{state.capturedPieces.W.length} pieces</div>
        </div>
        <div className={css({ p: '4', bg: 'gray.100', borderRadius: 'md' })}>
          <h3 className={css({ fontWeight: 'bold', mb: '2' })}>Black Captured</h3>
          <div className={css({ fontSize: 'sm' })}>{state.capturedPieces.B.length} pieces</div>
        </div>
      </div>
    </div>
  )
}
