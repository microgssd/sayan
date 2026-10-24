'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Send } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { submitContact } from '@/lib/actions/contact';
import { BUDGETS, PROJECT_TYPES } from '@/lib/contact-options';
import { useI18n } from '../i18n';
import { cn } from '@/lib/utils';

const ease = [0.22, 1, 0.36, 1] as const;
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** A fill-in-the-blanks inline input that grows to fit exactly what's typed. */
function Blank({
  label, value, onChange, placeholder, type = 'text', autoComplete, invalid, inputMode,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  type?: string; autoComplete?: string; invalid?: boolean; inputMode?: 'email' | 'text';
}) {
  const [focused, setFocused] = useState(false);
  return (
    // An invisible copy of the text sits in the same grid cell, so the input is always exactly as wide as its content.
    <span className="relative inline-grid max-w-full align-baseline">
      <span aria-hidden className="invisible col-start-1 row-start-1 overflow-hidden whitespace-pre px-1 pb-0.5 font-bold">
        {value || placeholder}
      </span>
      <input
        aria-label={label}
        aria-invalid={invalid || undefined}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        size={1}
        className={cn(
          'col-start-1 row-start-1 w-full min-w-[3ch] rounded-none border-0 border-b-2 bg-transparent px-1 pb-0.5 font-bold text-accent-fg outline-none transition-colors placeholder:font-semibold placeholder:text-subtle',
          invalid ? 'border-danger' : 'border-line',
        )}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-accent"
        initial={false}
        animate={{ scaleX: focused ? 1 : 0 }}
        transition={{ duration: 0.4, ease }}
      />
    </span>
  );
}

function Chip({ on, onClick, children, role }: { on: boolean; onClick: () => void; children: React.ReactNode; role?: 'radio' }) {
  return (
    <motion.button
      type="button"
      role={role}
      aria-pressed={role ? undefined : on}
      aria-checked={role ? on : undefined}
      onClick={onClick}
      whileTap={{ scale: 0.93 }}
      layout
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors duration-300',
        on ? 'border-accent bg-accent text-accent-ink' : 'border-line text-heading hover:border-accent/70 hover:bg-accent/10',
      )}
    >
      <AnimatePresence initial={false}>
        {on && (
          <motion.span initial={{ width: 0, opacity: 0, scale: 0 }} animate={{ width: 'auto', opacity: 1, scale: 1 }} exit={{ width: 0, opacity: 0, scale: 0 }} className="inline-flex">
            <Check className="h-4 w-4" strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
      {children}
    </motion.button>
  );
}

export function ContactForm() {
  const { t } = useI18n();
  const c = t.contact;
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [budget, setBudget] = useState('');
  const [details, setDetails] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [shake, setShake] = useState(0);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  // Any edit clears a showing error, so it never lingers after the problem is fixed.
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    if (error) setError(null);
  };

  const fail = (message: string, field?: string) => {
    setError({ message, field });
    setShake((s) => s + 1);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return fail(c.errors.name, 'name');
    if (!emailOk(email)) return fail(c.errors.email, 'email');
    if (!types.length && details.trim().length < 10) return fail(c.errors.need, 'projectTypes');
    setError(null);
    start(async () => {
      const r = await submitContact({ name, email, company, projectTypes: types, budget, details, website, startedAt: startedAt.current });
      if (r.ok) setSent(true);
      else fail(r.code ? c.errors[r.code] : r.error, r.field === 'name' || r.field === 'email' ? r.field : r.code === 'need' ? 'projectTypes' : r.field);
    });
  };

  const reset = () => {
    setName(''); setCompany(''); setEmail(''); setTypes([]); setBudget(''); setDetails(''); setSent(false);
    startedAt.current = Date.now();
  };

  return (
    <div className="group/form relative overflow-hidden rounded-[30px] p-px">
      {/* Animated border light that wakes up while the form is in use */}
      <div aria-hidden className="absolute inset-0 rounded-[30px] bg-line" />
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 aspect-square w-[160%] -translate-x-1/2 -translate-y-1/2 animate-[spin_7s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,rgb(var(--accent))_40deg,rgb(var(--accent-fg))_70deg,transparent_110deg)] opacity-30 transition-opacity duration-700 group-focus-within/form:opacity-100 motion-reduce:animate-none"
      />
      <div className="relative rounded-[29px] bg-surface p-6 sm:p-10">
        <AnimatePresence mode="wait" initial={false}>
          {!sent ? (
            <motion.form
              key="form"
              onSubmit={submit}
              noValidate
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16, filter: 'blur(6px)' }}
              transition={{ duration: 0.45, ease }}
            >
              <motion.p
                key={`s-${shake}-${error?.field === 'name' || error?.field === 'email'}`}
                animate={error && (error.field === 'name' || error.field === 'email') ? { x: [0, -10, 10, -6, 6, 0] } : {}}
                transition={{ duration: 0.45 }}
                className="text-[clamp(1.3rem,2.5vw,2rem)] font-bold leading-[1.9] tracking-[-0.02em] text-heading"
              >
                {c.hi} <Blank label={c.nameLabel} value={name} onChange={edit(setName)} placeholder={c.namePh} autoComplete="name" invalid={error?.field === 'name'} />{' '}
                {c.from} <Blank label={c.companyLabel} value={company} onChange={edit(setCompany)} placeholder={c.companyPh} autoComplete="organization" />
                {c.reach}{' '}
                <Blank label={c.emailLabel} type="email" inputMode="email" value={email} onChange={edit(setEmail)} placeholder={c.emailPh} autoComplete="email" invalid={error?.field === 'email'} />
              </motion.p>

              <motion.fieldset
                key={`t-${shake}-${error?.field === 'projectTypes'}`}
                animate={error?.field === 'projectTypes' ? { x: [0, -10, 10, -6, 6, 0] } : {}}
                transition={{ duration: 0.45 }}
                className="mt-8"
              >
                <legend className="mb-3 text-sm font-semibold text-muted">{c.needHelp}</legend>
                <div className="flex flex-wrap gap-2">
                  {/* Stored in English so your inbox stays consistent; shown in the visitor's language */}
                  {PROJECT_TYPES.map((v, i) => (
                    <Chip key={v} on={types.includes(v)} onClick={() => edit(setTypes)(types.includes(v) ? types.filter((x) => x !== v) : [...types, v])}>
                      {c.types[i] ?? v}
                    </Chip>
                  ))}
                </div>
              </motion.fieldset>

              <fieldset className="mt-7">
                <legend className="mb-3 text-sm font-semibold text-muted">{c.budget}</legend>
                <div role="radiogroup" aria-label={c.budget} className="flex flex-wrap gap-2">
                  {BUDGETS.map((b, i) => (
                    <Chip key={b} role="radio" on={budget === b} onClick={() => setBudget(budget === b ? '' : b)}>
                      {c.budgets[i] ?? b}
                    </Chip>
                  ))}
                </div>
              </fieldset>

              <label className="mt-8 block">
                <span className="mb-2 flex justify-between text-sm font-semibold text-muted">
                  {c.about}
                  <span className="tabular-nums text-subtle">{details.length}/3000</span>
                </span>
                <span className="relative block">
                  <textarea
                    value={details}
                    maxLength={3000}
                    onChange={(e) => edit(setDetails)(e.target.value)}
                    rows={4}
                    placeholder={c.aboutPh}
                    className="peer block w-full resize-y rounded-2xl border border-line bg-bg/60 px-4 py-3 text-base text-ink outline-none transition-colors placeholder:text-subtle focus:border-accent"
                  />
                </span>
              </label>

              <div aria-hidden className="absolute -left-[9999px] top-0">
                <label>
                  Website
                  <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </label>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                <p role="alert" aria-live="polite" className="min-h-[1.25rem] text-sm font-semibold text-danger">
                  {error?.message}
                </p>
                <motion.button
                  type="submit"
                  disabled={pending}
                  whileTap={{ scale: 0.97 }}
                  className="group relative ml-auto inline-flex h-14 items-center gap-3 overflow-hidden rounded-full bg-accent pl-7 pr-2 text-base font-bold text-accent-ink disabled:opacity-80"
                >
                  <span>{pending ? c.sending : c.send}</span>
                  <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-accent-ink text-accent">
                    {pending ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                    ) : (
                      <Send className="h-4 w-4 transition-transform duration-500 group-hover:-translate-y-6 group-hover:translate-x-6" />
                    )}
                    {!pending && <Send className="absolute h-4 w-4 -translate-x-6 translate-y-6 transition-transform duration-500 group-hover:translate-x-0 group-hover:translate-y-0" />}
                  </span>
                </motion.button>
              </div>
            </motion.form>
          ) : (
            <Success key="done" name={name} email={email} onReset={reset} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Success({ name, email, onReset }: { name: string; email: string; onReset: () => void }) {
  const { t, fmt } = useI18n();
  const sparks = Array.from({ length: 10 });
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease }} className="grid place-items-center py-10 text-center">
      <div className="relative h-24 w-24">
        {sparks.map((_, i) => {
          const a = (i / sparks.length) * Math.PI * 2;
          return (
            <motion.svg
              key={i}
              viewBox="0 0 24 24"
              aria-hidden
              className="absolute left-1/2 top-1/2 h-4 w-4 text-accent-fg"
              initial={{ x: '-50%', y: '-50%', scale: 0, opacity: 1 }}
              animate={{ x: `calc(-50% + ${Math.cos(a) * 80}px)`, y: `calc(-50% + ${Math.sin(a) * 80}px)`, scale: [0, 1.2, 0], opacity: [1, 1, 0] }}
              transition={{ duration: 1.1, ease: 'easeOut', delay: 0.35 }}
            >
              <path d="M12 0c.6 6.6 5.4 11.4 12 12-6.6.6-11.4 5.4-12 12-.6-6.6-5.4-11.4-12-12C6.6 11.4 11.4 6.6 12 0Z" fill="currentColor" />
            </motion.svg>
          );
        })}
        <svg viewBox="0 0 96 96" className="h-24 w-24" aria-hidden>
          <motion.circle cx="48" cy="48" r="44" fill="none" stroke="rgb(var(--accent))" strokeWidth="4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease }} />
          <motion.path d="M30 49 l12 12 l24 -26" fill="none" stroke="rgb(var(--accent-fg))" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.45, ease }} />
        </svg>
      </div>
      <h3 className="mt-6 text-3xl font-extrabold tracking-[-0.03em]">{t.contact.sentTitle}</h3>
      <p className="mt-3 max-w-sm text-muted">{fmt(t.contact.sentBody, { name: name.trim().split(/\s+/)[0]!, email })}</p>
      <button onClick={onReset} className="mt-8 rounded-full border border-line px-5 py-2.5 text-sm font-bold text-heading transition-colors hover:border-heading">
        {t.contact.another}
      </button>
    </motion.div>
  );
}
