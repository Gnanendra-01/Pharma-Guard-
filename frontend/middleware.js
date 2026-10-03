import { NextResponse } from 'next/server';

// Paths that don't require authentication
const PUBLIC_PATHS = ['/login', '/register'];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('token')?.value;

  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  // Not logged in trying to access a protected page → send to /login
  if (!token && !isPublicPath) {
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  // Already logged in trying to access login/register → send to /dashboard
  if (token && isPublicPath) {
    const url = new URL('/dashboard', request.url);
    return NextResponse.redirect(url);
  }

  // Root path: redirect logged-in users to dashboard, others to login
  if (pathname === '/') {
    const url = new URL(token ? '/dashboard' : '/login', request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match every path except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
