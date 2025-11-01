import { useTranslations } from 'next-intl'
import { css } from '../../../../../styled-system/css'
import { RithmomachiaBoard, type ExamplePiece } from '../RithmomachiaBoard'

export function OverviewSection({ useNativeAbacusNumbers }: { useNativeAbacusNumbers: boolean }) {
  const t = useTranslations('rithmomachia.guide')

  // Initial board setup - full starting position
  const initialSetup: ExamplePiece[] = [
    // BLACK - Column A
    { square: 'A1', type: 'S', color: 'B', value: 28 },
    { square: 'A2', type: 'S', color: 'B', value: 66 },
    { square: 'A7', type: 'S', color: 'B', value: 225 },
    { square: 'A8', type: 'S', color: 'B', value: 361 },
    // BLACK - Column B
    { square: 'B1', type: 'S', color: 'B', value: 28 },
    { square: 'B2', type: 'S', color: 'B', value: 66 },
    { square: 'B3', type: 'T', color: 'B', value: 36 },
    { square: 'B4', type: 'T', color: 'B', value: 30 },
    { square: 'B5', type: 'T', color: 'B', value: 56 },
    { square: 'B6', type: 'T', color: 'B', value: 64 },
    { square: 'B7', type: 'S', color: 'B', value: 120 },
    { square: 'B8', type: 'P', color: 'B', value: 36 },
    // BLACK - Column C
    { square: 'C1', type: 'T', color: 'B', value: 16 },
    { square: 'C2', type: 'T', color: 'B', value: 12 },
    { square: 'C3', type: 'C', color: 'B', value: 9 },
    { square: 'C4', type: 'C', color: 'B', value: 25 },
    { square: 'C5', type: 'C', color: 'B', value: 49 },
    { square: 'C6', type: 'C', color: 'B', value: 81 },
    { square: 'C7', type: 'T', color: 'B', value: 90 },
    { square: 'C8', type: 'T', color: 'B', value: 100 },
    // BLACK - Column D
    { square: 'D3', type: 'C', color: 'B', value: 3 },
    { square: 'D4', type: 'C', color: 'B', value: 5 },
    { square: 'D5', type: 'C', color: 'B', value: 7 },
    { square: 'D6', type: 'C', color: 'B', value: 9 },
    // WHITE - Column M
    { square: 'M3', type: 'C', color: 'W', value: 8 },
    { square: 'M4', type: 'C', color: 'W', value: 6 },
    { square: 'M5', type: 'C', color: 'W', value: 4 },
    { square: 'M6', type: 'C', color: 'W', value: 2 },
    // WHITE - Column N
    { square: 'N1', type: 'T', color: 'W', value: 81 },
    { square: 'N2', type: 'T', color: 'W', value: 72 },
    { square: 'N3', type: 'C', color: 'W', value: 64 },
    { square: 'N4', type: 'C', color: 'W', value: 16 },
    { square: 'N5', type: 'C', color: 'W', value: 16 },
    { square: 'N6', type: 'C', color: 'W', value: 4 },
    { square: 'N7', type: 'T', color: 'W', value: 6 },
    { square: 'N8', type: 'T', color: 'W', value: 9 },
    // WHITE - Column O
    { square: 'O1', type: 'S', color: 'W', value: 153 },
    { square: 'O2', type: 'P', color: 'W', value: 64 },
    { square: 'O3', type: 'T', color: 'W', value: 72 },
    { square: 'O4', type: 'T', color: 'W', value: 20 },
    { square: 'O5', type: 'T', color: 'W', value: 20 },
    { square: 'O6', type: 'T', color: 'W', value: 25 },
    { square: 'O7', type: 'S', color: 'W', value: 45 },
    { square: 'O8', type: 'S', color: 'W', value: 15 },
    // WHITE - Column P
    { square: 'P1', type: 'S', color: 'W', value: 289 },
    { square: 'P2', type: 'S', color: 'W', value: 169 },
    { square: 'P7', type: 'S', color: 'W', value: 81 },
    { square: 'P8', type: 'S', color: 'W', value: 25 },
  ]

  return (
    <div data-section="overview">
      <h3
        className={css({
          fontSize: { base: '20px', md: '24px' },
          fontWeight: 'bold',
          color: '#7c2d12',
          mb: '16px',
        })}
      >
        {t('overview.goalTitle')}
      </h3>
      <p className={css({ fontSize: '16px', lineHeight: '1.6', mb: '20px', color: '#374151' })}>
        {t('overview.goal')}
      </p>

      <h3
        className={css({
          fontSize: { base: '18px', md: '20px' },
          fontWeight: 'bold',
          color: '#7c2d12',
          mb: '12px',
          mt: '24px',
        })}
      >
        {t('overview.boardTitle')}
      </h3>

      <div className={css({ mb: '20px' })}>
        <RithmomachiaBoard
          pieces={initialSetup}
          scale={0.6}
          showLabels={true}
          useNativeAbacusNumbers={useNativeAbacusNumbers}
        />
      </div>

      <p className={css({ fontSize: '14px', color: '#6b7280', mb: '20px', fontStyle: 'italic' })}>
        {t('overview.boardCaption')}
      </p>

      <ul
        className={css({
          fontSize: '15px',
          lineHeight: '1.8',
          pl: '20px',
          mb: '20px',
          color: '#374151',
        })}
      >
        <li>{t('overview.boardSize')}</li>
        <li>{t('overview.territory')}</li>
        <li>{t('overview.enemyTerritory')}</li>
      </ul>

      <h3
        className={css({
          fontSize: { base: '18px', md: '20px' },
          fontWeight: 'bold',
          color: '#7c2d12',
          mb: '12px',
          mt: '24px',
        })}
      >
        {t('overview.howToPlayTitle')}
      </h3>
      <ol
        className={css({
          fontSize: '15px',
          lineHeight: '1.8',
          pl: '20px',
          color: '#374151',
        })}
      >
        <li>{t('overview.step1')}</li>
        <li>{t('overview.step2')}</li>
        <li>{t('overview.step3')}</li>
        <li>{t('overview.step4')}</li>
        <li>{t('overview.step5')}</li>
      </ol>
    </div>
  )
}
