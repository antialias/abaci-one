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

export function VictorySection({ useNativeAbacusNumbers }: { useNativeAbacusNumbers: boolean }) {
  const t = useTranslations('rithmomachia.guide')

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
        {t('victory.title')}
      </h3>

      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        })}
      >
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
            <span>{t('victory.harmony')}</span>
          </h4>
          <p
            className={css({
              fontSize: '15px',
              lineHeight: '1.6',
              color: '#374151',
              mb: '16px',
            })}
          >
            {t('victory.harmonyDesc')}
          </p>

          {/* Requirements Section */}
          <div
            className={css({
              mb: '16px',
              p: '16px',
              bg: 'rgba(251, 191, 36, 0.1)',
              borderLeft: '4px solid #f59e0b',
              borderRadius: '4px',
            })}
          >
            <p
              className={css({
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#92400e',
                mb: '12px',
              })}
            >
              {t('victory.requirementsTitle')}
            </p>
            <ul
              className={css({
                fontSize: '14px',
                color: '#78350f',
                lineHeight: '1.8',
                pl: '20px',
              })}
            >
              <li>
                <strong>{t('victory.enemyTerritoryTitle')}</strong> {t('victory.enemyTerritory')}
              </li>
              <li>
                <strong>{t('victory.straightLineTitle')}</strong> {t('victory.straightLine')}
              </li>
              <li>
                <strong>{t('victory.adjacentTitle')}</strong> {t('victory.adjacent')}
              </li>
              <li>
                <strong>{t('victory.progressionTitle')}</strong> {t('victory.progression')}
              </li>
              <li>
                <strong>{t('victory.survivalTitle')}</strong> {t('victory.survival')}
              </li>
            </ul>
          </div>

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
              {t('victory.exampleTitle')}
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
              {t('victory.exampleCaption')}
            </p>
          </div>

          <div
            className={css({
              p: '12px',
              bg: '#dbeafe',
              borderRadius: '6px',
              border: '1px solid #93c5fd',
            })}
          >
            <p className={css({ fontSize: '13px', color: '#1e40af' })}>
              💡 {t('victory.harmonyNote')}
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
            <span>{t('victory.exhaustion')}</span>
          </h4>
          <p
            className={css({
              fontSize: '15px',
              lineHeight: '1.6',
              color: '#374151',
            })}
          >
            {t('victory.exhaustionDesc')}
          </p>
        </div>
      </div>

      <div className={css({ mt: '32px' })}>
        <h3
          className={css({
            fontSize: { base: '18px', md: '20px' },
            fontWeight: 'bold',
            color: '#7c2d12',
            mb: '12px',
          })}
        >
          {t('victory.strategyTitle')}
        </h3>
        <ul
          className={css({
            fontSize: '14px',
            lineHeight: '1.8',
            pl: '20px',
            color: '#374151',
          })}
        >
          <li>{t('victory.tip1')}</li>
          <li>{t('victory.tip2')}</li>
          <li>{t('victory.tip3')}</li>
          <li>{t('victory.tip4')}</li>
          <li>{t('victory.tip5')}</li>
        </ul>
      </div>
    </div>
  )
}
