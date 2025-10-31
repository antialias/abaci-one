import { useTranslation } from 'react-i18next'
import { css } from '../../../../../styled-system/css'
import { PieceRenderer } from '../PieceRenderer'
import { RithmomachiaBoard, } from '../RithmomachiaBoard'
import type { PieceType } from '../../types'

export function PiecesSection({ useNativeAbacusNumbers }: { useNativeAbacusNumbers: boolean }) {
  const { t } = useTranslation()
  const pieces: {
    type: PieceType
    name: string
    movement: string
    count: number
    exampleValues: number[]
  }[] = [
    {
      type: 'C',
      name: t('guide.pieces.circle', 'Circle'),
      movement: t('guide.pieces.circleMove', 'Moves diagonally'),
      count: 12,
      exampleValues: [3, 5, 7, 9],
    },
    {
      type: 'T',
      name: t('guide.pieces.triangle', 'Triangle'),
      movement: t('guide.pieces.triangleMove', 'Moves in straight lines'),
      count: 6,
      exampleValues: [12, 16, 20, 30],
    },
    {
      type: 'S',
      name: t('guide.pieces.square', 'Square'),
      movement: t('guide.pieces.squareMove', 'Moves in any direction'),
      count: 6,
      exampleValues: [25, 28, 45, 66],
    },
  ]

  return (
    <div data-section="pieces">
      <h3
        className={css({
          fontSize: { base: '20px', md: '24px' },
          fontWeight: 'bold',
          color: '#7c2d12',
          mb: '16px',
        })}
      >
        {t('guide.pieces.title', 'Your Pieces (25 total)')}
      </h3>
      <p className={css({ fontSize: '15px', mb: '24px', color: '#374151' })}>
        {t(
          'guide.pieces.description',
          'Each side has 25 pieces with different movement patterns. The shape tells you how it moves:'
        )}
      </p>

      <div className={css({ display: 'flex', flexDirection: 'column', gap: '24px' })}>
        {pieces.map((piece) => (
          <div
            key={piece.type}
            className={css({
              p: '16px',
              bg: '#f9fafb',
              borderRadius: '8px',
              border: '2px solid #e5e7eb',
            })}
          >
            <div
              className={css({ display: 'flex', alignItems: 'center', gap: '12px', mb: '12px' })}
            >
              <div
                className={css({
                  width: '60px',
                  height: '60px',
                  flexShrink: 0,
                })}
              >
                <PieceRenderer
                  type={piece.type}
                  color="W"
                  value={piece.exampleValues[0]}
                  size={60}
                  useNativeAbacusNumbers={useNativeAbacusNumbers}
                />
              </div>
              <div className={css({ flex: 1 })}>
                <h4
                  className={css({
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#111827',
                    mb: '4px',
                  })}
                >
                  {piece.name} ({piece.count} per side)
                </h4>
                <p className={css({ fontSize: '14px', color: '#6b7280' })}>{piece.movement}</p>
              </div>
            </div>

            {/* Example values */}
            <div className={css({ mt: '12px' })}>
              <p
                className={css({
                  fontSize: '13px',
                  color: '#9ca3af',
                  mb: '8px',
                  fontStyle: 'italic',
                })}
              >
                {t('guide.pieces.exampleValues', 'Example values')}:
              </p>
              <div className={css({ display: 'flex', gap: '12px', flexWrap: 'wrap' })}>
                {piece.exampleValues.map((value) => (
                  <div
                    key={value}
                    className={css({
                      width: '48px',
                      height: '48px',
                    })}
                  >
                    <PieceRenderer
                      type={piece.type}
                      color="W"
                      value={value}
                      size={48}
                      useNativeAbacusNumbers={useNativeAbacusNumbers}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pyramid section */}
      <div
        className={css({
          mt: '32px',
          p: '20px',
          bg: 'rgba(251, 191, 36, 0.1)',
          borderLeft: '4px solid #f59e0b',
          borderRadius: '4px',
        })}
      >
        <h4 className={css({ fontSize: '18px', fontWeight: 'bold', color: '#92400e', mb: '12px' })}>
          {t('guide.pieces.pyramidTitle', '⭐ Pyramids: The Multi-Faced Pieces')}
        </h4>
        <p className={css({ fontSize: '14px', color: '#78350f', lineHeight: '1.6', mb: '16px' })}>
          {t(
            'guide.pieces.pyramidIntro',
            'Unlike other pieces with a single value, Pyramids contain 4 face values representing perfect squares. When capturing an enemy piece, you choose which face to use for the mathematical relation.'
          )}
        </p>

        <div
          className={css({
            display: 'flex',
            gap: '32px',
            flexWrap: 'wrap',
            mt: '16px',
            mb: '20px',
          })}
        >
          {/* Black Pyramid */}
          <div>
            <p
              className={css({
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#92400e',
                mb: '8px',
                textAlign: 'center',
              })}
            >
              {t('guide.pieces.blackPyramid', 'Black Pyramid Faces')}:
            </p>
            <div className={css({ width: '80px', height: '80px', margin: '0 auto' })}>
              <PieceRenderer
                type="P"
                color="B"
                value="P"
                size={80}
                useNativeAbacusNumbers={useNativeAbacusNumbers}
              />
            </div>
            <p
              className={css({
                fontSize: '13px',
                color: '#78350f',
                mt: '8px',
                textAlign: 'center',
                fontWeight: 'bold',
              })}
            >
              {t('guide.pieces.blackPyramidValues', '36 (6²), 25 (5²), 16 (4²), 4 (2²)')}
            </p>
          </div>

          {/* White Pyramid */}
          <div>
            <p
              className={css({
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#92400e',
                mb: '8px',
                textAlign: 'center',
              })}
            >
              {t('guide.pieces.whitePyramid', 'White Pyramid Faces')}:
            </p>
            <div className={css({ width: '80px', height: '80px', margin: '0 auto' })}>
              <PieceRenderer
                type="P"
                color="W"
                value="P"
                size={80}
                useNativeAbacusNumbers={useNativeAbacusNumbers}
              />
            </div>
            <p
              className={css({
                fontSize: '13px',
                color: '#78350f',
                mt: '8px',
                textAlign: 'center',
                fontWeight: 'bold',
              })}
            >
              {t('guide.pieces.whitePyramidValues', '64 (8²), 49 (7²), 36 (6²), 25 (5²)')}
            </p>
          </div>
        </div>

        {/* How face selection works */}
        <div
          className={css({
            bg: 'white',
            p: '16px',
            borderRadius: '6px',
            mb: '16px',
            border: '1px solid #fbbf24',
          })}
        >
          <p
            className={css({
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#92400e',
              mb: '12px',
            })}
          >
            {t('guide.pieces.pyramidHowItWorks', 'How face selection works:')}
          </p>
          <ul
            className={css({ fontSize: '13px', color: '#78350f', lineHeight: '1.8', pl: '20px' })}
          >
            <li>
              {t(
                'guide.pieces.pyramidRule1',
                "When your Pyramid attempts a capture, you must declare which face value you're using before the relation is checked"
              )}
            </li>
            <li>
              {t(
                'guide.pieces.pyramidRule2',
                'The chosen face value becomes "your piece\'s value" for all mathematical relations (equality, multiple/divisor, sum, difference, product, ratio)'
              )}
            </li>
            <li>
              {t(
                'guide.pieces.pyramidRule3',
                'You can choose different faces for different captures—the Pyramid doesn\'t "lock in" to one value'
              )}
            </li>
            <li>
              {t(
                'guide.pieces.pyramidRule4',
                'This flexibility makes Pyramids excellent for creating unexpected capture opportunities and versatile helpers'
              )}
            </li>
          </ul>
        </div>

        {/* Example */}
        <div
          className={css({
            bg: 'rgba(146, 64, 14, 0.1)',
            p: '12px',
            borderRadius: '6px',
            mb: '20px',
          })}
        >
          <p className={css({ fontSize: '13px', color: '#78350f', lineHeight: '1.6' })}>
            <strong>{t('guide.pieces.example', 'Example:')}</strong>{' '}
            {t(
              'guide.pieces.pyramidExample',
              "White's Pyramid can capture Black's 16 using face 64 (multiple: 64÷16=4), face 36 (multiple: 36÷9=4, with Black's 9), or face 25 with equality if capturing Black's 25."
            )}
          </p>
        </div>

        {/* Visual Example */}
        <div>
          <h5
            className={css({
              fontSize: '15px',
              fontWeight: 'bold',
              color: '#92400e',
              mb: '12px',
            })}
          >
            {t(
              'guide.pieces.pyramidVisualTitle',
              "Visual Example: Pyramid's Multiple Capture Options"
            )}
          </h5>
          <p className={css({ fontSize: '13px', color: '#78350f', mb: '12px', lineHeight: '1.6' })}>
            {t(
              'guide.pieces.pyramidVisualDesc',
              "White's Pyramid (faces: 64, 49, 36, 25) is positioned to capture Black pieces. Notice the flexibility:"
            )}
          </p>

          <div className={css({ display: 'flex', justifyContent: 'center', mb: '12px' })}>
            <RithmomachiaBoard
              pieces={[
                // White Pyramid at H5
                { square: 'H5', type: 'P', color: 'W', value: 'P' },
                // Black pieces that can be captured
                { square: 'I5', type: 'T', color: 'B', value: 16 },
                { square: 'H6', type: 'S', color: 'B', value: 49 },
                { square: 'G5', type: 'C', color: 'B', value: 25 },
              ]}
              scale={0.4}
              cropToSquares={['F4', 'J7']}
              showLabels={true}
              useNativeAbacusNumbers={useNativeAbacusNumbers}
            />
          </div>

          <div
            className={css({
              bg: 'white',
              p: '12px',
              borderRadius: '6px',
              border: '1px solid #fbbf24',
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
              {t('guide.pieces.pyramidCaptureOptions', 'Capture options from H5:')}
            </p>
            <ul
              className={css({ fontSize: '13px', color: '#78350f', lineHeight: '1.8', pl: '20px' })}
            >
              <li>
                {t(
                  'guide.pieces.pyramidOption1',
                  'Move to I5: Choose face 64 → captures 16 by multiple (64÷16=4)'
                )}
              </li>
              <li>
                {t(
                  'guide.pieces.pyramidOption2',
                  'Move to H6: Choose face 49 → captures 49 by equality (49=49)'
                )}
              </li>
              <li>
                {t(
                  'guide.pieces.pyramidOption3',
                  'Move to G5: Choose face 25 → captures 25 by equality (25=25)'
                )}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
