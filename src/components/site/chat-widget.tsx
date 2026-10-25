'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Check, MessageCircle, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn, initials } from '@/lib/utils';
import { useI18n } from '../i18n';

type Msg = { id: string; from: 'visitor' | 'owner'; text: string; at: string; state?: 'sending' | 'failed' };
type Status = { online: boolean; code: 'active' | 'online' | 'away'; label: string };

const KEY = 'chat-token-v1';
const ease = [0.22, 1, 0.36, 1] as const;
const timeOf = (iso: string, locale?: string) => new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });

/** Opens the chat from anywhere: window.dispatchEvent(new Event('open-chat')) */
export const openChat = () => window.dispatchEvent(new Event('open-chat'));

export function ChatWidget({ ownerName, photoUrl, emailReplies }: { ownerName: string; photoUrl: string; emailReplies: boolean }) {
  const { t, fmt, lang, locale } = useI18n();
  const c = t.chat;
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [hasEmail, setHasEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [emailNote, setEmailNote] = useState('');
  const [error, setError] = useState('');
  const [teaser, setTeaser] = useState(false);
  const lastAt = useRef<string | null>(null);
  const openRef = useRef(open);
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const first = ownerName.split(' ')[0];
  openRef.current = open;

  // Restore an existing conversation, and allow other buttons on the page to open the chat.
  useEffect(() => {
    try {
      setToken(localStorage.getItem(KEY));
    } catch {}
    const onOpen = () => setOpen(true);
    window.addEventListener('open-chat', onOpen);
    // A gentle one-time nudge per session.
    let t: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!sessionStorage.getItem('chat-teaser')) {
        t = setTimeout(() => {
          setTeaser(true);
          sessionStorage.setItem('chat-teaser', '1');
        }, 12000);
      }
    } catch {}
    return () => {
      window.removeEventListener('open-chat', onOpen);
      if (t) clearTimeout(t);
    };
  }, []);

  const merge = useCallback((incoming: Msg[]) => {
    if (!incoming.length) return;
    setMsgs((cur) => {
      const ids = new Set(cur.map((m) => m.id));
      const fresh = incoming.filter((m) => !ids.has(m.id));
      if (!fresh.length) return cur;
      const ownerNew = fresh.filter((m) => m.from === 'owner').length;
      if (ownerNew && (!openRef.current || document.hidden)) setUnread((u) => u + ownerNew);
      return [...cur, ...fresh].sort((a, b) => a.at.localeCompare(b.at));
    });
    lastAt.current = incoming[incoming.length - 1]!.at;
  }, []);

  const poll = useCallback(async () => {
    try {
      const url = `/api/chat/messages${lastAt.current ? `?after=${encodeURIComponent(lastAt.current)}` : ''}`;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.status);
      if (token && data.known === false) {
        // The conversation no longer exists (e.g. deleted). Start fresh.
        localStorage.removeItem(KEY);
        setToken(null);
        setMsgs([]);
        lastAt.current = null;
        return;
      }
      if (data.hasEmail) setHasEmail(true);
      merge(data.messages ?? []);
    } catch {}
  }, [token, merge]);

  // Poll quickly while open, slowly while closed, and not at all in a hidden tab.
  useEffect(() => {
    if (!token && !open) return;
    poll();
    const every = open ? 3000 : 20000;
    const t = setInterval(() => !document.hidden && poll(), every);
    const onVisible = () => !document.hidden && poll();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, open, poll]);

  // Clear unread on open; flag new replies in the tab title while away.
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, '');
    document.title = unread > 0 ? `(${unread}) ${base}` : base;
  }, [unread]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const deliver = async (temp: Msg) => {
    setMsgs((cur) => cur.map((m) => (m.id === temp.id ? { ...m, state: 'sending' } : m)));
    setError('');
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text: temp.text, name: name.trim() || undefined, page: location.pathname }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data.code && c.errors[data.code as keyof typeof c.errors]) || data.error || c.errors.failed);
      if (data.token) {
        localStorage.setItem(KEY, data.token);
        setToken(data.token);
      }
      setMsgs((cur) => cur.map((m) => (m.id === temp.id ? data.message : m)));
      lastAt.current = data.message.at > (lastAt.current ?? '') ? data.message.at : lastAt.current;
    } catch (err) {
      setMsgs((cur) => cur.map((m) => (m.id === temp.id ? { ...m, state: 'failed' } : m)));
      setError((err as Error).message === 'Failed to fetch' ? c.offline : (err as Error).message);
    }
  };

  const send = () => {
    const body = text.trim();
    if (!body) return;
    const temp: Msg = { id: `tmp-${Date.now()}`, from: 'visitor', text: body, at: new Date().toISOString(), state: 'sending' };
    setMsgs((cur) => [...cur, temp]);
    setText('');
    deliver(temp);
  };

  const saveEmail = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setEmailNote(c.emailInvalid);
    const res = await fetch('/api/chat/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      setHasEmail(true);
      setEmailNote('');
    } else setEmailNote(c.emailFailed);
  };

  const visitorSent = msgs.some((m) => m.from === 'visitor' && !m.state);
  const Avatar = ({ size }: { size: number }) => (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <span className="block h-full w-full overflow-hidden rounded-full bg-accent">
        {photoUrl?.startsWith('https://') ? (
          <Image src={photoUrl} alt="" width={size} height={size} className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-xs font-extrabold text-accent-ink">{initials(ownerName)}</span>
        )}
      </span>
      {status && <span className={cn('absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface', status.online ? 'bg-emerald-400' : 'bg-subtle')} />}
    </span>
  );

  return (
    <>
      {/* Launcher */}
      <div className="fixed bottom-5 right-5 z-[80] flex items-end gap-3">
        <AnimatePresence>
          {teaser && !open && (
            <motion.button
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              onClick={() => {
                setTeaser(false);
                setOpen(true);
              }}
              className="hidden max-w-[220px] rounded-2xl rounded-br-md border border-line bg-surface px-4 py-3 text-left text-sm font-semibold text-heading shadow-2xl sm:block"
            >
              {c.teaser}
            </motion.button>
          )}
        </AnimatePresence>
        <motion.button
          onClick={() => {
            setTeaser(false);
            setOpen((o) => !o);
          }}
          aria-label={open ? c.close : fmt(c.open, { name: first })}
          aria-expanded={open}
          whileTap={{ scale: 0.92 }}
          className={cn(
            'relative grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_16px_40px_-12px_rgb(var(--accent))] transition-transform hover:scale-105',
            open && 'max-sm:hidden',
          )}
        >
          {!open && !token && <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-25 motion-reduce:hidden" />}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={open ? 'x' : 'chat'} initial={{ rotate: -90, scale: 0 }} animate={{ rotate: 0, scale: 1 }} exit={{ rotate: 90, scale: 0 }} transition={{ duration: 0.2 }}>
              {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
            </motion.span>
          </AnimatePresence>
          {unread > 0 && !open && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-heading px-1.5 text-xs font-bold text-bg">
              {unread}
            </motion.span>
          )}
        </motion.button>
      </div>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={fmt(c.open, { name: ownerName })}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed inset-0 z-[85] flex origin-bottom-right flex-col overflow-hidden bg-surface sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[min(620px,calc(100svh-8rem))] sm:w-[390px] sm:rounded-[28px] sm:border sm:border-line sm:shadow-[0_40px_100px_-30px_rgb(0_0_0/0.6)]"
            data-lenis-prevent
          >
            <header className="relative flex items-center gap-3 border-b border-line px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-accent/25 blur-3xl" />
              <Avatar size={42} />
              <div className="relative min-w-0 flex-1">
                <p className="font-bold text-heading">{ownerName}</p>
                <p className="truncate text-xs text-muted">{status ? c.status[status.code] ?? status.label : c.status.loading}</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label={c.close} className="relative grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </header>

            <ol ref={listRef} aria-live="polite" className="flex flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-4 py-5">
              <li className="mb-2 flex items-end gap-2">
                <Avatar size={26} />
                <span className="max-w-[80%] rounded-2xl rounded-bl-md bg-surface-2 px-4 py-2.5 text-sm leading-relaxed text-ink">
                  {fmt(c.greeting, { name: first })}
                </span>
              </li>
              {msgs.map((m, i) => {
                const mine = m.from === 'visitor';
                const lastOfGroup = msgs[i + 1]?.from !== m.from;
                return (
                  <motion.li
                    key={m.id}
                    layout="position"
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, ease }}
                    className={cn('flex flex-col', mine ? 'items-end' : 'items-start', lastOfGroup && 'mb-2')}
                  >
                    <span
                      className={cn(
                        'max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                        mine ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink',
                        mine && lastOfGroup && 'rounded-br-md',
                        !mine && lastOfGroup && 'rounded-bl-md',
                        m.state === 'sending' && 'opacity-70',
                        m.state === 'failed' && 'opacity-60 ring-2 ring-danger',
                      )}
                    >
                      {m.text}
                    </span>
                    {m.state === 'failed' ? (
                      <button onClick={() => deliver(m)} className="mt-1 flex items-center gap-1 text-xs font-semibold text-danger">
                        <RotateCcw className="h-3 w-3" /> {c.retry}
                      </button>
                    ) : (
                      lastOfGroup && (
                        <span className="mt-1 flex items-center gap-1 px-1 text-[11px] text-subtle">
                          {timeOf(m.at, lang === 'en' ? undefined : locale)}
                          {mine && m.state !== 'sending' && <Check className="h-3 w-3" />}
                        </span>
                      )
                    )}
                  </motion.li>
                );
              })}

              {visitorSent && !hasEmail && (
                <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-2 rounded-2xl border border-line p-3">
                  <p className="text-xs font-semibold text-muted">
                    {emailReplies ? c.emailAsk : c.emailAskManual}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEmail()}
                      placeholder="you@email.com"
                      aria-label={t.contact.emailLabel}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-sm text-ink outline-none focus:border-accent"
                    />
                    <button onClick={saveEmail} className="h-9 rounded-lg bg-heading px-3 text-xs font-bold text-bg">
                      {c.save}
                    </button>
                  </div>
                  {emailNote && <p className="mt-1.5 text-xs text-danger">{emailNote}</p>}
                </motion.li>
              )}
              {hasEmail && visitorSent && (
                <li className="mt-2 text-center text-xs text-subtle">{emailReplies ? c.emailSaved : c.emailSavedManual}</li>
              )}
            </ol>

            <div className="border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {!token && (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={c.namePh}
                  aria-label={t.contact.nameLabel}
                  maxLength={60}
                  className="mb-2 h-9 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink outline-none focus:border-accent"
                />
              )}
              {error && <p className="mb-2 px-1 text-xs font-semibold text-danger">{error}</p>}
              <div className="flex items-end gap-2 rounded-2xl border border-line bg-bg p-1.5 transition-colors focus-within:border-accent">
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  maxLength={2000}
                  placeholder={c.messagePh}
                  aria-label={c.message}
                  className="max-h-[120px] min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-ink outline-none placeholder:text-subtle"
                />
                <motion.button
                  onClick={send}
                  disabled={!text.trim()}
                  whileTap={{ scale: 0.9 }}
                  aria-label={c.send}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink transition-opacity disabled:opacity-40"
                >
                  <ArrowUp className="h-5 w-5" />
                </motion.button>
              </div>
              <p className="mt-2 text-center text-[11px] text-subtle">{fmt(c.footer, { name: first })}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
