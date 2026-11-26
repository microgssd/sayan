export type Geo = { city: string; region: string; country: string; timezone: string };

const dec = (v: string | null) => {
  if (!v) return '';
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};

/** Visitor location from the hosting provider's IP headers (Vercel, Netlify, Cloudflare). Nothing is stored. */
export function geoFromHeaders(h: Headers): Geo {
  const geo: Geo = {
    city: dec(h.get('x-vercel-ip-city')),
    region: dec(h.get('x-vercel-ip-country-region')),
    country: h.get('x-vercel-ip-country') ?? '',
    timezone: h.get('x-vercel-ip-timezone') ?? '',
  };
  const nf = h.get('x-nf-geo');
  if (nf) {
    try {
      const g = JSON.parse(Buffer.from(nf, 'base64').toString('utf8'));
      geo.city ||= g.city ?? '';
      geo.region ||= g.subdivision?.name ?? '';
      geo.country ||= g.country?.code ?? '';
      geo.timezone ||= g.timezone ?? '';
    } catch {}
  }
  geo.country ||= h.get('cf-ipcountry') ?? '';
  geo.city ||= dec(h.get('cf-ipcity'));
  geo.timezone ||= h.get('cf-timezone') ?? '';
  if (geo.country === 'XX' || geo.country === 'T1') geo.country = '';
  return geo;
}
