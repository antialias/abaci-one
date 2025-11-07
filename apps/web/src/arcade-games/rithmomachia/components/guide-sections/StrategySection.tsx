import { useTranslations } from 'next-intl'
import { css } from '../../../../../styled-system/css'
import { RithmomachiaBoard, type ExamplePiece } from '../RithmomachiaBoard'

/**
 * Helper to convert square names to crop area coordinates
 * @param topLeft - e.g. 'D3'
 * @param bottomRight - e.g. 'H6'
 */
function squaresToCropArea(topLeft: string, bottomRight: string) {
  const minCol = topLeft.charCodeAt(0) - 65 // A=0
  const maxCol = bottomRight.charCodeAt(0) - 65
  const maxRow = Number.parseInt(topLeft.slice(1), 10)
  const minRow = Number.parseInt(bottomRight.slice(1), 10)
  return { minCol, maxCol, minRow, maxRow }
}

export function StrategySection({ useNativeAbacusNumbers }: { useNativeAbacusNumbers: boolean }) {
  const t = useTranslations('rithmomachia.guide')

  // Example: Good opening position with central control
  const openingExample: ExamplePiece[] = [
    // White pieces controlling center
    { square: 'E4', type: 'T', color: 'W', value: 20 },
    { square: 'F3', type: 'C', color: 'W', value: 9 },
    { square: 'G3', type: 'C', color: 'W', value: 16 },
    // Black pieces
    { square: 'E6', type: 'T', color: 'B', value: 28 },
    { square: 'F7', type: 'C', color: 'B', value: 9 },
  ]

  // Example: Helper network for complex captures
  const helperNetworkExample: ExamplePiece[] = [
    // White's helper network
    { square: 'D4', type: 'C', color: 'W', value: 4 },
    { square: 'E4', type: 'C', color: 'W', value: 5 },
    { square: 'F4', type: 'C', color: 'W', value: 6 },
    // Black target that can be captured via helpers
    { square: 'G4', type: 'C', color: 'B', value: 9 }, // 4+5=9
  ]

  // Example: Defensive positioning
  const defensiveExample: ExamplePiece[] = [
    // White pyramid protected by support pieces
    { square: 'E4', type: 'P', color: 'W', value: 36 },
    { square: 'D4', type: 'C', color: 'W', value: 9 },
    { square: 'F4', type: 'T', color: 'W', value: 20 },
    // Black attackers
    { square: 'E6', type: 'S', color: 'B', value: 36 },
  ]

  // Example: Arithmetic harmony setup
  const harmonySetupExample: ExamplePiece[] = [
    // White pieces forming arithmetic progression: 6, 9, 12
    { square: 'E6', type: 'C', color: 'W', value: 6 },
    { square: 'F6', type: 'C', color: 'W', value: 9 },
    { square: 'G6', type: 'T', color: 'W', value: 12 },
  ]

  // Example: Exposed pyramid (common mistake)
  const exposedPyramidExample: ExamplePiece[] = [
    // White pyramid alone in Black territory
    { square: 'E7', type: 'P', color: 'W', value: 91 },
    // Black pieces that can capture it
    { square: 'D7', type: 'S', color: 'B', value: 81 },
    { square: 'F7', type: 'C', color: 'B', value: 10 },
  ]

  // Example: Defensive mistake - pieces too close
  const defensiveMistakeExample: ExamplePiece[] = [
    // White pieces clustered together (vulnerable to same attack)
    { square: 'E4', type: 'C', color: 'W', value: 25 },
    { square: 'F4', type: 'C', color: 'W', value: 25 },
    { square: 'G4', type: 'C', color: 'W', value: 25 },
    // Black piece that threatens all three
    { square: 'E5', type: 'C', color: 'B', value: 25 },
  ]

  // Example: Tempo play with positional sacrifice
  const tempoExample: ExamplePiece[] = [
    // White sacrifices a low-value piece to gain better position
    { square: 'E5', type: 'C', color: 'W', value: 4 }, // Sacrifice target
    { square: 'G3', type: 'P', color: 'W', value: 36 }, // Pyramid advancing
    // Black pieces
    { square: 'D6', type: 'C', color: 'B', value: 4 }, // Will capture but lose tempo
    { square: 'F7', type: 'S', color: 'B', value: 49 },
  ]

  return (
    <div data-section="strategy">
      <h3
        className={css({
          fontSize: { base: '20px', md: '24px' },
          fontWeight: 'bold',
          color: '#7c2d12',
          mb: '16px',
        })}
      >
        {t('strategy.title')}
      </h3>
      <p
        className={css({
          fontSize: '15px',
          lineHeight: '1.6',
          mb: '24px',
          color: '#374151',
        })}
      >
        {t('strategy.intro')}
      </p>

      {/* Opening Principles */}
      <h4
        className={css({
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#111827',
          mb: '12px',
          mt: '20px',
        })}
      >
        {t('strategy.openingPrinciples.title')}
      </h4>

      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          mb: '20px',
        })}
      >
        <div
          className={css({
            p: '12px',
            bg: '#f0fdf4',
            borderRadius: '6px',
            border: '1px solid #86efac',
          })}
        >
          <p
            className={css({
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#15803d',
              mb: '4px',
            })}
          >
            {t('strategy.openingPrinciples.controlCenter.title')}
          </p>
          <p className={css({ fontSize: '13px', color: '#166534' })}>
            {t('strategy.openingPrinciples.controlCenter.desc')}
          </p>
        </div>
        <div
          className={css({
            p: '12px',
            bg: '#f0fdf4',
            borderRadius: '6px',
            border: '1px solid #86efac',
          })}
        >
          <p
            className={css({
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#15803d',
              mb: '4px',
            })}
          >
            {t('strategy.openingPrinciples.developCircles.title')}
          </p>
          <p className={css({ fontSize: '13px', color: '#166534' })}>
            {t('strategy.openingPrinciples.developCircles.desc')}
          </p>
        </div>
        <div
          className={css({
            p: '12px',
            bg: '#f0fdf4',
            borderRadius: '6px',
            border: '1px solid #86efac',
          })}
        >
          <p
            className={css({
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#15803d',
              mb: '4px',
            })}
          >
            {t('strategy.openingPrinciples.protectPyramid.title')}
          </p>
          <p className={css({ fontSize: '13px', color: '#166534' })}>
            {t('strategy.openingPrinciples.protectPyramid.desc')}
          </p>
        </div>
        <div
          className={css({
            p: '12px',
            bg: '#f0fdf4',
            borderRadius: '6px',
            border: '1px solid #86efac',
          })}
        >
          <p
            className={css({
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#15803d',
              mb: '4px',
            })}
          >
            {t('strategy.openingPrinciples.knowNumbers.title')}
          </p>
          <p className={css({ fontSize: '13px', color: '#166534' })}>
            {t('strategy.openingPrinciples.knowNumbers.desc')}
          </p>
        </div>
      </div>

      {/* Opening Example */}
      <div
        className={css({
          mb: '24px',
          p: '16px',
          bg: '#f9fafb',
          borderRadius: '8px',
          border: '2px solid #e5e7eb',
        })}
      >
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#111827',
            mb: '12px',
          })}
        >
          Example: Good Opening Position
        </p>
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <RithmomachiaBoard
            pieces={openingExample}
            scale={0.4}
            cropArea={squaresToCropArea('D8', 'H2')}
            highlightSquares={['E4', 'F3', 'G3']}
            showLabels={true}
            useNativeAbacusNumbers={useNativeAbacusNumbers}
          />
        </div>
        <p
          className={css({
            fontSize: '12px',
            color: '#9ca3af',
            mt: '8px',
            textAlign: 'center',
            fontStyle: 'italic',
          })}
        >
          White controls the center with mobile pieces creating flexible capture opportunities
        </p>
      </div>

      {/* Mid-Game Tactics */}
      <h4
        className={css({
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#111827',
          mb: '12px',
          mt: '24px',
        })}
      >
        {t('strategy.midGame.title')}
      </h4>

      <div
        className={css({
          mb: '16px',
          p: '16px',
          bg: '#f9fafb',
          borderRadius: '8px',
          border: '2px solid #e5e7eb',
        })}
      >
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#111827',
            mb: '8px',
          })}
        >
          {t('strategy.midGame.helperNetworks.title')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b7280' })}>
          {t('strategy.midGame.helperNetworks.desc')}
        </p>
      </div>

      <div
        className={css({
          mb: '16px',
          p: '16px',
          bg: '#f9fafb',
          borderRadius: '8px',
          border: '2px solid #e5e7eb',
        })}
      >
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#111827',
            mb: '8px',
          })}
        >
          {t('strategy.midGame.createThreats.title')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b7280' })}>
          {t('strategy.midGame.createThreats.desc')}
        </p>
      </div>

      <div
        className={css({
          mb: '16px',
          p: '16px',
          bg: '#f9fafb',
          borderRadius: '8px',
          border: '2px solid #e5e7eb',
        })}
      >
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#111827',
            mb: '8px',
          })}
        >
          {t('strategy.midGame.thinkDefensively.title')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b7280' })}>
          {t('strategy.midGame.thinkDefensively.desc')}
        </p>
      </div>

      <div
        className={css({
          mb: '20px',
          p: '16px',
          bg: '#f9fafb',
          borderRadius: '8px',
          border: '2px solid #e5e7eb',
        })}
      >
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#111827',
            mb: '8px',
          })}
        >
          {t('strategy.midGame.exchangeWhenAhead.title')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b7280' })}>
          {t('strategy.midGame.exchangeWhenAhead.desc')}
        </p>
      </div>

      {/* Helper Network Example */}
      <div
        className={css({
          mb: '16px',
          p: '16px',
          bg: '#f9fafb',
          borderRadius: '8px',
          border: '2px solid #e5e7eb',
        })}
      >
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#111827',
            mb: '12px',
          })}
        >
          Example: Helper Network
        </p>
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <RithmomachiaBoard
            pieces={helperNetworkExample}
            scale={0.4}
            cropArea={squaresToCropArea('C5', 'H3')}
            highlightSquares={['D4', 'E4', 'F4', 'G4']}
            showLabels={true}
            useNativeAbacusNumbers={useNativeAbacusNumbers}
          />
        </div>
        <p
          className={css({
            fontSize: '12px',
            color: '#9ca3af',
            mt: '8px',
            textAlign: 'center',
            fontStyle: 'italic',
          })}
        >
          White pieces 4, 5, 6 form a helper network that can capture Black&apos;s 9 (4+5=9)
        </p>
      </div>

      {/* Defensive Positioning Example */}
      <div
        className={css({
          mb: '24px',
          p: '16px',
          bg: '#f9fafb',
          borderRadius: '8px',
          border: '2px solid #e5e7eb',
        })}
      >
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#111827',
            mb: '12px',
          })}
        >
          Example: Defensive Positioning
        </p>
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <RithmomachiaBoard
            pieces={defensiveExample}
            scale={0.4}
            cropArea={squaresToCropArea('C7', 'G3')}
            highlightSquares={['E4', 'D4', 'F4']}
            showLabels={true}
            useNativeAbacusNumbers={useNativeAbacusNumbers}
          />
        </div>
        <p
          className={css({
            fontSize: '12px',
            color: '#9ca3af',
            mt: '8px',
            textAlign: 'center',
            fontStyle: 'italic',
          })}
        >
          White Pyramid protected by supporting pieces
        </p>
      </div>

      {/* Paths to Victory */}
      <h4
        className={css({
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#111827',
          mb: '12px',
          mt: '24px',
        })}
      >
        {t('strategy.victoryPaths.title')}
      </h4>

      <div
        className={css({
          mb: '16px',
          p: '16px',
          bg: '#f9fafb',
          borderRadius: '8px',
          border: '2px solid #e5e7eb',
        })}
      >
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#111827',
            mb: '8px',
          })}
        >
          {t('strategy.victoryPaths.harmony.title')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b7280', mb: '8px' })}>
          {t('strategy.victoryPaths.harmony.desc')}
        </p>
        <ul className={css({ fontSize: '13px', color: '#6b7280', pl: '20px' })}>
          <li
            dangerouslySetInnerHTML={{
              __html: t.raw('strategy.victoryPaths.harmony.arithmetic'),
            }}
          />
          <li
            dangerouslySetInnerHTML={{
              __html: t.raw('strategy.victoryPaths.harmony.geometric'),
            }}
          />
          <li
            dangerouslySetInnerHTML={{
              __html: t.raw('strategy.victoryPaths.harmony.harmonic'),
            }}
          />
        </ul>
      </div>

      <div
        className={css({
          mb: '16px',
          p: '16px',
          bg: '#f9fafb',
          borderRadius: '8px',
          border: '2px solid #e5e7eb',
        })}
      >
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#111827',
            mb: '8px',
          })}
        >
          {t('strategy.victoryPaths.exhaustion.title')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b7280' })}>
          {t('strategy.victoryPaths.exhaustion.desc')}
        </p>
      </div>

      <div
        className={css({
          mb: '20px',
          p: '16px',
          bg: '#f9fafb',
          borderRadius: '8px',
          border: '2px solid #e5e7eb',
        })}
      >
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#111827',
            mb: '8px',
          })}
        >
          {t('strategy.victoryPaths.points.title')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b7280' })}>
          {t('strategy.victoryPaths.points.desc')}
        </p>
      </div>

      {/* Harmony Setup Example */}
      <div
        className={css({
          mb: '24px',
          p: '16px',
          bg: '#f9fafb',
          borderRadius: '8px',
          border: '2px solid #86efac',
        })}
      >
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#15803d',
            mb: '12px',
          })}
        >
          Example: Arithmetic Harmony Setup
        </p>
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <RithmomachiaBoard
            pieces={harmonySetupExample}
            scale={0.4}
            cropArea={squaresToCropArea('D7', 'H5')}
            highlightSquares={['E6', 'F6', 'G6']}
            showLabels={true}
            useNativeAbacusNumbers={useNativeAbacusNumbers}
          />
        </div>
        <p
          className={css({
            fontSize: '12px',
            color: '#166534',
            mt: '8px',
            textAlign: 'center',
            fontStyle: 'italic',
          })}
        >
          White pieces 6, 9, 12 in enemy territory form an arithmetic progression (difference = 3)
        </p>
      </div>

      {/* Common Mistakes */}
      <div
        className={css({
          mt: '24px',
          mb: '20px',
          p: '16px',
          bg: 'rgba(239, 68, 68, 0.1)',
          borderLeft: '4px solid #ef4444',
          borderRadius: '4px',
        })}
      >
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#991b1b',
            mb: '8px',
          })}
        >
          {t('strategy.commonMistakes.title')}
        </p>
        <ul
          className={css({
            fontSize: '14px',
            color: '#7f1d1d',
            lineHeight: '1.6',
            pl: '20px',
          })}
        >
          <li
            dangerouslySetInnerHTML={{
              __html: t.raw('strategy.commonMistakes.movingWithoutCalc'),
            }}
          />
          <li
            dangerouslySetInnerHTML={{
              __html: t.raw('strategy.commonMistakes.ignoringGeometry'),
            }}
          />
          <li
            dangerouslySetInnerHTML={{
              __html: t.raw('strategy.commonMistakes.neglectingHarmony'),
            }}
          />
          <li
            dangerouslySetInnerHTML={{
              __html: t.raw('strategy.commonMistakes.exposingPyramid'),
            }}
          />
        </ul>
      </div>

      {/* Exposed Pyramid Example */}
      <div
        className={css({
          mb: '16px',
          p: '16px',
          bg: '#fef2f2',
          borderRadius: '8px',
          border: '2px solid #fca5a5',
        })}
      >
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#991b1b',
            mb: '12px',
          })}
        >
          Example: Exposed Pyramid
        </p>
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <RithmomachiaBoard
            pieces={exposedPyramidExample}
            scale={0.4}
            cropArea={squaresToCropArea('C8', 'G6')}
            highlightSquares={['E7']}
            showLabels={true}
            useNativeAbacusNumbers={useNativeAbacusNumbers}
          />
        </div>
        <p
          className={css({
            fontSize: '12px',
            color: '#7f1d1d',
            mt: '8px',
            textAlign: 'center',
            fontStyle: 'italic',
          })}
        >
          White Pyramid alone in enemy territory is vulnerable to capture
        </p>
      </div>

      {/* Defensive Mistake Example */}
      <div
        className={css({
          mb: '24px',
          p: '16px',
          bg: '#fef2f2',
          borderRadius: '8px',
          border: '2px solid #fca5a5',
        })}
      >
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#991b1b',
            mb: '12px',
          })}
        >
          Example: Pieces Too Close
        </p>
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <RithmomachiaBoard
            pieces={defensiveMistakeExample}
            scale={0.4}
            cropArea={squaresToCropArea('D6', 'H3')}
            highlightSquares={['E4', 'F4', 'G4', 'E5']}
            showLabels={true}
            useNativeAbacusNumbers={useNativeAbacusNumbers}
          />
        </div>
        <p
          className={css({
            fontSize: '12px',
            color: '#7f1d1d',
            mt: '8px',
            textAlign: 'center',
            fontStyle: 'italic',
          })}
        >
          White pieces clustered together are all vulnerable to the same Black attacker
        </p>
      </div>

      {/* Advanced Concepts */}
      <h4
        className={css({
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#111827',
          mb: '12px',
          mt: '24px',
        })}
      >
        {t('strategy.advanced.title')}
      </h4>

      <div
        className={css({
          mb: '16px',
          p: '16px',
          bg: 'rgba(139, 92, 246, 0.1)',
          borderRadius: '8px',
          border: '2px solid rgba(139, 92, 246, 0.3)',
        })}
      >
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#5b21b6',
            mb: '8px',
          })}
        >
          {t('strategy.advanced.sacrifices.title')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b21a8' })}>
          {t('strategy.advanced.sacrifices.desc')}
        </p>
      </div>

      <div
        className={css({
          mb: '16px',
          p: '16px',
          bg: 'rgba(139, 92, 246, 0.1)',
          borderRadius: '8px',
          border: '2px solid rgba(139, 92, 246, 0.3)',
        })}
      >
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#5b21b6',
            mb: '8px',
          })}
        >
          {t('strategy.advanced.pyramidFaces.title')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b21a8' })}>
          {t('strategy.advanced.pyramidFaces.desc')}
        </p>
      </div>

      <div
        className={css({
          mb: '20px',
          p: '16px',
          bg: 'rgba(139, 92, 246, 0.1)',
          borderRadius: '8px',
          border: '2px solid rgba(139, 92, 246, 0.3)',
        })}
      >
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#5b21b6',
            mb: '8px',
          })}
        >
          {t('strategy.advanced.tempo.title')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b21a8' })}>
          {t('strategy.advanced.tempo.desc')}
        </p>
      </div>

      {/* Tempo Example */}
      <div
        className={css({
          mb: '16px',
          p: '16px',
          bg: 'rgba(139, 92, 246, 0.05)',
          borderRadius: '8px',
          border: '2px solid rgba(139, 92, 246, 0.3)',
        })}
      >
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#5b21b6',
            mb: '12px',
          })}
        >
          Example: Tempo Play
        </p>
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <RithmomachiaBoard
            pieces={tempoExample}
            scale={0.4}
            cropArea={squaresToCropArea('C8', 'H2')}
            highlightSquares={['E5', 'G3']}
            showLabels={true}
            useNativeAbacusNumbers={useNativeAbacusNumbers}
          />
        </div>
        <p
          className={css({
            fontSize: '12px',
            color: '#6b21a8',
            mt: '8px',
            textAlign: 'center',
            fontStyle: 'italic',
          })}
        >
          White sacrifices a low-value piece to gain tempo and advance the Pyramid
        </p>
      </div>
    </div>
  )
}
