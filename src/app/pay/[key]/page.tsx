import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandMark } from '@/components/brand-mark';
import { PayByKeyButton } from '@/components/pay-key-button';
import { cashfreeReady } from '@/lib/cashfree';
import { connectDB } from '@/lib/db';
import { formatMoney, type Currency } from '@/lib/currency';
import { fmt, LANG_META } from '@/lib/i18n';
import { getDict, getLang } from '@/lib/i18n/server';
import { Subscription } from '@/lib/models/Subscription';
import { Project } from '@/lib/models/Project';
import { siteStateFor, verifyOrder } from '@/lib/waas';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Payment', robots: { index: false, follow: false } };

/** Pay-to-restore page. Reached from a suspended website or a reminder email; no login needed, just the private link. */
export default async function PayPage({ params, searchParams }: { params: { key: string }; searchParams: { order?: string } }) {
  const t = getDict();
  const locale = LANG_META[getLang()].locale;
  const valid = /^[\w-]{20,40}$/.test(params.key);
  await connectDB();
  const sub: any = valid ? await Subscription.findOne({ payKey: params.key, status: 'active' }).lean() : null;

  let thanks = false;
  if (sub && searchParams.order && cashfreeReady()) {
    thanks = await verifyOrder(searchParams.order).catch(() => false);
  }
  const loaded = sub ? await siteStateFor(sub._id) : null;
  const dueNow = (loaded?.periods ?? []).filter((p) => p.remaining > 0.009 && new Date(p.dueDate).getTime() <= Date.now() + 7 * 86_400_000);
  const amount = Math.round(dueNow.reduce((x, p) => x + p.remaining, 0) * 100) / 100;
  const project: any = sub?.project ? await Project.findById(sub.project).select('name').lean() : null;
  const name = project?.name || sub?.name || '';

  return (
    <main className="grid min-h-[100svh] place-items-center px-5 py-10">
      <div className="w-full max-w-md rounded-[28px] border border-line bg-surface p-7 text-center shadow-[0_40px_80px_-50px_rgb(0_0_0/0.6)] sm:p-9">
        <BrandMark className="mx-auto h-12 w-12" />
        {!sub ? (
          <p className="mt-6 text-muted">{t.payPage.invalid}</p>
        ) : thanks ? (
          <>
            <h1 className="mt-6 text-2xl font-extrabold tracking-tight">{t.payPage.thanks}</h1>
            <p className="mt-3 text-muted">{t.payPage.thanksBody}</p>
          </>
        ) : amount > 0 ? (
          <>
            <p className="mt-6 text-sm font-semibold text-muted">{t.payPage.title}</p>
            <h1 className="mt-1 text-lg font-bold">{fmt(t.payPage.for, { name })}</h1>
            <p className="mt-5 text-xs font-semibold text-muted">{t.payPage.amountDue}</p>
            <p className="text-5xl font-extrabold tracking-[-0.04em] text-heading">{formatMoney(amount, sub.currency as Currency, { locale })}</p>
            <div className="mt-7">
              <PayByKeyButton payKey={params.key} className="w-full">
                {fmt(t.payPage.payNow, { amount: formatMoney(amount, sub.currency as Currency, { locale }) })}
              </PayByKeyButton>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted">{t.payPage.secure}</p>
          </>
        ) : (
          <p className="mt-6 text-muted">{t.payPage.nothingDue}</p>
        )}
        <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-accent-fg underline-offset-4 hover:underline">
          {t.payPage.login}
        </Link>
      </div>
    </main>
  );
}
