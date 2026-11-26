'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { CheckoutResult } from '@/lib/actions/autopay';
import { useI18n } from './i18n';
import { Button, Dialog, Field, Input } from './ui';

declare global {
  interface Window {
    Cashfree?: (o: { mode: string }) => {
      checkout: (o: Record<string, unknown>) => Promise<{ error?: { message?: string } } | void>;
      subscriptionsCheckout: (o: Record<string, unknown>) => Promise<{ error?: { message?: string } } | void>;
    };
  }
}

/** Loads Cashfree's checkout script on demand, then hands the browser over to Cashfree's secure page. */
export async function openCheckout(kind: 'payment' | 'mandate', sessionId: string, env: string) {
  if (!window.Cashfree) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load the payment page.'));
      document.head.appendChild(s);
    });
  }
  const cashfree = window.Cashfree!({ mode: env === 'production' ? 'production' : 'sandbox' });
  const r =
    kind === 'mandate'
      ? await cashfree.subscriptionsCheckout({ subsSessionId: sessionId, redirectTarget: '_self' })
      : await cashfree.checkout({ paymentSessionId: sessionId, redirectTarget: '_self' });
  if (r && r.error) throw new Error(r.error.message || 'The payment page could not open.');
}

/** A button that asks the server for a payment session, then opens Cashfree. Shows its own error text. */
export function CheckoutButton({
  run,
  kind,
  children,
  variant = 'primary',
  size = 'md',
  className,
  askPhone,
}: {
  run: (phone?: string) => Promise<CheckoutResult>;
  kind: 'payment' | 'mandate';
  children: React.ReactNode;
  variant?: 'primary' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
  /** When true, a missing phone number opens a small prompt (autopay needs one for the bank). */
  askPhone?: boolean;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phone, setPhone] = useState('');

  const go = async (withPhone?: string) => {
    setBusy(true);
    setError('');
    try {
      const r = await run(withPhone);
      if (!r.ok) {
        if (r.code === 'phone' && askPhone) {
          setPhoneOpen(true);
          setBusy(false);
          return;
        }
        setError(r.code === 'tooMany' || r.code === 'nothing' ? r.error : t.waas.errPay);
        setBusy(false);
        return;
      }
      setPhoneOpen(false);
      await openCheckout(kind, r.sessionId, r.env); // leaves the page
    } catch {
      setError(t.waas.errPay);
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant={variant} size={size} className={className} disabled={busy} onClick={() => go()}>
        {busy && <Loader2 className="animate-spin" />}
        {busy ? t.waas.preparing : children}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
      {askPhone && (
        <Dialog open={phoneOpen} onClose={() => setPhoneOpen(false)} title={t.waas.phoneTitle} description={t.waas.phoneHint}>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (phone.replace(/\D/g, '').length >= 8) void go(phone);
            }}
          >
            <Field label={t.waas.phoneLabel}>
              <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 416 555 0100" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPhoneOpen(false)}>
                {t.waas.cancel}
              </Button>
              <Button type="submit" disabled={busy}>
                {t.waas.continue}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
