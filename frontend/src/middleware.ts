import { type NextRequest, NextResponse } from 'next/server';

// Routes that require authentication
const PROTECTED_ROUTES = ['/feed', '/onboarding', '/settings'];

// Routes that should redirect to /feed if already authenticated
const AUTH_ROUTES = ['/login', '/signup', '/forgot-password'];

// Public routes (no redirect either way)
const PUBLIC_ROUTES = ['/verify-email', '/reset-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for session cookie (the presence indicates a session exists)
  const sessionCookie =
    request.cookies.get('sessionId') ||
    request.cookies.get('connect.sid') ||
    request.cookies.get('session');

  const isAuthenticated = !!sessionCookie;

  // Root redirect: authenticated → /feed, unauthenticated → /login
  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(isAuthenticated ? '/feed' : '/login', request.url)
    );
  }

  // Redirect unauthenticated users away from protected routes
  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect authenticated users away from auth pages
  if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/feed', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
