import { useTranslation } from 'react-i18next'
import { css } from '../../../../../styled-system/css'
import { RithmomachiaBoard, type ExamplePiece } from '../RithmomachiaBoard'

export function CaptureSection({ useNativeAbacusNumbers }: { useNativeAbacusNumbers: boolean }) {
  const { t } = useTranslation()

  // Example board positions for captures
  const equalityExample: ExamplePiece[] = [
    { square: 'G4', type: 'C', color: 'W', value: 25 }, // White's 25
    { square: 'H4', type: 'C', color: 'B', value: 25 }, // Black's 25 (can be captured)
  ]

  const multipleExample: ExamplePiece[] = [
    { square: 'E5', type: 'S', color: 'W', value: 64 }, // White's 64
    { square: 'F5', type: 'T', color: 'B', value: 16 }, // Black's 16 (can be captured: 64÷16=4)
  ]

  const sumExample: ExamplePiece[] = [
    { square: 'F4', type: 'C', color: 'W', value: 9 }, // White's 9 (attacker)
    { square: 'E5', type: 'T', color: 'W', value: 16 }, // White's 16 (helper)
    { square: 'G4', type: 'C', color: 'B', value: 25 }, // Black's 25 (target: 9+16=25)
  ]

  const differenceExample: ExamplePiece[] = [
    { square: 'F4', type: 'T', color: 'W', value: 30 }, // White's 30 (attacker)
    { square: 'E5', type: 'C', color: 'W', value: 10 }, // White's 10 (helper)
    { square: 'G4', type: 'T', color: 'B', value: 20 }, // Black's 20 (target: 30-10=20)
  ]

  const productExample: ExamplePiece[] = [
    { square: 'F4', type: 'C', color: 'W', value: 5 }, // White's 5 (attacker)
    { square: 'E5', type: 'C', color: 'W', value: 5 }, // White's 5 (helper)
    { square: 'G4', type: 'C', color: 'B', value: 25 }, // Black's 25 (target: 5×5=25)
  ]

  return (
    <div data-section="capture">
      <h3
        className={css({
          fontSize: { base: '20px', md: '24px' },
          fontWeight: 'bold',
          color: '#7c2d12',
          mb: '16px',
        })}
      >
        {t('guide.capture.title', 'How to Capture')}
      </h3>
      <p className={css({ fontSize: '15px', lineHeight: '1.6', mb: '24px', color: '#374151' })}>
        {t(
          'guide.capture.description',
          'You can only capture an enemy piece if your piece value has a mathematical relation to theirs:'
        )}
      </p>

      <h4
        className={css({
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#111827',
          mb: '12px',
          mt: '20px',
        })}
      >
        {t('guide.capture.simpleTitle', 'Simple Relations (no helper needed)')}
      </h4>

      {/* Equality */}
      <div
        className={css({
          mb: '20px',
          p: '16px',
          bg: '#f9fafb',
          borderRadius: '8px',
          border: '2px solid #e5e7eb',
        })}
      >
        <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#111827', mb: '8px' })}>
          {t('guide.capture.equality', 'Equal')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b7280', mb: '12px' })}>
          {t('guide.capture.equalityExample', 'Your 25 captures their 25')}
        </p>
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <RithmomachiaBoard
            pieces={equalityExample}
            scale={0.4}
            cropToSquares={['F3', 'I5']}
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
          {t(
            'guide.capture.equalityCaption',
            'White Circle (25) can capture Black Circle (25) by equality'
          )}
        </p>
      </div>

      {/* Multiple/Divisor */}
      <div
        className={css({
          mb: '20px',
          p: '16px',
          bg: '#f9fafb',
          borderRadius: '8px',
          border: '2px solid #e5e7eb',
        })}
      >
        <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#111827', mb: '8px' })}>
          {t('guide.capture.multiple', 'Multiple / Divisor')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b7280', mb: '12px' })}>
          {t('guide.capture.multipleExample', 'Your 64 captures their 16 (64 ÷ 16 = 4)')}
        </p>
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <RithmomachiaBoard
            pieces={multipleExample}
            scale={0.4}
            cropToSquares={['D4', 'G6']}
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
          {t(
            'guide.capture.multipleCaption',
            'White Square (64) can capture Black Triangle (16) because 64 ÷ 16 = 4'
          )}
        </p>
      </div>

      <h4
        className={css({
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#111827',
          mb: '12px',
          mt: '24px',
        })}
      >
        {t('guide.capture.advancedTitle', 'Advanced Relations (need one helper piece)')}
      </h4>

      {/* Sum */}
      <div
        className={css({
          mb: '20px',
          p: '16px',
          bg: '#f9fafb',
          borderRadius: '8px',
          border: '2px solid #e5e7eb',
        })}
      >
        <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#111827', mb: '8px' })}>
          {t('guide.capture.sum', 'Sum')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b7280', mb: '12px' })}>
          {t('guide.capture.sumExample', 'Your 9 + helper 16 = enemy 25')}
        </p>
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <RithmomachiaBoard
            pieces={sumExample}
            scale={0.4}
            cropToSquares={['D3', 'H6']}
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
          {t(
            'guide.capture.sumCaption',
            'White Circle (9) can capture Black Circle (25) using helper Triangle (16): 9 + 16 = 25'
          )}
        </p>
      </div>

      {/* Difference */}
      <div
        className={css({
          mb: '20px',
          p: '16px',
          bg: '#f9fafb',
          borderRadius: '8px',
          border: '2px solid #e5e7eb',
        })}
      >
        <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#111827', mb: '8px' })}>
          {t('guide.capture.difference', 'Difference')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b7280', mb: '12px' })}>
          {t('guide.capture.differenceExample', 'Your 30 - helper 10 = enemy 20')}
        </p>
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <RithmomachiaBoard
            pieces={differenceExample}
            scale={0.4}
            cropToSquares={['D3', 'H6']}
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
          {t(
            'guide.capture.differenceCaption',
            'White Triangle (30) can capture Black Triangle (20) using helper Circle (10): 30 - 10 = 20'
          )}
        </p>
      </div>

      {/* Product */}
      <div
        className={css({
          mb: '20px',
          p: '16px',
          bg: '#f9fafb',
          borderRadius: '8px',
          border: '2px solid #e5e7eb',
        })}
      >
        <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#111827', mb: '8px' })}>
          {t('guide.capture.product', 'Product')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b7280', mb: '12px' })}>
          {t('guide.capture.productExample', 'Your 5 × helper 5 = enemy 25')}
        </p>
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <RithmomachiaBoard
            pieces={productExample}
            scale={0.4}
            cropToSquares={['D3', 'H6']}
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
          {t(
            'guide.capture.productCaption',
            'White Circle (5) can capture Black Circle (25) using helper Circle (5): 5 × 5 = 25'
          )}
        </p>
      </div>

      <div
        className={css({
          mt: '24px',
          p: '16px',
          bg: 'rgba(59, 130, 246, 0.1)',
          borderLeft: '4px solid #3b82f6',
          borderRadius: '4px',
        })}
      >
        <p className={css({ fontSize: '14px', fontWeight: 'bold', color: '#1e40af', mb: '8px' })}>
          {t('guide.capture.helpersTitle', '💡 What are helpers?')}
        </p>
        <p className={css({ fontSize: '14px', color: '#1e3a8a', lineHeight: '1.6' })}>
          {t(
            'guide.capture.helpersDescription',
            'Helpers are your other pieces still on the board. They stay where they are and just provide their value for the math. The game shows you valid captures when you select a piece.'
          )}
        </p>
      </div>
    </div>
  )
}
