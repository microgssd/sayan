import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/token';

// First line of defence. Pages and server actions re-check roles themselves.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url));

  if (pathname.startsWith('/admin')) {
    if (!session) return to('/login');
    if (session.role !== 'admin') return to('/portal');
  }
  if (pathname.startsWith('/portal')) {
    if (!session) return to('/login');
    if (session.role === 'admin') return to('/admin');
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/portal/:path*'] };
