'use client'

import { useGameMode } from '@/contexts/GameModeContext'
import { css } from '../../../../styled-system/css'
import { useYjsDemo } from '../Provider'

export function SetupPhase() {
  const { activePlayers } = useGameMode()
  const { startGame } = useYjsDemo()

  const canStart = activePlayers.size >= 1

  return (
    <div className={containerStyle}>
      <div className={titleStyle}>Collaborative Grid Demo</div>
      <div className={descriptionStyle}>
        Click on the grid to add colored cells. See other players&apos; clicks in real-time using
        Yjs!
      </div>

      <div className={infoBoxStyle}>
        <div className={infoTitleStyle}>How it works:</div>
        <ul className={listStyle}>
          <li>Each player gets a unique color</li>
          <li>Click cells to claim them</li>
          <li>State is synchronized with Yjs CRDTs</li>
          <li>No traditional server validation - Yjs handles conflicts</li>
          <li>All players see updates in real-time</li>
        </ul>
      </div>

      <button
        type="button"
        onClick={startGame}
        disabled={!canStart}
        className={css({
          padding: '16px 32px',
          fontSize: '18px',
          fontWeight: 'bold',
          backgroundColor: canStart ? 'blue.500' : 'gray.300',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: canStart ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
          _hover: canStart ? { backgroundColor: 'blue.600', transform: 'scale(1.05)' } : {},
        })}
      >
        {canStart ? 'Start Demo' : 'Select at least 1 player'}
      </button>
    </div>
  )
}

const containerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: { base: '20px', md: '40px' },
  gap: '24px',
  minHeight: '60vh',
})

const titleStyle = css({
  fontSize: { base: '28px', md: '36px' },
  fontWeight: 'bold',
  color: 'blue.600',
  textAlign: 'center',
})

const descriptionStyle = css({
  fontSize: { base: '16px', md: '18px' },
  color: 'gray.700',
  textAlign: 'center',
  maxWidth: '600px',
})

const infoBoxStyle = css({
  backgroundColor: 'blue.50',
  borderRadius: '12px',
  padding: '20px',
  maxWidth: '500px',
  border: '2px solid',
  borderColor: 'blue.200',
})

const infoTitleStyle = css({
  fontSize: '18px',
  fontWeight: 'bold',
  color: 'blue.700',
  marginBottom: '12px',
})

const listStyle = css({
  fontSize: '14px',
  color: 'gray.700',
  paddingLeft: '20px',
  '& li': {
    marginBottom: '8px',
  },
})
