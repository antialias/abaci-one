import { css } from '../../../../../../../styled-system/css'

export interface OperatorSectionProps {
  operator: 'addition' | 'subtraction' | 'mixed' | undefined
  onChange: (operator: 'addition' | 'subtraction' | 'mixed') => void
}

export function OperatorSection({ operator, onChange }: OperatorSectionProps) {
  return (
    <div
      data-section="operator-selection"
      className={css({
        bg: 'gray.50',
        border: '1px solid',
        borderColor: 'gray.200',
        rounded: 'xl',
        p: '4',
      })}
    >
      <label
        className={css({
          fontSize: 'sm',
          fontWeight: 'semibold',
          color: 'gray.700',
          mb: '2',
          display: 'block',
        })}
      >
        Operation Type
      </label>

      <div className={css({ display: 'flex', gap: '2', mb: '2' })}>
        <button
          type="button"
          onClick={() => onChange('addition')}
          className={css({
            flex: 1,
            px: '4',
            py: '2',
            rounded: 'lg',
            fontSize: 'sm',
            fontWeight: 'medium',
            border: '2px solid',
            transition: 'all 0.2s',
            ...(operator === 'addition' || !operator
              ? {
                  bg: 'brand.600',
                  borderColor: 'brand.600',
                  color: 'white',
                }
              : {
                  bg: 'white',
                  borderColor: 'gray.300',
                  color: 'gray.700',
                  _hover: { borderColor: 'gray.400' },
                }),
          })}
        >
          Addition Only (+)
        </button>

        <button
          type="button"
          onClick={() => onChange('subtraction')}
          className={css({
            flex: 1,
            px: '4',
            py: '2',
            rounded: 'lg',
            fontSize: 'sm',
            fontWeight: 'medium',
            border: '2px solid',
            transition: 'all 0.2s',
            ...(operator === 'subtraction'
              ? {
                  bg: 'brand.600',
                  borderColor: 'brand.600',
                  color: 'white',
                }
              : {
                  bg: 'white',
                  borderColor: 'gray.300',
                  color: 'gray.700',
                  _hover: { borderColor: 'gray.400' },
                }),
          })}
        >
          Subtraction Only (−)
        </button>

        <button
          type="button"
          onClick={() => onChange('mixed')}
          className={css({
            flex: 1,
            px: '4',
            py: '2',
            rounded: 'lg',
            fontSize: 'sm',
            fontWeight: 'medium',
            border: '2px solid',
            transition: 'all 0.2s',
            ...(operator === 'mixed'
              ? {
                  bg: 'brand.600',
                  borderColor: 'brand.600',
                  color: 'white',
                }
              : {
                  bg: 'white',
                  borderColor: 'gray.300',
                  color: 'gray.700',
                  _hover: { borderColor: 'gray.400' },
                }),
          })}
        >
          Mixed (+/−)
        </button>
      </div>

      <p className={css({ fontSize: 'xs', color: 'gray.600' })}>
        {operator === 'mixed'
          ? 'Problems will randomly use addition or subtraction'
          : operator === 'subtraction'
            ? 'All problems will be subtraction'
            : 'All problems will be addition'}
      </p>
    </div>
  )
}
