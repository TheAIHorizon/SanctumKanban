import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const role = token?.role
    const isAdmin = role === 'ADMIN'
    const isObserver = role === 'OBSERVER'
    const path = req.nextUrl.pathname

    // Protect admin routes
    if (path.startsWith('/admin') && !isAdmin) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // Observers cannot view individual student reports (privacy).
    if (isObserver && path.startsWith('/reports')) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    '/',
    '/teams/:path*',
    '/admin/:path*',
    '/profile/:path*',
    '/reports/:path*',
  ],
}
