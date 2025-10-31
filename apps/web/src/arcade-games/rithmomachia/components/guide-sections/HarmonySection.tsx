import { useTranslation } from 'react-i18next'
import { css } from '../../../../../styled-system/css'
import { RithmomachiaBoard, type ExamplePiece } from '../RithmomachiaBoard'

export function HarmonySection({ useNativeAbacusNumbers }: { useNativeAbacusNumbers: boolean }) {
  const { t } = useTranslation()

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
        {t('guide.harmony.title', 'Harmonies (Progressions)')}
      </h3>
      <p className={css({ fontSize: '15px', lineHeight: '1.6', mb: '24px', color: '#374151' })}>
        {t(
          'guide.harmony.description',
          'Get 3 of your pieces into enemy territory forming one of these progressions:'
        )}
      </p>

      <div className={css({ display: 'flex', flexDirection: 'column', gap: '20px' })}>
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
            className={css({ fontSize: '16px', fontWeight: 'bold', color: '#15803d', mb: '8px' })}
          >
            {t('guide.harmony.arithmetic', 'Arithmetic Progression')}
          </h4>
          <p className={css({ fontSize: '14px', color: '#166534', mb: '8px' })}>
            {t('guide.harmony.arithmeticDesc', 'Middle value is the average')}
          </p>
          <p
            className={css({
              fontSize: '13px',
              color: '#16a34a',
              fontFamily: 'monospace',
              mb: '12px',
            })}
          >
            {t('guide.harmony.arithmeticExample', 'Example: 6, 9, 12 (because 9 = (6+12)/2)')}
          </p>
          <div className={css({ display: 'flex', justifyContent: 'center' })}>
            <RithmomachiaBoard
              pieces={arithmeticExample}
              scale={0.4}
              cropToSquares={['D5', 'H7']}
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
            {t(
              'guide.harmony.arithmeticCaption',
              'White pieces 6, 9, 12 in a row in enemy territory form an arithmetic progression'
            )}
          </p>
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
            className={css({ fontSize: '16px', fontWeight: 'bold', color: '#92400e', mb: '8px' })}
          >
            {t('guide.harmony.geometric', 'Geometric Progression')}
          </h4>
          <p className={css({ fontSize: '14px', color: '#78350f', mb: '8px' })}>
            {t('guide.harmony.geometricDesc', 'Middle value is geometric mean')}
          </p>
          <p
            className={css({
              fontSize: '13px',
              color: '#a16207',
              fontFamily: 'monospace',
              mb: '12px',
            })}
          >
            {t('guide.harmony.geometricExample', 'Example: 4, 8, 16 (because 8² = 4×16)')}
          </p>
          <div className={css({ display: 'flex', justifyContent: 'center' })}>
            <RithmomachiaBoard
              pieces={geometricExample}
              scale={0.4}
              cropToSquares={['D5', 'H7']}
              showLabels={true}
              useNativeAbacusNumbers={useNativeAbacusNumbers}
            />
          </div>
          <p
            className={css({
              fontSize: '12px',
              color: '#78350f',
              mt: '8px',
              textAlign: 'center',
              fontStyle: 'italic',
            })}
          >
            {t(
              'guide.harmony.geometricCaption',
              'White pieces 4, 8, 16 in a row in enemy territory form a geometric progression'
            )}
          </p>
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
            className={css({ fontSize: '16px', fontWeight: 'bold', color: '#1e40af', mb: '8px' })}
          >
            {t('guide.harmony.harmonic', 'Harmonic Progression')}
          </h4>
          <p className={css({ fontSize: '14px', color: '#1e3a8a', mb: '8px' })}>
            {t('guide.harmony.harmonicDesc', 'Special proportion (formula: 2AB = M(A+B))')}
          </p>
          <p
            className={css({
              fontSize: '13px',
              color: '#2563eb',
              fontFamily: 'monospace',
              mb: '12px',
            })}
          >
            {t('guide.harmony.harmonicExample', 'Example: 6, 8, 12 (because 2×6×12 = 8×(6+12))')}
          </p>
          <div className={css({ display: 'flex', justifyContent: 'center' })}>
            <RithmomachiaBoard
              pieces={harmonicExample}
              scale={0.4}
              cropToSquares={['D5', 'H7']}
              showLabels={true}
              useNativeAbacusNumbers={useNativeAbacusNumbers}
            />
          </div>
          <p
            className={css({
              fontSize: '12px',
              color: '#1e3a8a',
              mt: '8px',
              textAlign: 'center',
              fontStyle: 'italic',
            })}
          >
            {t(
              'guide.harmony.harmonicCaption',
              'White pieces 6, 8, 12 in a row in enemy territory form a harmonic progression'
            )}
          </p>
        </div>
      </div>

      <div
        className={css({
          mt: '24px',
          p: '16px',
          bg: 'rgba(239, 68, 68, 0.1)',
          borderLeft: '4px solid #ef4444',
          borderRadius: '4px',
        })}
      >
        <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#991b1b', mb: '8px' })}>
          {t('guide.harmony.rulesTitle', '⚠️ Important Rules')}
        </p>
        <ul className={css({ fontSize: '14px', color: '#7f1d1d', lineHeight: '1.8', pl: '20px' })}>
          <li>
            {t(
              'guide.harmony.rule1',
              'Your 3 pieces must be in a straight line (row, column, or diagonal)'
            )}
          </li>
          <li>{t('guide.harmony.rule2', 'All 3 must be in enemy territory')}</li>
          <li>
            {t(
              'guide.harmony.rule3',
              'When you form a harmony, your opponent gets one turn to break it'
            )}
          </li>
          <li>{t('guide.harmony.rule4', 'If it survives, you win!')}</li>
        </ul>
      </div>
    </div>
  )
}
