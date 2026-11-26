'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { connectDB } from '../db';
import { User } from '../models/User';
import { clearSessionCookie, setSessionCookie } from '../auth';

// Basic brute-force protection. In-memory, so it is per server instance;
// swap for Upstash/Redis if you scale to multiple instances.
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;
// Compared against when the email doesn't exist, so response timing doesn't reveal accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export type LoginError = { error: string; code: 'missing' | 'locked' | 'paused' | 'invalid' | 'unavailable' };

export async function login(_prev: LoginError | null, formData: FormData): Promise<LoginError> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.', code: 'missing' };

  const now = Date.now();
  const entry = attempts.get(email);
  if (entry && entry.until > now) return { error: 'Too many attempts. Try again in 10 minutes.', code: 'locked' };

  let user;
  try {
    await connectDB();
    user = await User.findOne({ email }).select('+passwordHash');
  } catch (err) {
    console.error('[login] database unreachable:', (err as Error).message);
    return { error: 'Can’t reach the database right now. Check MONGODB_URI and your network, then try again.', code: 'unavailable' };
  }
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid || !user.active) {
    const count = (entry?.count ?? 0) + 1;
    attempts.set(email, { count, until: count >= MAX_ATTEMPTS ? now + LOCK_MS : 0 });
    if (user && valid && !user.active) return { error: 'This account is paused. Contact your developer to restore access.', code: 'paused' };
    return { error: 'Email or password is incorrect.', code: 'invalid' };
  }

  attempts.delete(email);
  await setSessionCookie({ sub: String(user._id), role: user.role as 'admin' | 'client', name: user.name, email: user.email });
  redirect(user.role === 'admin' ? '/admin' : '/portal');
}

export async function logout() {
  clearSessionCookie();
  redirect('/login');
}
