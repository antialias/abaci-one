/**
 * Presentational, kid-friendly lyrics view for the public song share page.
 *
 * Renders parsed song sections (see `parseSongPlan` in
 * `@/lib/song-share/songPlan`). Each section can carry optional "behind the
 * song" annotations (populated by the Phase 2 annotation engine) — when
 * absent, sections render as plain lyrics and still look complete.
 *
 * This is intentionally light/warm themed for sharing; the admin songs page
 * keeps its own dark technical treatment but consumes the same parser.
 */

import type { AnnotatedSongSection } from '@/lib/song-share/annotate'
import { css } from '../../../styled-system/css'

export type { AnnotatedSongSection }

interface SongLyricsProps {
  sections: AnnotatedSongSection[]
}

export function SongLyrics({ sections }: SongLyricsProps) {
  if (sections.length === 0) return null

  return (
    <div
      data-component="song-lyrics"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
      })}
    >
      {sections.map((section, i) => (
        <div
          key={i}
          data-element="lyric-section"
          className={css({
            bg: 'white',
            borderRadius: '14px',
            border: '1px solid token(colors.gray.200)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            overflow: 'hidden',
          })}
        >
          <div
            className={css({
              px: '18px',
              py: '10px',
              bg: 'purple.50',
              borderBottom: '1px solid token(colors.purple.100)',
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'purple.700',
            })}
          >
            {section.name}
          </div>

          <div
            className={css({
              px: '18px',
              py: '14px',
              fontSize: '17px',
              lineHeight: '1.7',
              color: 'gray.800',
              whiteSpace: 'pre-wrap',
              fontWeight: '500',
            })}
          >
            {section.lines.join('\n')}
          </div>

          {section.annotations && section.annotations.length > 0 && (
            <div
              data-element="lyric-annotations"
              className={css({
                px: '18px',
                py: '12px',
                bg: 'amber.50',
                borderTop: '1px dashed token(colors.amber.300)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              })}
            >
              {section.annotations.map((note, j) => (
                <div
                  key={j}
                  className={css({
                    fontSize: '13px',
                    color: 'amber.800',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'flex-start',
                  })}
                >
                  <span aria-hidden="true">↳</span>
                  <span>{note}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
