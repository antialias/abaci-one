/**
 * The teacher's side of `classroom:<id>`: join it on every connect, and say
 * whether the live feed is running.
 *
 * - `'connecting'`: the first join has not been answered yet.
 * - `'live'`: in the teacher room (`channel-joined`).
 * - `'paused'`: out of it for now, and socket.io is bringing it back: the
 *   connection dropped, or a join failed with `code: 'transient'`. A
 *   transient failure closes the transport so socket.io's own reconnect
 *   cycle (its backoff, no timer of ours) reconnects, and the next connect
 *   joins again. Each failure in a row doubles the reconnect delay, up to
 *   `MAX_TRANSIENT_DELAY_MS`; a join resets it.
 * - `'refused'`: the server said no (`code: 'refused'`). Asking again would
 *   change nothing, so the socket is closed for good.
 *
 * Kept apart from the React hook so the real socket server can drive it.
 */

import type { Socket } from 'socket.io-client'
import type { ChannelErrorCode } from './socket-events'

export type ClassroomLiveState = 'connecting' | 'live' | 'paused' | 'refused'

/** The longest reconnect delay after transient join failures in a row. */
export const MAX_TRANSIENT_DELAY_MS = 30_000

export interface ClassroomChannelHandlers {
  /** The live state changed. */
  onState(state: ClassroomLiveState): void
  /** In the teacher room (the first join and every rejoin): refetch what was missed. */
  onJoined(): void
}

/** Follow `classroom:<classroomId>` on `socket`; returns a function that stops following. */
export function followClassroomChannel(
  socket: Socket,
  classroomId: string,
  handlers: ClassroomChannelHandlers
): () => void {
  const manager = socket.io
  const baseDelay = manager.reconnectionDelay()
  const baseDelayMax = manager.reconnectionDelayMax()
  let refused = false
  let transientFailures = 0

  const join = () => {
    if (!refused) socket.emit('join-classroom', { classroomId })
  }
  const pause = () => {
    if (!refused) handlers.onState('paused')
  }
  const onJoined = (ack: { channel?: string; id?: string }) => {
    if (ack?.channel !== 'classroom' || ack.id !== classroomId) return
    transientFailures = 0
    manager.reconnectionDelay(baseDelay)
    manager.reconnectionDelayMax(baseDelayMax)
    handlers.onState('live')
    handlers.onJoined()
  }
  const onError = (err: { channel?: string; id?: string; code?: ChannelErrorCode }) => {
    if (err?.channel !== 'classroom' || err.id !== classroomId) return
    if (err.code === 'transient') {
      transientFailures += 1
      const delay = Math.min(baseDelay * 2 ** transientFailures, MAX_TRANSIENT_DELAY_MS)
      manager.reconnectionDelay(delay)
      manager.reconnectionDelayMax(Math.max(delay, baseDelayMax))
      handlers.onState('paused')
      // socket.io sees the transport close and reconnects on its own backoff
      manager.engine?.close()
      return
    }
    // A refusal, or a server too old to send a code: asking again changes nothing
    refused = true
    handlers.onState('refused')
    socket.disconnect()
  }

  socket.on('connect', join)
  socket.on('channel-joined', onJoined)
  socket.on('channel-error', onError)
  socket.on('disconnect', pause)
  socket.on('connect_error', pause)
  if (socket.connected) join()

  return () => {
    socket.off('connect', join)
    socket.off('channel-joined', onJoined)
    socket.off('channel-error', onError)
    socket.off('disconnect', pause)
    socket.off('connect_error', pause)
  }
}
