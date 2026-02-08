'use client'

import { Volume2 } from 'lucide-react'
import { css } from '../../../styled-system/css'

interface AudioHelpButtonProps {
  onReplay: () => void
  isPlaying: boolean
}

export function AudioHelpButton({ onReplay, isPlaying }: AudioHelpButtonProps) {
  return (
    <button
      type="button"
      data-component="audio-help-button"
      data-action="replay-audio"
      onClick={onReplay}
      disabled={isPlaying}
      aria-label="Replay problem audio"
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        border: '1px solid',
        borderColor: 'gray.300',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        color: 'gray.600',
        transition: 'all 0.15s',
        opacity: isPlaying ? 0.5 : 1,
        _hover: {
          backgroundColor: 'gray.100',
          borderColor: 'gray.400',
        },
      })}
    >
      <Volume2 size={18} />
    </button>
  )
}
