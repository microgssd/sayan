'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { login } from '@/lib/actions/auth';
import { Field, Input } from '@/components/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useI18n } from '@/components/i18n';

function Submit() {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return (
    <button
      disabled={pending}
      className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-accent-ink transition-shadow hover:shadow-[0_0_32px_-6px_rgb(var(--accent))] disabled:opacity-60"
    >
      {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {pending ? t.login.signingIn : t.login.submit}
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useFormState(login, null);
  const [show, setShow] = useState(false);
  const { t } = useI18n();
  const l = t.login;

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-16">
      <div className="bg-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_center,black,transparent_65%)]" />
      {/* Orbit lines echoing the homepage */}
      <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="relative col-start-1 row-start-1 h-[720px] w-[720px] animate-orbit rounded-full border border-line motion-reduce:animate-none">
          <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_16px_rgb(var(--accent))]" />
        </div>
        <div className="relative col-start-1 row-start-1 h-[540px] w-[540px] animate-orbit-slow-rev rounded-full border border-dashed border-line motion-reduce:animate-none">
          <span className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-brass" />
        </div>
      </div>

      <div className="absolute right-5 top-5 z-10 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm rounded-3xl border border-line bg-surface/90 p-8 shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-6 grid h-11 w-11 place-items-center rounded-full bg-accent/15 text-accent-fg">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{l.title}</h1>
        <p className="mt-2 text-sm text-muted">{l.subtitle}</p>

        <form action={action} className="mt-7 grid gap-4">
          <Field label={l.email}>
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label={l.password}>
            <div className="relative">
              <Input name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required className="pr-10" />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? l.hide : l.show}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          {state?.error && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {l.errors[state.code] ?? state.error}
            </p>
          )}
          <Submit />
        </form>
        <p className="mt-6 text-center text-xs text-muted">
          {l.noAccount}{' '}
          <Link href="/" className="font-semibold text-ink underline-offset-4 hover:underline">
            {l.back}
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
