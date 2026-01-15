'use client'

import { useMemo } from 'react'
import { css } from '../../../../styled-system/css'
import { useYjsDemo } from '../Provider'
import { useViewerId } from '@/hooks/useViewerId'

export function ResultsPhase() {
  const { state, yjsState, goToSetup } = useYjsDemo()
  const { data: viewerId } = useViewerId()

  // Convert Yjs array to regular array for rendering
  const cells = useMemo(() => {
    if (!yjsState.cells) return []
    return yjsState.cells.toArray()
  }, [yjsState.cells])

  // Calculate final scores
  const scores = useMemo(() => {
    const scoreMap: Record<string, number> = {}
    for (const cell of cells) {
      scoreMap[cell.playerId] = (scoreMap[cell.playerId] || 0) + 1
    }
    return scoreMap
  }, [cells])

  const sortedScores = useMemo(() => {
    return Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([playerId, score]) => ({ playerId, score }))
  }, [scores])

  const winner = sortedScores[0]

  return (
    <div className={containerStyle}>
      <div className={titleStyle}>🎉 Game Complete! 🎉</div>

      {winner && (
        <div className={winnerBoxStyle}>
          <div className={winnerTitleStyle}>Winner!</div>
          <div className={winnerNameStyle}>
            {winner.playerId === viewerId ? 'You' : winner.playerId}
          </div>
          <div className={winnerScoreStyle}>{winner.score} cells claimed</div>
        </div>
      )}

      <div className={scoresContainerStyle}>
        <div className={scoresTitleStyle}>Final Scores:</div>
        <div className={scoresListStyle}>
          {sortedScores.map(({ playerId, score }, index) => (
            <div key={playerId} className={scoreItemStyle}>
              <span className={scoreRankStyle}>#{index + 1}</span>
              <span className={scorePlayerStyle}>
                {playerId === viewerId ? 'You' : playerId.slice(0, 8)}
              </span>
              <span className={scoreValueStyle}>{score} cells</span>
            </div>
          ))}
        </div>
      </div>

      <div className={statsBoxStyle}>
        <div className={statItemStyle}>
          <span className={statLabelStyle}>Total cells claimed:</span>
          <span className={statValueStyle}>{cells.length}</span>
        </div>
        <div className={statItemStyle}>
          <span className={statLabelStyle}>Grid size:</span>
          <span className={statValueStyle}>
            {state.gridSize} × {state.gridSize}
          </span>
        </div>
      </div>

      <button type="button" onClick={goToSetup} className={playAgainButtonStyle}>
        Play Again
      </button>
    </div>
  )
}

const containerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: { base: '20px', md: '40px' },
  gap: '24px',
  minHeight: '70vh',
})

const titleStyle = css({
  fontSize: { base: '28px', md: '36px' },
  fontWeight: 'bold',
  color: 'blue.600',
  textAlign: 'center',
})

const winnerBoxStyle = css({
  backgroundColor: 'yellow.100',
  borderRadius: '16px',
  padding: '24px',
  border: '3px solid',
  borderColor: 'yellow.400',
  textAlign: 'center',
  minWidth: '250px',
})

const winnerTitleStyle = css({
  fontSize: '20px',
  fontWeight: 'bold',
  color: 'yellow.700',
  marginBottom: '8px',
})

const winnerNameStyle = css({
  fontSize: '32px',
  fontWeight: 'bold',
  color: 'yellow.800',
  marginBottom: '4px',
})

const winnerScoreStyle = css({
  fontSize: '18px',
  color: 'yellow.700',
})

const scoresContainerStyle = css({
  backgroundColor: 'white',
  borderRadius: '12px',
  padding: '20px',
  border: '1px solid',
  borderColor: 'gray.200',
  minWidth: '300px',
})

const scoresTitleStyle = css({
  fontSize: '18px',
  fontWeight: 'bold',
  color: 'gray.700',
  marginBottom: '16px',
})

const scoresListStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
})

const scoreItemStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px',
  backgroundColor: 'gray.50',
  borderRadius: '8px',
})

const scoreRankStyle = css({
  fontSize: '16px',
  fontWeight: 'bold',
  color: 'gray.500',
  minWidth: '32px',
})

const scorePlayerStyle = css({
  flex: 1,
  fontSize: '16px',
  fontWeight: 500,
  color: 'gray.700',
})

const scoreValueStyle = css({
  fontSize: '16px',
  fontWeight: 'bold',
  color: 'blue.600',
})

const statsBoxStyle = css({
  backgroundColor: 'blue.50',
  borderRadius: '8px',
  padding: '16px',
  border: '1px solid',
  borderColor: 'blue.200',
  minWidth: '250px',
})

const statItemStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 0',
  borderBottom: '1px solid',
  borderColor: 'blue.100',
  '&:last-child': {
    borderBottom: 'none',
  },
})

const statLabelStyle = css({
  fontSize: '14px',
  color: 'gray.600',
})

const statValueStyle = css({
  fontSize: '14px',
  fontWeight: 'bold',
  color: 'blue.700',
})

const playAgainButtonStyle = css({
  padding: '16px 32px',
  fontSize: '18px',
  fontWeight: 'bold',
  backgroundColor: 'blue.500',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  transition: 'all 0.2s',
  _hover: {
    backgroundColor: 'blue.600',
    transform: 'scale(1.05)',
  },
})
