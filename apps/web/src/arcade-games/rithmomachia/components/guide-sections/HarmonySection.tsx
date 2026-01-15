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

export function HarmonySection({ useNativeAbacusNumbers }: { useNativeAbacusNumbers: boolean }) {
  const t = useTranslations('rithmomachia.guide')

  // Example board positions for harmonies (White pieces in Black's territory: rows 5-8)
  const arithmeticExample: ExamplePiece[] = [
    { square: 'E6', type: 'C', color: 'W', value: 6 }, // White's 6
    { square: 'F6', type: 'C', color: 'W', value: 9 }, // White's 9 (middle)
    { square: 'G6', type: 'T', color: 'W', value: 12 }, // White's 12 (arithmetic: 9 = (6+12)/2)
  ]

  const geometricExample: ExamplePiece[] = [
    { square: 'E6', type: 'C', color: 'W', value: 4 }, // White's 4
    { square: 'F6', type: 'C', color: 'W', value: 8 }, // White's 8 (middle)
    { square: 'G6', type: 'T', color: 'W', value: 16 }, // White's 16 (geometric: 8² = 4×16 = 64)
  ]

  const harmonicExample: ExamplePiece[] = [
    { square: 'E6', type: 'C', color: 'W', value: 6 }, // White's 6
    { square: 'F6', type: 'C', color: 'W', value: 8 }, // White's 8 (middle)
    { square: 'G6', type: 'T', color: 'W', value: 12 }, // White's 12 (harmonic: 2×6×12 = 144 = 8×18)
  ]

  return (
    <div data-section="harmony">
      <h3
        className={css({
          fontSize: { base: '20px', md: '24px' },
          fontWeight: 'bold',
          color: '#7c2d12',
          mb: '16px',
        })}
      >
        {t('harmony.title')}
      </h3>
      <p
        className={css({
          fontSize: '15px',
          lineHeight: '1.6',
          mb: '8px',
          color: '#374151',
        })}
      >
        {t('harmony.intro')}
      </p>
      <p
        className={css({
          fontSize: '14px',
          lineHeight: '1.6',
          mb: '24px',
          color: '#6b7280',
        })}
      >
        {t('harmony.introDetail')}
      </p>

      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        })}
      >
        {/* Arithmetic Progression */}
        <div
          className={css({
            p: '16px',
            bg: '#f0fdf4',
            border: '2px solid #86efac',
            borderRadius: '8px',
          })}
        >
          <h4
            className={css({
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#15803d',
              mb: '8px',
            })}
          >
            {t('harmony.arithmetic')}
          </h4>
          <p
            className={css({
              fontSize: '14px',
              color: '#166534',
              mb: '12px',
              lineHeight: '1.6',
            })}
          >
            {t('harmony.arithmeticDesc')}
          </p>

          <div
            className={css({
              bg: 'white',
              p: '12px',
              borderRadius: '6px',
              mb: '12px',
              border: '1px solid #86efac',
            })}
          >
            <p
              className={css({
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#15803d',
                mb: '8px',
              })}
            >
              {t('harmony.howToCheck')}
            </p>
            <p
              className={css({
                fontSize: '14px',
                color: '#166534',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                mb: '12px',
              })}
            >
              {t('harmony.arithmeticFormula')}
            </p>

            <div
              className={css({
                fontSize: '13px',
                color: '#166534',
                lineHeight: '1.8',
              })}
            >
              <p className={css({ fontWeight: 'bold', mb: '4px' })}>
                {t('harmony.example')} 6, 9, 12
              </p>
              <p>
                {t('harmony.differences')} 9−6=3, 12−9=3 {t('harmony.equal')}
              </p>
              <p>{t('harmony.check')} 9×2 = 18 = 6+12 ✓</p>
            </div>
          </div>

          <div
            className={css({
              display: 'flex',
              justifyContent: 'center',
              mb: '12px',
            })}
          >
            <RithmomachiaBoard
              pieces={arithmeticExample}
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
              textAlign: 'center',
              fontStyle: 'italic',
              mb: '12px',
            })}
          >
            {t('harmony.arithmeticCaption')}
          </p>

          <div
            className={css({
              bg: 'rgba(21, 128, 61, 0.1)',
              p: '10px',
              borderRadius: '6px',
              borderLeft: '3px solid #15803d',
            })}
          >
            <p className={css({ fontSize: '13px', color: '#15803d' })}>
              <strong>{t('harmony.strategyTip')}</strong> {t('harmony.arithmeticTip')}
            </p>
          </div>
        </div>

        {/* Geometric Progression */}
        <div
          className={css({
            p: '16px',
            bg: '#fef3c7',
            border: '2px solid #fcd34d',
            borderRadius: '8px',
          })}
        >
          <h4
            className={css({
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#92400e',
              mb: '8px',
            })}
          >
            {t('harmony.geometric')}
          </h4>
          <p
            className={css({
              fontSize: '14px',
              color: '#78350f',
              mb: '12px',
              lineHeight: '1.6',
            })}
          >
            {t('harmony.geometricDesc')}
          </p>

          <div
            className={css({
              bg: 'white',
              p: '12px',
              borderRadius: '6px',
              mb: '12px',
              border: '1px solid #fcd34d',
            })}
          >
            <p
              className={css({
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#92400e',
                mb: '8px',
              })}
            >
              {t('harmony.howToCheck')}
            </p>
            <p
              className={css({
                fontSize: '14px',
                color: '#78350f',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                mb: '12px',
              })}
            >
              {t('harmony.geometricFormula')}
            </p>

            <div
              className={css({
                fontSize: '13px',
                color: '#78350f',
                lineHeight: '1.8',
              })}
            >
              <p className={css({ fontWeight: 'bold', mb: '4px' })}>
                {t('harmony.example')} 4, 8, 16
              </p>
              <p>
                {t('harmony.ratios')} 8÷4=2, 16÷8=2 {t('harmony.equal')}
              </p>
              <p>{t('harmony.check')} 8² = 64 = 4×16 ✓</p>
            </div>
          </div>

          <div
            className={css({
              display: 'flex',
              justifyContent: 'center',
              mb: '12px',
            })}
          >
            <RithmomachiaBoard
              pieces={geometricExample}
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
              color: '#78350f',
              textAlign: 'center',
              fontStyle: 'italic',
              mb: '12px',
            })}
          >
            {t('harmony.geometricCaption')}
          </p>

          <div
            className={css({
              bg: 'rgba(146, 64, 14, 0.1)',
              p: '10px',
              borderRadius: '6px',
              borderLeft: '3px solid #92400e',
            })}
          >
            <p className={css({ fontSize: '13px', color: '#92400e' })}>
              <strong>{t('harmony.strategyTip')}</strong> {t('harmony.geometricTip')}
            </p>
          </div>
        </div>

        {/* Harmonic Progression */}
        <div
          className={css({
            p: '16px',
            bg: '#dbeafe',
            border: '2px solid #93c5fd',
            borderRadius: '8px',
          })}
        >
          <h4
            className={css({
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#1e40af',
              mb: '8px',
            })}
          >
            {t('harmony.harmonic')}
          </h4>
          <p
            className={css({
              fontSize: '14px',
              color: '#1e3a8a',
              mb: '12px',
              lineHeight: '1.6',
            })}
          >
            {t('harmony.harmonicDesc')}
          </p>

          <div
            className={css({
              bg: 'white',
              p: '12px',
              borderRadius: '6px',
              mb: '12px',
              border: '1px solid #93c5fd',
            })}
          >
            <p
              className={css({
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#1e40af',
                mb: '8px',
              })}
            >
              {t('harmony.howToCheck')}
            </p>
            <p
              className={css({
                fontSize: '14px',
                color: '#1e3a8a',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                mb: '12px',
              })}
            >
              {t('harmony.harmonicFormula')}
            </p>

            <div
              className={css({
                fontSize: '13px',
                color: '#1e3a8a',
                lineHeight: '1.8',
              })}
            >
              <p className={css({ fontWeight: 'bold', mb: '4px' })}>
                {t('harmony.example')} 6, 8, 12
              </p>
              <p>{t('harmony.check')} 2×6×12 = 144 = 8×(6+12) = 8×18 ✓</p>
            </div>
          </div>

          <div
            className={css({
              display: 'flex',
              justifyContent: 'center',
              mb: '12px',
            })}
          >
            <RithmomachiaBoard
              pieces={harmonicExample}
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
              color: '#1e3a8a',
              textAlign: 'center',
              fontStyle: 'italic',
              mb: '12px',
            })}
          >
            {t('harmony.harmonicCaption')}
          </p>

          <div
            className={css({
              bg: 'rgba(30, 64, 175, 0.1)',
              p: '10px',
              borderRadius: '6px',
              borderLeft: '3px solid #1e40af',
            })}
          >
            <p className={css({ fontSize: '13px', color: '#1e40af' })}>
              <strong>{t('harmony.strategyTip')}</strong> {t('harmony.harmonicTip')}
            </p>
          </div>
        </div>
      </div>

      {/* Strategy Section */}
      <div className={css({ mt: '24px' })}>
        <h3
          className={css({
            fontSize: { base: '18px', md: '20px' },
            fontWeight: 'bold',
            color: '#7c2d12',
            mb: '16px',
          })}
        >
          {t('harmony.strategyTitle')}
        </h3>

        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          })}
        >
          {/* Start with 2, Add the Third */}
          <div>
            <h4
              className={css({
                fontSize: '15px',
                fontWeight: 'bold',
                color: '#374151',
                mb: '8px',
              })}
            >
              {t('harmony.startWith2Title')}
            </h4>
            <p
              className={css({
                fontSize: '14px',
                color: '#6b7280',
                lineHeight: '1.6',
              })}
            >
              {t('harmony.startWith2')}
            </p>
          </div>

          {/* Use Common Values */}
          <div>
            <h4
              className={css({
                fontSize: '15px',
                fontWeight: 'bold',
                color: '#374151',
                mb: '8px',
              })}
            >
              {t('harmony.useCommonTitle')}
            </h4>
            <p
              className={css({
                fontSize: '14px',
                color: '#6b7280',
                lineHeight: '1.6',
              })}
            >
              {t('harmony.useCommon')}
            </p>
          </div>

          {/* Protect the Line */}
          <div>
            <h4
              className={css({
                fontSize: '15px',
                fontWeight: 'bold',
                color: '#374151',
                mb: '8px',
              })}
            >
              {t('harmony.protectTitle')}
            </h4>
            <p
              className={css({
                fontSize: '14px',
                color: '#6b7280',
                lineHeight: '1.6',
              })}
            >
              {t('harmony.protect')}
            </p>
          </div>

          {/* Block Opponent's Harmonies */}
          <div>
            <h4
              className={css({
                fontSize: '15px',
                fontWeight: 'bold',
                color: '#374151',
                mb: '8px',
              })}
            >
              {t('harmony.blockTitle')}
            </h4>
            <p
              className={css({
                fontSize: '14px',
                color: '#6b7280',
                lineHeight: '1.6',
              })}
            >
              {t('harmony.block')}
            </p>
          </div>

          {/* Calculate Before You Declare */}
          <div>
            <h4
              className={css({
                fontSize: '15px',
                fontWeight: 'bold',
                color: '#374151',
                mb: '8px',
              })}
            >
              {t('harmony.calculateTitle')}
            </h4>
            <p
              className={css({
                fontSize: '14px',
                color: '#6b7280',
                lineHeight: '1.6',
              })}
            >
              {t('harmony.calculate')}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Reference Tables */}
      <div className={css({ mt: '24px' })}>
        <h3
          className={css({
            fontSize: { base: '18px', md: '20px' },
            fontWeight: 'bold',
            color: '#7c2d12',
            mb: '16px',
          })}
        >
          {t('harmony.quickRefTitle')}
        </h3>

        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: { base: '1fr', md: 'repeat(3, 1fr)' },
            gap: '16px',
          })}
        >
          {/* Arithmetic Table */}
          <div
            className={css({
              p: '12px',
              bg: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '6px',
            })}
          >
            <h4
              className={css({
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#15803d',
                mb: '8px',
              })}
            >
              {t('harmony.arithmetic')}
            </h4>
            <ul
              className={css({
                fontSize: '13px',
                color: '#166534',
                fontFamily: 'monospace',
                lineHeight: '1.6',
                pl: '0',
                listStyle: 'none',
              })}
            >
              <li>(4, 6, 8)</li>
              <li>(5, 7, 9)</li>
              <li>(6, 9, 12)</li>
              <li>(8, 12, 16)</li>
              <li>(10, 15, 20)</li>
            </ul>
          </div>

          {/* Geometric Table */}
          <div
            className={css({
              p: '12px',
              bg: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: '6px',
            })}
          >
            <h4
              className={css({
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#92400e',
                mb: '8px',
              })}
            >
              {t('harmony.geometric')}
            </h4>
            <ul
              className={css({
                fontSize: '13px',
                color: '#78350f',
                fontFamily: 'monospace',
                lineHeight: '1.6',
                pl: '0',
                listStyle: 'none',
              })}
            >
              <li>(2, 8, 32)</li>
              <li>(3, 9, 27)</li>
              <li>(4, 8, 16)</li>
              <li>(4, 16, 64)</li>
              <li>(5, 25, 125)</li>
            </ul>
          </div>

          {/* Harmonic Table */}
          <div
            className={css({
              p: '12px',
              bg: '#dbeafe',
              border: '1px solid #93c5fd',
              borderRadius: '6px',
            })}
          >
            <h4
              className={css({
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#1e40af',
                mb: '8px',
              })}
            >
              {t('harmony.harmonic')}
            </h4>
            <ul
              className={css({
                fontSize: '13px',
                color: '#1e3a8a',
                fontFamily: 'monospace',
                lineHeight: '1.6',
                pl: '0',
                listStyle: 'none',
              })}
            >
              <li>(3, 4, 6)</li>
              <li>(4, 6, 12)</li>
              <li>(6, 8, 12)</li>
              <li>(6, 10, 15)</li>
              <li>(8, 12, 24)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
