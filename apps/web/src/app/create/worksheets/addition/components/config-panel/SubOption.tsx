import { css } from '../../../../../../../styled-system/css'

export interface SubOptionProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  parentEnabled: boolean
}

/**
 * Reusable sub-option component for nested toggles
 * Used for options like "Show for all problems" under "Ten-Frames"
 */
export function SubOption({ checked, onChange, label, parentEnabled }: SubOptionProps) {
  return (
    <div
      className={css({
        display: 'flex',
        gap: '3',
        alignItems: 'center',
        justifyContent: 'space-between',
        pt: '1.5',
        pb: '2.5',
        px: '3',
        mt: '2',
        borderTop: '1px solid',
        borderColor: 'brand.300',
        opacity: parentEnabled ? 1 : 0,
        visibility: parentEnabled ? 'visible' : 'hidden',
        pointerEvents: parentEnabled ? 'auto' : 'none',
        transition: 'opacity 0.15s',
        cursor: 'pointer',
      })}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
    >
      <label
        className={css({
          fontSize: '2xs',
          fontWeight: 'medium',
          color: 'brand.700',
          cursor: 'pointer',
          flex: 1,
        })}
      >
        {label}
      </label>
      <div
        className={css({
          w: '7',
          h: '4',
          bg: checked ? 'brand.500' : 'gray.300',
          rounded: 'full',
          position: 'relative',
          transition: 'background-color 0.15s',
          flexShrink: 0,
        })}
      >
        <div
          style={{
            position: 'absolute',
            top: '0.125rem',
            left: checked ? '0.875rem' : '0.125rem',
            width: '0.75rem',
            height: '0.75rem',
            background: 'white',
            borderRadius: '9999px',
            transition: 'left 0.15s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </div>
    </div>
  )
}
