import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import prisma from './prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user) {
          throw new Error('Invalid email or password')
        }

        // Observer is a guest identity; it cannot be used with a password.
        if (user.role === 'OBSERVER') {
          throw new Error('Invalid email or password')
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isPasswordValid) {
          throw new Error('Invalid email or password')
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          color: user.color,
          firstName: user.firstName,
          lastName: user.lastName,
        }
      },
    }),
    // Passwordless guest login: read-only observer. Anyone can enter as the
    // singleton OBSERVER identity without an account. It fails every write
    // guard (enforced by can()) and cannot see individual student reports.
    CredentialsProvider({
      id: 'observer',
      name: 'Observer',
      credentials: {},
      async authorize() {
        // Use only the dedicated guest identity. Selecting an arbitrary
        // OBSERVER account could expose that account's profile and activity to
        // anyone using passwordless guest login.
        let observer = await prisma.user.findUnique({
          where: { email: 'observer@local' },
        })
        if (observer && observer.role !== 'OBSERVER') {
          throw new Error('Guest observer identity is invalid')
        }
        if (!observer) {
          observer = await prisma.user.create({
            data: {
              email: 'observer@local',
              // Random unusable hash; observer never logs in with a password.
              passwordHash: await bcrypt.hash(
                Math.random().toString(36) + Date.now(),
                10
              ),
              firstName: 'Guest',
              lastName: 'Observer',
              role: 'OBSERVER',
              color: '#64748b',
            },
          })
        }
        return {
          id: observer.id,
          email: observer.email,
          name: 'Guest Observer',
          role: observer.role,
          color: observer.color,
          firstName: observer.firstName,
          lastName: observer.lastName,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    // The jwt callback below refreshes authorization from the database on
    // every session read, so role changes and deletions take effect promptly.
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.color = (user as any).color
        token.firstName = (user as any).firstName
        token.lastName = (user as any).lastName
        token.guestObserver = account?.provider === 'observer'
        return token
      }

      if (!token.id) throw new Error('Authenticated user id is missing')

      const currentUser = await prisma.user.findUnique({
        where: { id: token.id },
        select: {
          id: true,
          email: true,
          role: true,
          color: true,
          firstName: true,
          lastName: true,
        },
      })
      if (!currentUser) throw new Error('Authenticated user no longer exists')
      if (token.guestObserver && currentUser.role !== 'OBSERVER') {
        throw new Error('Guest observer identity is invalid')
      }

      token.email = currentUser.email
      token.role = currentUser.role
      token.color = currentUser.color
      token.firstName = currentUser.firstName
      token.lastName = currentUser.lastName
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).email = token.email
        ;(session.user as any).role = token.role
        ;(session.user as any).color = token.color
        ;(session.user as any).firstName = token.firstName
        ;(session.user as any).lastName = token.lastName
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  debug: process.env.NODE_ENV === 'development',
}
