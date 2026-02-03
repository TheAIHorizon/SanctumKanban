import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3456', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  const io = new SocketIOServer(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: dev ? 'http://localhost:3456' : process.env.NEXTAUTH_URL,
      methods: ['GET', 'POST'],
    },
  })

  // Make io available globally for API routes
  ;(global as any).io = io

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // Join a team room for real-time updates
    socket.on('join-team', (teamId: string) => {
      socket.join(`team:${teamId}`)
      console.log(`Socket ${socket.id} joined team:${teamId}`)
    })

    // Leave a team room
    socket.on('leave-team', (teamId: string) => {
      socket.leave(`team:${teamId}`)
      console.log(`Socket ${socket.id} left team:${teamId}`)
    })

    // User presence - notify others when someone is viewing a board
    socket.on('viewing-team', (data: { teamId: string; userId: string; userName: string }) => {
      socket.to(`team:${data.teamId}`).emit('user-viewing', {
        socketId: socket.id,
        userId: data.userId,
        userName: data.userName,
      })
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> Socket.IO server running on /api/socket`)
  })
})

// Helper function to emit events from API routes
export function getIO(): SocketIOServer | null {
  return (global as any).io || null
}
