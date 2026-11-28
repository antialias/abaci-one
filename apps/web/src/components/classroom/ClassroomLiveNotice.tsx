'use client'

import type { ClassroomLiveState } from '@/lib/classroom/classroom-channel-client'
import { css } from '../../../styled-system/css'

/**
 * A plain line telling the teacher the classroom's live updates are not
 * running: paused while socket.io reconnects, or off when the server refused
 * the room. Nothing while connecting for the first time or live.
 */
export function ClassroomLiveNotice({
  state,
  isDark,
}: {
  state: ClassroomLiveState
  isDark: boolean
}) {
  if (state !== 'paused' && state !== 'refused') return null
  return (
    <div
      role="status"
      data-component="classroom-live-notice"
      data-state={state}
      className={css({
        marginBottom: '1rem',
        padding: '8px 12px',
        borderRadius: '8px',
        fontSize: '0.875rem',
        backgroundColor: isDark ? 'gray.800' : 'gray.100',
        color: isDark ? 'gray.300' : 'gray.700',
      })}
    >
      {state === 'paused'
        ? 'Live updates paused, reconnecting…'
        : 'Live updates are off for this classroom. Reload the page to try again.'}
    </div>
  )
}
