/**
 * Ring emitter tenant-scoping tests (#8.4): a ring fans out to exactly the
 * owning user's room — never globally, never to anyone else's room.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSocketIO } from '@/lib/socket-io'
import { emitPrintJobUpdated } from '../ring-emitter'
import { PRINT_JOB_UPDATED_EVENT } from '../ring-events'

vi.mock('@/lib/socket-io', () => ({
  getSocketIO: vi.fn(),
}))

const getSocketIOMock = vi.mocked(getSocketIO)

function fakeIo() {
  const roomEmit = vi.fn()
  const to = vi.fn((_room: string) => ({ emit: roomEmit }))
  const globalEmit = vi.fn()
  // biome-ignore lint/suspicious/noExplicitAny: minimal io double — only to/emit are exercised
  return { io: { to, emit: globalEmit } as any, to, roomEmit, globalEmit }
}

describe('emitPrintJobUpdated', () => {
  beforeEach(() => {
    getSocketIOMock.mockReset()
  })

  it("emits to the owning user's room only — never globally", async () => {
    const { io, to, roomEmit, globalEmit } = fakeIo()
    getSocketIOMock.mockResolvedValue(io)

    const payload = { connectionId: 'conn-1', jobId: 'job-42', phase: 'printing' }
    await emitPrintJobUpdated('user-a', payload)

    expect(to).toHaveBeenCalledTimes(1)
    expect(to).toHaveBeenCalledWith('user:user-a')
    expect(roomEmit).toHaveBeenCalledWith(PRINT_JOB_UPDATED_EVENT, payload)
    expect(globalEmit).not.toHaveBeenCalled()
  })

  it("never touches another tenant's room", async () => {
    const { io, to } = fakeIo()
    getSocketIOMock.mockResolvedValue(io)

    await emitPrintJobUpdated('user-a', { connectionId: 'conn-1' })

    const rooms = to.mock.calls.map(([room]) => room)
    expect(rooms).toEqual(['user:user-a'])
    expect(rooms).not.toContain('user:user-b')
  })

  it('is a no-op when the socket server is unavailable', async () => {
    getSocketIOMock.mockResolvedValue(null)
    await expect(emitPrintJobUpdated('user-a', { connectionId: 'conn-1' })).resolves.toBeUndefined()
  })

  it('swallows emit failures rather than failing the ring', async () => {
    const { io, to } = fakeIo()
    to.mockImplementation(() => {
      throw new Error('adapter down')
    })
    getSocketIOMock.mockResolvedValue(io)

    await expect(emitPrintJobUpdated('user-a', { connectionId: 'conn-1' })).resolves.toBeUndefined()
  })
})
