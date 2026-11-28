/**
 * The real socket server (`initializeSocketServer`) on a local port, with
 * real `socket.io-client` connections whose handshakes carry real NextAuth
 * session cookies. The test file mocks `@/db` (an EphemeralDatabase) and
 * whatever else it needs before `startSocketServer()` loads the server.
 */

import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { encode } from 'next-auth/jwt'
import { type Socket as ClientSocket, io as connect } from 'socket.io-client'
import { expect, vi } from 'vitest'

export const SOCKET_TEST_SECRET = 'made-up-secret-for-socket-server-tests-000001'
const COOKIE = 'authjs.session-token'

/** A session cookie for `userId`, signed with the stubbed AUTH_SECRET. */
export async function cookieFor(userId: string) {
  return `${COOKIE}=${await encode({ token: { sub: userId }, secret: SOCKET_TEST_SECRET, salt: COOKIE })}`
}

type SocketServer = Awaited<ReturnType<typeof import('@/socket-server')['initializeSocketServer']>>

let server: http.Server | null = null
let url = ''
let io: SocketServer
const clients: ClientSocket[] = []

/** Start the real socket server (AUTH_SECRET stubbed); returns its `io`. */
export async function startSocketServer(): Promise<SocketServer> {
  vi.stubEnv('AUTH_SECRET', SOCKET_TEST_SECRET)
  const { initializeSocketServer } = await import('@/socket-server')
  server = http.createServer()
  io = initializeSocketServer(server)
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', () => r()))
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return io
}

export async function stopSocketServer() {
  await new Promise<void>((r) => io.close(() => r()))
  vi.unstubAllEnvs()
}

/** Disconnect every client made since the last call. */
export function disconnectClients() {
  for (const c of clients.splice(0)) c.disconnect()
}

/** A connected client whose handshake carries `cookie` (none: anonymous). */
export async function client(cookie?: string): Promise<ClientSocket> {
  const sock = connect(url, {
    path: '/api/socket',
    transports: ['websocket'],
    extraHeaders: cookie ? { cookie } : {},
    reconnection: false,
    forceNew: true,
  })
  clients.push(sock)
  await new Promise<void>((resolve, reject) => {
    sock.once('connect', () => resolve())
    sock.once('connect_error', reject)
  })
  return sock
}

/** The first `event` the client hears within `ms`, or null. */
export function next<T = any>(sock: ClientSocket, event: string, ms = 1500): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      sock.off(event, on)
      resolve(null)
    }, ms)
    const on = (data: T) => {
      clearTimeout(timer)
      resolve(data)
    }
    sock.once(event, on)
  })
}

/** Everything `event` brings to the client from now on. */
export function collect<T = any>(sock: ClientSocket, event: string): T[] {
  const heard: T[] = []
  sock.on(event, (data: T) => heard.push(data))
  return heard
}

/** The server-side rooms of the client's socket. */
export async function roomsOf(sock: ClientSocket): Promise<Set<string>> {
  const [remote] = await io.in(sock.id!).fetchSockets()
  return remote ? new Set(remote.rooms) : new Set()
}

/** Wait until the client's socket is in `room` on the server. */
export async function joined(sock: ClientSocket, room: string) {
  await vi.waitFor(async () => expect((await roomsOf(sock)).has(room)).toBe(true), {
    timeout: 5000,
  })
}

/**
 * Wait until the server has handled everything this client sent so far: an
 * anonymous `join-arcade-session` is answered at once (no viewer, nothing
 * awaited), and a connection's events reach their handlers in order.
 */
export async function drained(sock: ClientSocket) {
  const answer = next(sock, 'session-error', 5000)
  sock.emit('join-arcade-session', {})
  expect(await answer).not.toBeNull()
}
