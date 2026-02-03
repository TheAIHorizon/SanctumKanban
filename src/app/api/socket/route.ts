import { NextResponse } from 'next/server'

// This route exists to handle the initial HTTP request for Socket.IO
// The actual WebSocket upgrade is handled by the custom server

export async function GET() {
  return NextResponse.json({ message: 'Socket.IO endpoint' })
}
