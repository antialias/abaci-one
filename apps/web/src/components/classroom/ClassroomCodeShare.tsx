'use client'

import { useCallback, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../styled-system/css'

interface ClassroomCodeShareProps {
  code: string
  /** Compact display for inline use */
  compact?: boolean
}

/**
 * Display classroom join code with copy button
 */
export function ClassroomCodeShare({ code, compact = false }: ClassroomCodeShareProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = code
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [code])

  if (compact) {
    return (
      <button
        type="button"
        data-action="copy-classroom-code"
        onClick={handleCopy}
        className={css({
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          backgroundColor: isDark ? 'gray.700' : 'gray.100',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          _hover: {
            backgroundColor: isDark ? 'gray.600' : 'gray.200',
          },
        })}
        title="Click to copy"
      >
        <span
          className={css({
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            fontWeight: 'bold',
            letterSpacing: '0.1em',
            color: isDark ? 'blue.400' : 'blue.600',
          })}
        >
          {code}
        </span>
        <span className={css({ fontSize: '0.875rem' })}>{copied ? '✓' : '📋'}</span>
      </button>
    )
  }

  return (
    <div
      data-component="classroom-code-share"
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        backgroundColor: isDark ? 'gray.800' : 'gray.50',
        borderRadius: '12px',
        border: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
      })}
    >
      <div className={css({ flex: 1 })}>
        <p
          className={css({
            fontSize: '0.75rem',
            color: isDark ? 'gray.500' : 'gray.500',
            marginBottom: '4px',
          })}
        >
          Classroom Code
        </p>
        <span
          data-element="classroom-code"
          className={css({
            fontFamily: 'monospace',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            letterSpacing: '0.15em',
            color: isDark ? 'blue.400' : 'blue.600',
          })}
        >
          {code}
        </span>
      </div>
      <button
        type="button"
        data-action="copy-classroom-code"
        onClick={handleCopy}
        className={css({
          padding: '10px 16px',
          backgroundColor: copied
            ? isDark
              ? 'green.700'
              : 'green.500'
            : isDark
              ? 'blue.700'
              : 'blue.500',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 'medium',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          _hover: {
            backgroundColor: copied
              ? isDark
                ? 'green.600'
                : 'green.600'
              : isDark
                ? 'blue.600'
                : 'blue.600',
          },
        })}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  )
}
