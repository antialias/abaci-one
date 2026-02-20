'use client'

import { css } from '../../../../styled-system/css'
import { MusicStaff } from '@/components/music/MusicStaff'
import type { PitchClass, Clef, Accidental } from '@/components/music/noteUtils'
import type { MusicCard } from '../types'

/**
 * Card front rendering for the music note matching game variant.
 */
export function MusicCardFront({ card }: { card: MusicCard }) {
  if (card.type === 'staff-note' && card.clef) {
    const accidental =
      card.accidental && card.accidental !== 'none' ? (card.accidental as Accidental) : undefined

    return (
      <div
        data-component="MusicCardFront"
        data-card-type="staff-note"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: '4px',
        })}
      >
        <MusicStaff
          pitchClass={card.pitchClass as PitchClass}
          octave={card.octave}
          clef={card.clef as Clef}
          accidental={accidental}
          width={100}
          height={70}
          showClef={true}
        />
      </div>
    )
  }

  if (card.type === 'note-name') {
    return (
      <div
        data-component="MusicCardFront"
        data-card-type="note-name"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          gap: '4px',
        })}
      >
        <div
          data-element="note-display-name"
          className={css({
            fontSize: '28px',
            fontWeight: 'bold',
            color: 'gray.800',
          })}
        >
          {card.displayName}
        </div>
        {card.friendlyName && (
          <div
            data-element="note-friendly-name"
            className={css({
              fontSize: '12px',
              color: 'gray.500',
              fontStyle: 'italic',
            })}
          >
            {card.friendlyName}
          </div>
        )}
      </div>
    )
  }

  // Fallback
  return (
    <div
      className={css({
        fontSize: '24px',
        color: 'gray.500',
      })}
    >
      ?
    </div>
  )
}
