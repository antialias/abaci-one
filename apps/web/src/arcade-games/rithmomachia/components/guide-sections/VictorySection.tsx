import { useTranslation } from 'react-i18next'
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

export function VictorySection({ useNativeAbacusNumbers }: { useNativeAbacusNumbers: boolean }) {
  const { t } = useTranslation()

  // Example winning position: White has formed a geometric progression in Black's territory
  const winningExample: ExamplePiece[] = [
    // White's winning progression in enemy territory (rows 5-8)
    { square: 'E6', type: 'C', color: 'W', value: 4 },
    { square: 'F6', type: 'C', color: 'W', value: 8 },
    { square: 'G6', type: 'T', color: 'W', value: 16 },
    // Some Black pieces remaining (unable to break the harmony)
    { square: 'C7', type: 'S', color: 'B', value: 49 },
    { square: 'J6', type: 'T', color: 'B', value: 30 },
  ]

  return (
    <div data-section="victory">
      <h3
        className={css({
          fontSize: { base: '20px', md: '24px' },
          fontWeight: 'bold',
          color: '#7c2d12',
          mb: '16px',
        })}
      >
        {t('guide.victory.title', 'How to Win')}
      </h3>

      <div className={css({ display: 'flex', flexDirection: 'column', gap: '24px' })}>
        <div>
          <h4
            className={css({
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#111827',
              mb: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            })}
          >
            <span>👑</span>
            <span>{t('guide.victory.harmony', 'Victory #1: Harmony (Progression)')}</span>
          </h4>
          <p className={css({ fontSize: '15px', lineHeight: '1.6', color: '#374151', mb: '12px' })}>
            {t(
              'guide.victory.harmonyDesc',
              "Form a mathematical progression with 3 pieces in enemy territory. If it survives your opponent's next turn, you win!"
            )}
          </p>

          {/* Visual example of winning harmony */}
          <div
            className={css({
              mb: '16px',
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
                textAlign: 'center',
              })}
            >
              {t('guide.victory.exampleTitle', 'Example: White Wins!')}
            </p>
            <div className={css({ display: 'flex', justifyContent: 'center' })}>
              <RithmomachiaBoard
                pieces={winningExample}
                scale={0.4}
                cropArea={squaresToCropArea('B8', 'K5')}
                highlightSquares={['E6', 'F6', 'G6']}
                showLabels={true}
                useNativeAbacusNumbers={useNativeAbacusNumbers}
              />
            </div>
            <p
              className={css({
                fontSize: '12px',
                color: '#166534',
                mt: '12px',
                textAlign: 'center',
                fontStyle: 'italic',
              })}
            >
              {t(
                'guide.victory.exampleCaption',
                'White pieces 4, 8, 16 form a geometric progression in enemy territory. Black cannot break it - White wins!'
              )}
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
            <p className={css({ fontSize: '13px', color: '#15803d' })}>
              {t(
                'guide.victory.harmonyNote',
                'This is the primary victory condition in Rithmomachia'
              )}
            </p>
          </div>
        </div>

        <div>
          <h4
            className={css({
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#111827',
              mb: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            })}
          >
            <span>🚫</span>
            <span>{t('guide.victory.exhaustion', 'Victory #2: Exhaustion')}</span>
          </h4>
          <p className={css({ fontSize: '15px', lineHeight: '1.6', color: '#374151' })}>
            {t(
              'guide.victory.exhaustionDesc',
              'If your opponent has no legal moves at the start of their turn, they lose.'
            )}
          </p>
        </div>
      </div>

      <h3
        className={css({
          fontSize: { base: '18px', md: '20px' },
          fontWeight: 'bold',
          color: '#7c2d12',
          mb: '12px',
          mt: '32px',
        })}
      >
        {t('guide.victory.strategyTitle', 'Quick Strategy Tips')}
      </h3>
      <ul
        className={css({
          fontSize: '14px',
          lineHeight: '1.8',
          pl: '20px',
          color: '#374151',
        })}
      >
        <li>{t('guide.victory.tip1', 'Control the center — easier to invade enemy territory')}</li>
        <li>
          {t(
            'guide.victory.tip2',
            'Small pieces are fast — circles (3, 5, 7, 9) can slip into enemy half quickly'
          )}
        </li>
        <li>
          {t(
            'guide.victory.tip3',
            'Large pieces are powerful — harder to capture due to their size'
          )}
        </li>
        <li>
          {t(
            'guide.victory.tip4',
            "Watch for harmony threats — don't let opponent get 3 pieces deep in your territory"
          )}
        </li>
        <li>
          {t(
            'guide.victory.tip5',
            'Pyramids are flexible — choose the right face value for each situation'
          )}
        </li>
      </ul>
    </div>
  )
}
