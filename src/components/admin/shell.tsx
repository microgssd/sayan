'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { BarChart3, ExternalLink, FolderKanban, Inbox, LayoutGrid, LogOut, MessagesSquare, Repeat, Settings, Users, Wallet } from 'lucide-react';
import { logout } from '@/lib/actions/auth';
import { ThemeToggle } from '../theme-toggle';
import { CurrencySwitcher } from '../currency-switcher';
import { useCurrency } from '../currency-context';
import { cn } from '@/lib/utils';
import { BrandMark } from '../brand-mark';

const nav = [
  { href: '/admin', label: 'Overview', icon: LayoutGrid },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/projects', label: 'Projects', icon: FolderKanban },
  { href: '/admin/payments', label: 'Payments', icon: Wallet },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: Repeat },
  { href: '/admin/chats', label: 'Live chat', icon: MessagesSquare },
  { href: '/admin/messages', label: 'Messages', icon: Inbox },
  { href: '/admin/settings', label: 'Site & profile', icon: Settings },
];

export function AdminShell({ name, unread = 0, waitingChats = 0, children }: { name: string; unread?: number; waitingChats?: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const { ratesLive, ratesUpdatedAt } = useCurrency();
  const isActive = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur-xl lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-5 py-4 lg:py-6">
          <Link href="/admin" className="flex items-center gap-3">
            <BrandMark className="h-9 w-9" />
            <span className="font-display text-sm font-semibold">Studio ledger</span>
          </Link>
          <div className="lg:hidden">
            <ThemeToggle />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3 lg:pb-0">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive(href) ? 'text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {isActive(href) && (
                <motion.span
                  layoutId="admin-nav"
                  className="absolute inset-0 rounded-xl border border-line bg-bg"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className={cn('relative h-4 w-4', isActive(href) && 'text-accent-fg')} />
              <span className="relative">{label}</span>
              {(() => {
                const n = href === '/admin/messages' ? unread : href === '/admin/chats' ? waitingChats : 0;
                return n > 0 ? (
                  <span className="relative ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-ink tabular-nums">{n}</span>
                ) : null;
              })()}
            </Link>
          ))}
        </nav>
        <div className="absolute inset-x-3 bottom-4 hidden gap-1 lg:grid">
          <Link href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:text-ink">
            <ExternalLink className="h-4 w-4" /> View public site
          </Link>
          <form action={logout}>
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:text-danger">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-8 sm:py-4">
          <p className="hidden text-xs text-muted sm:block">
            {ratesLive ? `Exchange rates updated ${ratesUpdatedAt.replace(/ \+0000$/, ' UTC')}` : 'Live exchange rates unavailable, using fallback rates'}
          </p>
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
            <CurrencySwitcher />
            <span className="hidden lg:block">
              <ThemeToggle />
            </span>
            <form action={logout} className="lg:hidden">
              <button aria-label="Sign out" className="grid h-10 w-10 place-items-center rounded-full border border-line text-muted">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-8 sm:py-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
