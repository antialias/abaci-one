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

export function CaptureSection({ useNativeAbacusNumbers }: { useNativeAbacusNumbers: boolean }) {
  const t = useTranslations('rithmomachia.guide')

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

  const ratioExample: ExamplePiece[] = [
    { square: 'F4', type: 'T', color: 'W', value: 20 }, // White's 20 (attacker)
    { square: 'E5', type: 'C', color: 'W', value: 4 }, // White's 4 (helper)
    { square: 'G4', type: 'C', color: 'B', value: 5 }, // Black's 5 (target: 20÷4=5)
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
        {t('capture.title')}
      </h3>
      <p
        className={css({
          fontSize: '15px',
          lineHeight: '1.6',
          mb: '24px',
          color: '#374151',
        })}
      >
        {t('capture.description')}
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
        {t('capture.simpleTitle')}
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
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#111827',
            mb: '8px',
          })}
        >
          {t('capture.equality')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b7280', mb: '12px' })}>
          {t('capture.equalityExample')}
        </p>
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <RithmomachiaBoard
            pieces={equalityExample}
            scale={0.4}
            cropArea={squaresToCropArea('F5', 'I3')}
            highlightSquares={['G4', 'H4']}
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
          {t('capture.equalityCaption')}
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
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#111827',
            mb: '8px',
          })}
        >
          {t('capture.multiple')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b7280', mb: '12px' })}>
          {t('capture.multipleExample')}
        </p>
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <RithmomachiaBoard
            pieces={multipleExample}
            scale={0.4}
            cropArea={squaresToCropArea('D6', 'G4')}
            highlightSquares={['E5', 'F5']}
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
          {t('capture.multipleCaption')}
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
        {t('capture.advancedTitle')}
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
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#111827',
            mb: '8px',
          })}
        >
          {t('capture.sum')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b7280', mb: '12px' })}>
          {t('capture.sumExample')}
        </p>
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <RithmomachiaBoard
            pieces={sumExample}
            scale={0.4}
            cropArea={squaresToCropArea('D6', 'H3')}
            highlightSquares={['F4', 'E5', 'G4']}
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
          {t('capture.sumCaption')}
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
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#111827',
            mb: '8px',
          })}
        >
          {t('capture.difference')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b7280', mb: '12px' })}>
          {t('capture.differenceExample')}
        </p>
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <RithmomachiaBoard
            pieces={differenceExample}
            scale={0.4}
            cropArea={squaresToCropArea('D6', 'H3')}
            highlightSquares={['F4', 'E5', 'G4']}
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
          {t('capture.differenceCaption')}
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
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#111827',
            mb: '8px',
          })}
        >
          {t('capture.product')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b7280', mb: '12px' })}>
          {t('capture.productExample')}
        </p>
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <RithmomachiaBoard
            pieces={productExample}
            scale={0.4}
            cropArea={squaresToCropArea('D6', 'H3')}
            highlightSquares={['F4', 'E5', 'G4']}
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
          {t('capture.productCaption')}
        </p>
      </div>

      {/* Ratio */}
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
          {t('capture.ratio')}
        </p>
        <p className={css({ fontSize: '13px', color: '#6b7280', mb: '12px' })}>
          {t('capture.ratioExample')}
        </p>
        <div className={css({ display: 'flex', justifyContent: 'center' })}>
          <RithmomachiaBoard
            pieces={ratioExample}
            scale={0.4}
            cropArea={squaresToCropArea('D6', 'H3')}
            highlightSquares={['F4', 'E5', 'G4']}
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
          {t('capture.ratioCaption')}
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
        <p
          className={css({
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#1e40af',
            mb: '8px',
          })}
        >
          {t('capture.helpersTitle')}
        </p>
        <p
          className={css({
            fontSize: '14px',
            color: '#1e3a8a',
            lineHeight: '1.6',
          })}
        >
          {t('capture.helpersDescription')}
        </p>
      </div>
    </div>
  )
}
