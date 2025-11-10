import type { CSSProperties } from 'react'
import { useClipboard } from '@/hooks/useClipboard'

export interface CopyButtonProps {
  /**
   * Text to copy to clipboard
   */
  text: string

  /**
   * Button label when not copied
   */
  label: string | React.ReactNode

  /**
   * Button label when copied
   */
  copiedLabel?: string | React.ReactNode

  /**
   * Visual variant
   */
  variant?: 'code' | 'link'

  /**
   * Optional custom styles
   */
  style?: CSSProperties

  /**
   * Optional click handler (in addition to copy)
   */
  onClick?: (e: React.MouseEvent) => void
}

/**
 * Reusable copy-to-clipboard button with visual feedback
 *
 * @example
 * ```tsx
 * <CopyButton
 *   text="ABC123"
 *   label="Copy Code"
 *   copiedLabel="Copied!"
 *   variant="code"
 * />
 * ```
 */
export function CopyButton({
  text,
  label,
  copiedLabel,
  variant = 'code',
  style,
  onClick,
}: CopyButtonProps) {
  const { copied, copy } = useClipboard()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    copy(text)
    onClick?.(e)
  }

  const baseStyles: CSSProperties = {
    width: '100%',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '6px',
    border: 'none',
  }

  const variantStyles: Record<'code' | 'link', CSSProperties> = {
    code: {
      background: copied
        ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.3))'
        : 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.3))',
      border: copied ? '2px solid rgba(34, 197, 94, 0.5)' : '2px solid rgba(139, 92, 246, 0.4)',
      borderRadius: '8px',
      padding: '10px 16px',
      fontFamily: 'monospace',
      fontSize: '16px',
      fontWeight: 'bold',
      color: copied ? 'rgba(134, 239, 172, 1)' : 'rgba(196, 181, 253, 1)',
      letterSpacing: '2px',
    },
    link: {
      background: copied
        ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.3))'
        : 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.3))',
      border: copied ? '2px solid rgba(34, 197, 94, 0.5)' : '2px solid rgba(59, 130, 246, 0.4)',
      borderRadius: '8px',
      padding: '10px 16px',
      fontSize: '13px',
      fontWeight: '600',
      color: copied ? 'rgba(134, 239, 172, 1)' : 'rgba(147, 197, 253, 1)',
    },
  }

  const hoverStyles: Record<'code' | 'link', CSSProperties> = {
    code: {
      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(139, 92, 246, 0.4))',
      borderColor: 'rgba(139, 92, 246, 0.6)',
    },
    link: {
      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.4))',
      borderColor: 'rgba(59, 130, 246, 0.6)',
    },
  }

  const combinedStyles = {
    ...baseStyles,
    ...variantStyles[variant],
    ...style,
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={combinedStyles}
      onMouseEnter={(e) => {
        if (!copied) {
          Object.assign(e.currentTarget.style, hoverStyles[variant])
        }
      }}
      onMouseLeave={(e) => {
        if (!copied) {
          Object.assign(e.currentTarget.style, variantStyles[variant])
        }
      }}
    >
      {copied ? (
        <>
          <span style={{ fontSize: '14px' }}>✓</span>
          <span>{copiedLabel || 'Copied!'}</span>
        </>
      ) : (
        label
      )}
    </button>
  )
}
