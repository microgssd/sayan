import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession, type Session } from './token';

export async function setSessionCookie(s: Session) {
  cookies().set(SESSION_COOKIE, await signSession(s), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE);
}

export async function getSession() {
  return verifySession(cookies().get(SESSION_COOKIE)?.value);
}

/** Every admin page AND every admin server action must call this. */
export async function requireAdmin() {
  const s = await getSession();
  if (!s || s.role !== 'admin') redirect('/login');
  return s;
}

export async function requireClient() {
  const s = await getSession();
  if (!s) redirect('/login');
  if (s.role === 'admin') redirect('/admin');
  return s;
}
