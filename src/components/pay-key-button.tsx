'use client';

import { payByKeyAction } from '@/lib/actions/autopay';
import { CheckoutButton } from './cashfree-checkout';

/** The pay-to-restore button. It lives in the browser, so it can call the server action itself. */
export function PayByKeyButton({ payKey, children, className }: { payKey: string; children: React.ReactNode; className?: string }) {
  return (
    <CheckoutButton kind="payment" run={() => payByKeyAction(payKey)} className={className}>
      {children}
    </CheckoutButton>
  );
}
