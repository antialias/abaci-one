'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { css } from '../../../../../../styled-system/css'
import type { WorksheetFormState } from '../types'

interface DisplayOptionsPreviewProps {
  formState: WorksheetFormState
}

async function fetchExample(options: {
  showCarryBoxes: boolean
  showAnswerBoxes: boolean
  showPlaceValueColors: boolean
  showProblemNumbers: boolean
  showCellBorder: boolean
  showTenFrames: boolean
  showTenFramesForAll: boolean
}): Promise<string> {
  const response = await fetch('/api/create/worksheets/addition/example', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...options,
      fontSize: 16,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch example')
  }

  const data = await response.json()
  return data.svg
}

export function DisplayOptionsPreview({ formState }: DisplayOptionsPreviewProps) {
  // Debounce the display options to avoid hammering the server
  const [debouncedOptions, setDebouncedOptions] = useState({
    showCarryBoxes: formState.showCarryBoxes ?? true,
    showAnswerBoxes: formState.showAnswerBoxes ?? true,
    showPlaceValueColors: formState.showPlaceValueColors ?? true,
    showProblemNumbers: formState.showProblemNumbers ?? true,
    showCellBorder: formState.showCellBorder ?? true,
    showTenFrames: formState.showTenFrames ?? false,
    showTenFramesForAll: formState.showTenFramesForAll ?? false,
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOptions({
        showCarryBoxes: formState.showCarryBoxes ?? true,
        showAnswerBoxes: formState.showAnswerBoxes ?? true,
        showPlaceValueColors: formState.showPlaceValueColors ?? true,
        showProblemNumbers: formState.showProblemNumbers ?? true,
        showCellBorder: formState.showCellBorder ?? true,
        showTenFrames: formState.showTenFrames ?? false,
        showTenFramesForAll: formState.showTenFramesForAll ?? false,
      })
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [
    formState.showCarryBoxes,
    formState.showAnswerBoxes,
    formState.showPlaceValueColors,
    formState.showProblemNumbers,
    formState.showCellBorder,
    formState.showTenFrames,
    formState.showTenFramesForAll,
  ])

  const { data: svg, isLoading } = useQuery({
    queryKey: ['display-example', debouncedOptions],
    queryFn: () => fetchExample(debouncedOptions),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return (
    <div
      data-component="display-options-preview"
      className={css({
        p: '4',
        bg: 'white',
        rounded: 'xl',
        border: '2px solid',
        borderColor: 'brand.200',
        display: 'flex',
        flexDirection: 'column',
        gap: '2',
      })}
    >
      <div
        className={css({
          fontSize: 'xs',
          fontWeight: 'semibold',
          color: 'gray.500',
          textTransform: 'uppercase',
          letterSpacing: 'wider',
        })}
      >
        Preview
      </div>

      {isLoading ? (
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minH: '200px',
            color: 'gray.400',
            fontSize: 'sm',
          })}
        >
          Generating preview...
        </div>
      ) : svg ? (
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minH: '200px',
            '& svg': {
              maxW: 'full',
              h: 'auto',
            },
          })}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : null}
    </div>
  )
}
