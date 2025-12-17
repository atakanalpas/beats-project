// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET 
  })
  
  const { pathname } = request.nextUrl
  
  // Geschützte Pfade
  const protectedPaths = [
    '/dashboard',
    '/dashboard/',
    '/dashboard/:path*'
  ]
  
  // Prüfe ob aktuelle Route geschützt ist
  const isProtected = protectedPaths.some(path => {
    if (path.includes(':path*')) {
      return pathname.startsWith(path.replace(':path*', ''))
    }
    return pathname === path
  })
  
  // Wenn Route geschützt ist und kein Token existiert -> Redirect zu Login
  if (isProtected && !token) {
    const loginUrl = new URL('/api/auth/signin', request.url)
    loginUrl.searchParams.set('callbackUrl', encodeURI(request.url))
    return NextResponse.redirect(loginUrl)
  }
  
  return NextResponse.next()
}

// Konfiguriere welche Pfade die Middleware ausführt
export const config = {
  matcher: [
    '/dashboard/:path*',
    // Weitere Pfade hier hinzufügen:
    // '/profile/:path*',
  ]
}