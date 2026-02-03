import { UserRole } from '@prisma/client'
import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
      color: string
      firstName: string
      lastName: string
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: UserRole
    color: string
    firstName: string
    lastName: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
    color: string
    firstName: string
    lastName: string
  }
}
