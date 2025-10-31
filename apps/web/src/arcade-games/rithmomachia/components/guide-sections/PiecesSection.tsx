import { useTranslation } from 'react-i18next'
import { css } from '../../../../../styled-system/css'
import { PieceRenderer } from '../PieceRenderer'
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
          {t('guide.pieces.pyramidTitle', '⭐ Pyramids are special')}
        </h4>
        <p className={css({ fontSize: '14px', color: '#78350f', lineHeight: '1.6', mb: '16px' })}>
          {t(
            'guide.pieces.pyramidDescription',
            'Each side has 1 Pyramid. Pyramids have 4 face values - when capturing, you choose which value to use. They move one step in any direction.'
          )}
        </p>

        <div className={css({ display: 'flex', gap: '32px', flexWrap: 'wrap', mt: '16px' })}>
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
              {t('guide.pieces.blackPyramid', 'Black Pyramid')}
            </p>
            <div className={css({ width: '80px', height: '80px' })}>
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
                fontSize: '12px',
                color: '#78350f',
                mt: '8px',
                textAlign: 'center',
                fontStyle: 'italic',
              })}
            >
              {t('guide.pieces.pyramidValues', 'Values')}: 36, 25, 16, 4
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
              {t('guide.pieces.whitePyramid', 'White Pyramid')}
            </p>
            <div className={css({ width: '80px', height: '80px' })}>
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
                fontSize: '12px',
                color: '#78350f',
                mt: '8px',
                textAlign: 'center',
                fontStyle: 'italic',
              })}
            >
              {t('guide.pieces.pyramidValues', 'Values')}: 64, 49, 36, 25
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
