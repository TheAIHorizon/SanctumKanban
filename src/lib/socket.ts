import { Server as NetServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { NextApiResponse } from 'next'

export type NextApiResponseWithSocket = NextApiResponse & {
  socket: {
    server: NetServer & {
      io?: SocketIOServer
    }
  }
}

export const initSocket = (res: NextApiResponseWithSocket): SocketIOServer => {
  if (!res.socket.server.io) {
    const io = new SocketIOServer(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
    })

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)

      // Join a team room
      socket.on('join-team', (teamId: string) => {
        socket.join(`team:${teamId}`)
        console.log(`Socket ${socket.id} joined team:${teamId}`)
      })

      // Leave a team room
      socket.on('leave-team', (teamId: string) => {
        socket.leave(`team:${teamId}`)
        console.log(`Socket ${socket.id} left team:${teamId}`)
      })

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
      })
    })

    res.socket.server.io = io
  }

  return res.socket.server.io
}

// Event types for real-time updates
export interface TicketUpdateEvent {
  type: 'ticket-created' | 'ticket-updated' | 'ticket-deleted' | 'ticket-moved'
  teamId: string
  ticket: {
    id: string
    title: string
    description: string | null
    status: 'BACKLOG' | 'DOING' | 'DONE'
    position: number
    assignee: {
      id: string
      firstName: string
      lastName: string
      color: string
    } | null
  }
  userId: string
  userName: string
}

export interface AnnouncementEvent {
  type: 'announcement-created' | 'announcement-updated' | 'announcement-deleted'
  announcement: {
    id: string
    title: string
    content: string
    pinned: boolean
  }
}

export interface ReflectionEvent {
  type: 'reflection-updated'
  teamId: string
  reflection: {
    id: string
    wentWell: string | null
    couldImprove: string | null
    actionItems: string | null
  }
}

// Emit functions for server-side use
export const emitTicketUpdate = (
  io: SocketIOServer,
  event: TicketUpdateEvent
) => {
  io.to(`team:${event.teamId}`).emit('ticket-update', event)
}

export const emitAnnouncement = (
  io: SocketIOServer,
  event: AnnouncementEvent
) => {
  io.emit('announcement', event)
}

export const emitReflectionUpdate = (
  io: SocketIOServer,
  event: ReflectionEvent
) => {
  io.to(`team:${event.teamId}`).emit('reflection-update', event)
}
