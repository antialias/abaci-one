'use client'

import { css } from '@styled/css'

/**
 * Loading skeleton shown while the worksheet preview is being generated
 * and streamed from the server.
 */
export function PreviewSkeleton() {
  return (
    <div
      data-component="preview-skeleton"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4',
        padding: '8',
        minHeight: '400px',
      })}
    >
      {/* Worksheet page placeholder */}
      <div
        className={css({
          width: '100%',
          maxWidth: '600px',
          aspectRatio: '11/8.5', // Letter landscape
          backgroundColor: 'gray.200',
          borderRadius: 'lg',
          animation: 'pulse 2s ease-in-out infinite',
          _dark: {
            backgroundColor: 'gray.700',
          },
        })}
      />

      {/* Loading text */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          color: 'gray.500',
          fontSize: 'sm',
          _dark: {
            color: 'gray.400',
          },
        })}
      >
        <LoadingSpinner />
        <span>Generating preview...</span>
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <svg
      className={css({
        width: '4',
        height: '4',
        animation: 'spin 1s linear infinite',
      })}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className={css({ opacity: 0.25 })}
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className={css({ opacity: 0.75 })}
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
