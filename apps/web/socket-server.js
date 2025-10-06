const { Server } = require('socket.io')

function initializeSocketServer(httpServer) {
  const io = new Server(httpServer, {
    path: '/api/socket',
    cors: {
      origin: process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
      credentials: true,
    },
  })

  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id)

    socket.on('join-arcade-session', ({ userId }) => {
      socket.join(`arcade:${userId}`)
      console.log(`👤 User ${userId} joined arcade room`)
    })

    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected:', socket.id)
    })
  })

  console.log('✅ Socket.IO initialized on /api/socket')
  return io
}

module.exports = { initializeSocketServer }
