'use client'

import { css } from '../../../../styled-system/css'

interface WordProgressProps {
  totalLetters: number
  completedLetters: number
}

/**
 * Segmented progress bar that fills green as letters are typed.
 */
export function WordProgress({ totalLetters, completedLetters }: WordProgressProps) {
  return (
    <div
      data-component="WordProgress"
      className={css({
        display: 'flex',
        gap: '4px',
        width: '100%',
        maxWidth: '320px',
        mx: 'auto',
      })}
    >
      {Array.from({ length: totalLetters }).map((_, i) => (
        <div
          key={i}
          className={css({
            flex: 1,
            height: '8px',
            borderRadius: 'full',
            transition: 'background 0.2s ease',
            bg: i < completedLetters ? 'green.400' : 'gray.200',
          })}
        />
      ))}
    </div>
  )
}
