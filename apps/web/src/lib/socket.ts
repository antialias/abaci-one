import { io, type Socket, type ManagerOptions, type SocketOptions } from 'socket.io-client'

/**
 * The path where the Socket.IO server is mounted.
 * All client connections MUST use this path.
 */
const SOCKET_PATH = '/api/socket'

/**
 * Create a Socket.IO client connection with the correct server path.
 *
 * Always use this instead of calling `io()` directly — the server mounts
 * at `/api/socket`, not the default `/socket.io/`. Calling `io()` without
 * the path will silently fail to connect.
 */
export function createSocket(opts?: Partial<ManagerOptions & SocketOptions>): Socket {
  return io({
    path: SOCKET_PATH,
    ...opts,
  })
}
