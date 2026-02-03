'use client'

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

interface UseSocketOptions {
  teamIds?: string[]
  onTicketUpdate?: (event: any) => void
  onAnnouncement?: (event: any) => void
  onReflectionUpdate?: (event: any) => void
}

export function useSocket({
  teamIds = [],
  onTicketUpdate,
  onAnnouncement,
  onReflectionUpdate,
}: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // Initialize socket connection
    const socket = io({
      path: '/api/socket',
      addTrailingSlash: false,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id)
      
      // Join team rooms
      teamIds.forEach((teamId) => {
        socket.emit('join-team', teamId)
      })
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected')
    })

    // Event listeners
    if (onTicketUpdate) {
      socket.on('ticket-update', onTicketUpdate)
    }

    if (onAnnouncement) {
      socket.on('announcement', onAnnouncement)
    }

    if (onReflectionUpdate) {
      socket.on('reflection-update', onReflectionUpdate)
    }

    // Cleanup
    return () => {
      teamIds.forEach((teamId) => {
        socket.emit('leave-team', teamId)
      })
      socket.disconnect()
    }
  }, [teamIds.join(','), onTicketUpdate, onAnnouncement, onReflectionUpdate])

  const joinTeam = useCallback((teamId: string) => {
    socketRef.current?.emit('join-team', teamId)
  }, [])

  const leaveTeam = useCallback((teamId: string) => {
    socketRef.current?.emit('leave-team', teamId)
  }, [])

  return {
    socket: socketRef.current,
    joinTeam,
    leaveTeam,
  }
}
