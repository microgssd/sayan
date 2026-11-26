/** Sends a transactional email through Resend. Does nothing (and says so) when email isn't configured. */
export const mailReady = () => Boolean(process.env.RESEND_API_KEY && process.env.CONTACT_FROM_EMAIL);

export async function sendMail(m: { to: string; subject: string; html: string; text: string }) {
  if (!mailReady()) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.CONTACT_FROM_EMAIL, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A plain, readable email: heading, message, one button. */
export function emailLayout(o: { brand: string; title: string; body: string; ctaLabel: string; ctaUrl: string }) {
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f9;font-family:Arial,Helvetica,sans-serif;color:#0b0b14">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="padding:22px 28px;background:#0b0b14;color:#f1f5f9;font-size:15px;font-weight:bold">${esc(o.brand)}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:21px;line-height:1.25">${esc(o.title)}</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#334155">${esc(o.body)}</p>
<a href="${esc(o.ctaUrl)}" style="display:inline-block;background:#a855f7;color:#0b0b14;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:999px">${esc(o.ctaLabel)}</a>
</td></tr></table></td></tr></table></body></html>`;
  return { html, text: `${o.title}\n\n${o.body}\n\n${o.ctaLabel}: ${o.ctaUrl}\n` };
}
