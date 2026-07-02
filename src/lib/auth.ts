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
  ],
  session: {
    strategy: 'jwt',
    // JWT sessions are not revoked server-side (no DB lookup on each
    // request), so a long maxAge means a stolen/leaked token, or a
    // deactivated/role-changed user, stays valid for the full duration.
    // 24h caps the blast radius of a leaked token to a single day, and
    // updateAge re-issues the JWT (refreshing its expiry) whenever the
    // session is used and is more than 1h old, so active users are not
    // forced to re-login constantly.
    // Tradeoff: role/permission changes made by an admin can still take
    // up to ~1h to apply to a user's live token (jwt() callback is only
    // re-run on that rolling refresh) rather than instantly.
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // re-issue token after 1 hour of activity
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.color = (user as any).color
        token.firstName = (user as any).firstName
        token.lastName = (user as any).lastName
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
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
