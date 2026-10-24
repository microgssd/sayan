import { ImageResponse } from 'next/og';
import { loadPortfolio } from '@/lib/ledger';

export const alt = 'Portfolio';

const MARK = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iOCIgZmlsbD0iIzBCMEIxNCIvPjxwYXRoIHRyYW5zZm9ybT0idHJhbnNsYXRlKC0yIDEpIiBkPSJNMjEuMiAxMWMtMS0xLjctMi44LTIuNy01LTIuNy0zIDAtNS4xIDEuNi01LjEgMy45IDAgMi40IDIgMy40IDUuMSA0LjEgMy4yLjcgNS4zIDEuOCA1LjMgNC40IDAgMi41LTIuMyA0LjItNS40IDQuMi0yLjUgMC00LjUtMS4xLTUuNS0zIiBmaWxsPSJub25lIiBzdHJva2U9IiNGMUY1RjkiIHN0cm9rZS13aWR0aD0iMy40IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cGF0aCBkPSJNMjQuNSA0LjVjLjMgMi42IDIuMiA0LjUgNC44IDQuOC0yLjYuMy00LjUgMi4yLTQuOCA0LjgtLjMtMi42LTIuMi00LjUtNC44LTQuOCAyLjYtLjMgNC41LTIuMiA0LjgtNC44WiIgZmlsbD0iI0E4NTVGNyIvPjwvc3ZnPgo=';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

// Social preview card generated from your live settings (LinkedIn, X, WhatsApp, Slack).
export default async function OpenGraphImage() {
  const { settings, projects } = await loadPortfolio();
  const title = settings.heroTitle.split(/\r?\n/).join(' ');
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          backgroundColor: '#0B0B14',
          backgroundImage: 'radial-gradient(circle at 85% 0%, rgba(168,85,247,0.38), transparent 55%)',
          color: '#F1F5F9',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 30, fontWeight: 700 }}>
          <img src={MARK} width={64} height={64} alt="" />
          {settings.name}
        </div>
        <div style={{ fontSize: 78, fontWeight: 800, letterSpacing: -3, lineHeight: 1, maxWidth: 1000 }}>{title}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, color: '#C084FC' }}>
          <span>Full-stack developer</span>
          <span>{projects.length ? `${projects.length} live products` : settings.availability}</span>
        </div>
      </div>
    ),
    size,
  );
}
