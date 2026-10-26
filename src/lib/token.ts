// Edge-safe: used by middleware and server code alike.
import { SignJWT, jwtVerify } from 'jose';

export type Role = 'admin' | 'client';
export type Session = { sub: string; role: Role; name: string; email: string };

export const SESSION_COOKIE = 'cp_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUTH_SECRET must be set to 32+ characters');
  return new TextEncoder().encode(secret);
}

export async function signSession(s: Session) {
  return new SignJWT({ role: s.role, name: s.name, email: s.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(s.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key());
}

export async function verifySession(token?: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (!payload.sub || (payload.role !== 'admin' && payload.role !== 'client')) return null;
    return { sub: payload.sub, role: payload.role, name: String(payload.name), email: String(payload.email) };
  } catch {
    return null;
  }
}
