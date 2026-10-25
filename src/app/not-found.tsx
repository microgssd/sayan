import Link from 'next/link';
import { getDict } from '@/lib/i18n/server';

export default function NotFound() {
  const t = getDict();
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="font-display text-6xl font-bold text-accent-fg">404</p>
        <p className="mt-4 text-muted">{t.notFound.body}</p>
        <Link href="/" className="mt-6 inline-block font-semibold text-accent-fg underline-offset-4 hover:underline">
          {t.notFound.home}
        </Link>
      </div>
    </main>
  );
}
