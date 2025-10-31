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
        {t('guide.harmony.title', 'Harmonies: The Elegant Victory')}
      </h3>
      <p className={css({ fontSize: '15px', lineHeight: '1.6', mb: '8px', color: '#374151' })}>
        {t(
          'guide.harmony.intro',
          'A Harmony (also called a "Proper Victory") is the most sophisticated way to win. Get 3 of your pieces into enemy territory arranged in a straight line where their values form a mathematical pattern.'
        )}
      </p>
      <p className={css({ fontSize: '14px', lineHeight: '1.6', mb: '24px', color: '#6b7280' })}>
        {t(
          'guide.harmony.introDetail',
          'Think of it like getting three numbers in a sequence—but the sequences follow special mathematical rules from ancient philosophy and music theory.'
        )}
      </p>

      <div className={css({ display: 'flex', flexDirection: 'column', gap: '24px' })}>
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
            className={css({ fontSize: '18px', fontWeight: 'bold', color: '#15803d', mb: '8px' })}
          >
            {t('guide.harmony.arithmetic', '1. Arithmetic Progression (Easiest to Understand)')}
          </h4>
          <p className={css({ fontSize: '14px', color: '#166534', mb: '12px', lineHeight: '1.6' })}>
            {t(
              'guide.harmony.arithmeticDesc',
              'The middle number is exactly halfway between the other two. In other words, the differences are equal.'
            )}
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
              {t('guide.harmony.howToCheck', 'How to check:')}
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
              {t('guide.harmony.arithmeticFormula', 'Middle × 2 = First + Last')}
            </p>

            <div className={css({ fontSize: '13px', color: '#166534', lineHeight: '1.8' })}>
              <p className={css({ fontWeight: 'bold', mb: '4px' })}>
                {t('guide.harmony.example', 'Example:')} 6, 9, 12
              </p>
              <p>
                {t('guide.harmony.differences', 'Differences:')} 9−6=3, 12−9=3{' '}
                {t('guide.harmony.equal', '(equal!)')}
              </p>
              <p>{t('guide.harmony.check', 'Check:')} 9×2 = 18 = 6+12 ✓</p>
            </div>
          </div>

          <div className={css({ display: 'flex', justifyContent: 'center', mb: '12px' })}>
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
              textAlign: 'center',
              fontStyle: 'italic',
              mb: '12px',
            })}
          >
            {t(
              'guide.harmony.arithmeticCaption',
              'White pieces 6, 9, 12 in a row in enemy territory form an arithmetic progression'
            )}
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
              <strong>{t('guide.harmony.strategyTip', 'Strategy tip:')}</strong>{' '}
              {t(
                'guide.harmony.arithmeticTip',
                'Your small circles (2-9) and many triangles naturally form arithmetic progressions. Look for three pieces where the gaps are equal!'
              )}
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
            className={css({ fontSize: '18px', fontWeight: 'bold', color: '#92400e', mb: '8px' })}
          >
            {t('guide.harmony.geometric', '2. Geometric Progression (Powers and Multiples)')}
          </h4>
          <p className={css({ fontSize: '14px', color: '#78350f', mb: '12px', lineHeight: '1.6' })}>
            {t(
              'guide.harmony.geometricDesc',
              'Each number is multiplied by the same amount to get the next. The ratios are equal.'
            )}
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
              {t('guide.harmony.howToCheck', 'How to check:')}
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
              {t('guide.harmony.geometricFormula', 'Middle² = First × Last')}
            </p>

            <div className={css({ fontSize: '13px', color: '#78350f', lineHeight: '1.8' })}>
              <p className={css({ fontWeight: 'bold', mb: '4px' })}>
                {t('guide.harmony.example', 'Example:')} 4, 8, 16
              </p>
              <p>
                {t('guide.harmony.ratios', 'Ratios:')} 8÷4=2, 16÷8=2{' '}
                {t('guide.harmony.equal', '(equal!)')}
              </p>
              <p>{t('guide.harmony.check', 'Check:')} 8² = 64 = 4×16 ✓</p>
            </div>
          </div>

          <div className={css({ display: 'flex', justifyContent: 'center', mb: '12px' })}>
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
              textAlign: 'center',
              fontStyle: 'italic',
              mb: '12px',
            })}
          >
            {t(
              'guide.harmony.geometricCaption',
              'White pieces 4, 8, 16 in a row in enemy territory form a geometric progression'
            )}
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
              <strong>{t('guide.harmony.strategyTip', 'Strategy tip:')}</strong>{' '}
              {t(
                'guide.harmony.geometricTip',
                'Square values (4, 9, 16, 25, 36, 49, 64, 81) work great here! For example, 4-16-64 (squares of 2, 4, 8).'
              )}
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
            className={css({ fontSize: '18px', fontWeight: 'bold', color: '#1e40af', mb: '8px' })}
          >
            {t('guide.harmony.harmonic', '3. Harmonic Progression (Music-Based, Trickiest)')}
          </h4>
          <p className={css({ fontSize: '14px', color: '#1e3a8a', mb: '12px', lineHeight: '1.6' })}>
            {t(
              'guide.harmony.harmonicDesc',
              'Named after musical harmonies. The pattern is: the ratio of the outer numbers equals the ratio of their differences from the middle.'
            )}
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
              {t('guide.harmony.howToCheck', 'How to check:')}
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
              {t('guide.harmony.harmonicFormula', '2 × First × Last = Middle × (First + Last)')}
            </p>

            <div className={css({ fontSize: '13px', color: '#1e3a8a', lineHeight: '1.8' })}>
              <p className={css({ fontWeight: 'bold', mb: '4px' })}>
                {t('guide.harmony.example', 'Example:')} 6, 8, 12
              </p>
              <p>{t('guide.harmony.check', 'Check:')} 2×6×12 = 144 = 8×(6+12) = 8×18 ✓</p>
            </div>
          </div>

          <div className={css({ display: 'flex', justifyContent: 'center', mb: '12px' })}>
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
              textAlign: 'center',
              fontStyle: 'italic',
              mb: '12px',
            })}
          >
            {t(
              'guide.harmony.harmonicCaption',
              'White pieces 6, 8, 12 in a row in enemy territory form a harmonic progression'
            )}
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
              <strong>{t('guide.harmony.strategyTip', 'Strategy tip:')}</strong>{' '}
              {t(
                'guide.harmony.harmonicTip',
                'Harmonic progressions are rarer. Memorize common triads: (3,4,6), (4,6,12), (6,8,12), (6,10,15), (8,12,24).'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Rules Section */}
      <div
        className={css({
          mt: '24px',
          p: '16px',
          bg: 'rgba(239, 68, 68, 0.1)',
          borderLeft: '4px solid #ef4444',
          borderRadius: '4px',
        })}
      >
        <p className={css({ fontSize: '16px', fontWeight: 'bold', color: '#991b1b', mb: '12px' })}>
          {t('guide.harmony.rulesTitle', '⚠️ Harmony Rules You Must Follow')}
        </p>
        <ul className={css({ fontSize: '14px', color: '#7f1d1d', lineHeight: '1.8', pl: '20px' })}>
          <li>
            <strong>{t('guide.harmony.enemyTerritoryTitle', 'Enemy Territory Only:')}</strong>{' '}
            {t(
              'guide.harmony.enemyTerritory',
              "All 3 pieces must be in your opponent's half (White needs rows 5-8, Black needs rows 1-4)"
            )}
          </li>
          <li>
            <strong>{t('guide.harmony.straightLineTitle', 'Straight Line:')}</strong>{' '}
            {t(
              'guide.harmony.straightLine',
              'The 3 pieces must form a row, column, or diagonal—no scattered formations'
            )}
          </li>
          <li>
            <strong>{t('guide.harmony.adjacentTitle', 'Adjacent Placement:')}</strong>{' '}
            {t(
              'guide.harmony.adjacent',
              'In this implementation, the 3 pieces must be next to each other (no gaps)'
            )}
          </li>
          <li>
            <strong>{t('guide.harmony.survivalTitle', 'Survival Rule:')}</strong>{' '}
            {t(
              'guide.harmony.survival',
              'When you declare a harmony, your opponent gets ONE turn to break it by capturing or moving a piece'
            )}
          </li>
          <li>
            <strong>{t('guide.harmony.victoryTitle', 'Victory:')}</strong>{' '}
            {t(
              'guide.harmony.victoryRule',
              'If your harmony survives until your next turn starts—you win!'
            )}
          </li>
        </ul>
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
          {t('guide.harmony.strategyTitle', 'Strategy: How to Build Harmonies')}
        </h3>

        <div className={css({ display: 'flex', flexDirection: 'column', gap: '16px' })}>
          {/* Start with 2, Add the Third */}
          <div>
            <h4
              className={css({ fontSize: '15px', fontWeight: 'bold', color: '#374151', mb: '8px' })}
            >
              {t('guide.harmony.startWith2Title', 'Start with 2, Add the Third')}
            </h4>
            <p className={css({ fontSize: '14px', color: '#6b7280', lineHeight: '1.6' })}>
              {t(
                'guide.harmony.startWith2',
                "Get two pieces into enemy territory first. Calculate which third piece would complete a progression, then advance that piece. Your opponent may not notice the threat until it's too late!"
              )}
            </p>
          </div>

          {/* Use Common Values */}
          <div>
            <h4
              className={css({ fontSize: '15px', fontWeight: 'bold', color: '#374151', mb: '8px' })}
            >
              {t('guide.harmony.useCommonTitle', 'Use Common Values')}
            </h4>
            <p className={css({ fontSize: '14px', color: '#6b7280', lineHeight: '1.6' })}>
              {t(
                'guide.harmony.useCommon',
                'Pieces like 6, 8, 9, 12, 16 appear in multiple progressions. If you have these in enemy territory, calculate all possible third pieces that would complete a pattern.'
              )}
            </p>
          </div>

          {/* Protect the Line */}
          <div>
            <h4
              className={css({ fontSize: '15px', fontWeight: 'bold', color: '#374151', mb: '8px' })}
            >
              {t('guide.harmony.protectTitle', 'Protect the Line')}
            </h4>
            <p className={css({ fontSize: '14px', color: '#6b7280', lineHeight: '1.6' })}>
              {t(
                'guide.harmony.protect',
                'While building your harmony, position other pieces to defend your advancing pieces. One capture breaks the progression!'
              )}
            </p>
          </div>

          {/* Block Opponent's Harmonies */}
          <div>
            <h4
              className={css({ fontSize: '15px', fontWeight: 'bold', color: '#374151', mb: '8px' })}
            >
              {t('guide.harmony.blockTitle', "Block Opponent's Harmonies")}
            </h4>
            <p className={css({ fontSize: '14px', color: '#6b7280', lineHeight: '1.6' })}>
              {t(
                'guide.harmony.block',
                'If your opponent has 2 pieces in your territory forming part of a progression, identify which third piece would complete it. Block that square or capture one of the two pieces immediately.'
              )}
            </p>
          </div>

          {/* Calculate Before You Declare */}
          <div>
            <h4
              className={css({ fontSize: '15px', fontWeight: 'bold', color: '#374151', mb: '8px' })}
            >
              {t('guide.harmony.calculateTitle', 'Calculate Before You Declare')}
            </h4>
            <p className={css({ fontSize: '14px', color: '#6b7280', lineHeight: '1.6' })}>
              {t(
                'guide.harmony.calculate',
                'Before declaring harmony, examine if your opponent can capture any of the 3 pieces on their turn. If they can, either protect those pieces first or wait for a safer moment.'
              )}
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
          {t('guide.harmony.quickRefTitle', '💡 Quick Reference: Common Harmonies in Your Army')}
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
              {t('guide.harmony.arithmetic', 'Arithmetic')}
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
              {t('guide.harmony.geometric', 'Geometric')}
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
              {t('guide.harmony.harmonic', 'Harmonic')}
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
