# Sayan Dhar: portfolio + client billing portal

Next.js 14 (App Router) · TypeScript · MongoDB (Mongoose) · Tailwind · Framer Motion · Lenis

Three apps in one codebase:

| Route | Who | What |
|---|---|---|
| `/` | Public | Opening curtain, hero with interactive signal field and photo-in-headline, scroll-velocity stack marquee, scroll-lit about statement, stacked case-study cards, stack, magnetic contact |
| `/admin` | You | Overview (billed / received / outstanding, 12-month income chart), clients, projects, payments by month, site settings |
| `/portal` | Each client | Only their own projects: cost, paid, pending, progress, payment history by month, printable statement |

All money views switch between **USD, CAD, INR, EUR and AUD** (live rates, cached 6 h, with an offline fallback).

## Quick start

```bash
npm install
cp .env.example .env.local      # fill in MONGODB_URI, AUTH_SECRET, ADMIN_*
npm run seed                    # creates your admin account + default site settings
npm run seed:demo               # optional: 2 demo clients, 3 projects, payments
npm run dev                     # http://localhost:3000, sign in at /login
```

Generate `AUTH_SECRET` with `openssl rand -base64 48`.

Day to day: **Site & profile** sets your photo, headline, socials and stack. **Clients → Add client** creates a login (share the email + password with them). **Projects** sets cost and currency; tick *Show on public portfolio* to feature it. **Record payment** whenever money arrives, and the client sees it immediately.

## Design system

- **Palette:** dark `#0B0B14` / `#1A1A2E` / `#F1F5F9` / `#A855F7` / `#C084FC`, light `#F8FAFC` / `#123B70` / `#2563EB` / `#334155`. Edit in `src/app/globals.css`.
- **Font:** Plus Jakarta Sans, self-hosted through `next/font` (preloaded, no layout shift).
- **Motion:** respects the visitor's reduced-motion setting. The opening plays once per browser session.
- **Case cards:** add an outcome line, up to 4 gallery images and a client quote per project in **Projects → Edit**. Projects without images get a styled browser mock-up.
- **SEO:** generated social preview image (`/opengraph-image`), `sitemap.xml`, `robots.txt` (admin and portal excluded), and Person structured data. Set `NEXT_PUBLIC_SITE_URL`.

## Icons

`src/app/icon.svg` (modern browsers), `src/app/favicon.ico` (16/32/48, older browsers), `src/app/apple-icon.png` (iPhone home screen) and `public/icon-*.png` + `src/app/manifest.ts` (Android, installable). Next.js adds all the `<link>` tags automatically. To change the mark, replace these files.

## Languages

The public site, contact form, live chat, login and client portal are available in **English** (default), **French**, **German** and **Spanish**. The admin dashboard always stays in English.

**Switching is instant and always in sync.** Every translation (interface and your own content) is sent with the page, so changing language re-renders everything in the browser in the same frame, with no trip to the server. The choice is remembered in a cookie (`lang`) for a year, and dates, times and amounts follow each language's conventions.

**Animations:** each switch plays one of three styles at random, never the same one twice in a row: flag ribbons that sweep across and reveal the new flag, a split-flap flip of the on-screen text, or frosted glass over the flag with its badge and name. Each uses the real flag of the language being switched to. They live in `src/lib/lang-transitions.ts`; remove a name from `TRANSITIONS` to take it out of the rotation. To preview one style, run `localStorage.setItem('lang-fx', 'ribbons')` in the browser console (`ribbons`, `flap` or `frost`), and `localStorage.removeItem('lang-fx')` to go back to random. Reduced-motion visitors get an instant switch.

**Your own text is translated automatically.** Add one key to your environment:

- `DEEPL_API_KEY`: free at deepl.com/pro-api (500,000 characters a month; free keys end in `:fx`). Recommended.
- or `ANTHROPIC_API_KEY` to translate with Claude (`ANTHROPIC_MODEL` optional).

Then whenever you save in the admin, changed English text is translated into French, German and Spanish and stored. Visitors never wait for it. That covers:
- your hero sentence (the `[1] [2] [3]` pill markers are kept), intro, about statement, availability, location and stack category names
- each project's summary, outcome, client quote and role
- subscription descriptions

Press **Site & profile → Translations → Translate everything now** once after adding the key to translate everything you've already written. Every translation is editable: Site & profile has French, German and Spanish tabs, and each project has a "Translations" section. A translation you correct by hand is kept until you change the English again.

Not translated: project names, technology names, payment notes and PDF invoices. Search engines index the English version.

## Subscriptions, invoices and analytics

**Subscriptions** (Admin → Subscriptions) are monthly services such as social media management. Each calendar month is a billing period: paid, part paid, due, or overdue after the due day. Changing the price applies from the current month onward; months already billed keep their original price. Click a month to mark it paid. That records a payment, creates its invoice, and stops the alert in the client's portal (which refreshes itself every 30 seconds and when the client returns to the tab). "Undo" removes the payment and voids its invoice.

**Invoices** are created automatically for every payment, numbered `INV-YYYY-0001` per calendar year from an atomic counter, so numbers are never duplicated or reused. Each invoice is stored as a small data record (about 1 KB) holding a snapshot of the figures at payment time: date, project or subscription month, total cost, amount paid, paid to date and pending. The PDF is generated on demand and never saved.
- **Send** emails the PDF to the client (needs `RESEND_API_KEY` and `CONTACT_FROM_EMAIL` with a domain verified in Resend).
- **Mark sent** is for invoices you delivered yourself, for example by WhatsApp.
- Clients can only see and download invoices you have sent. Unsent and void invoices stay private.
- Editing a payment refreshes its invoice only while it's unsent. Deleting a payment voids its invoice but keeps the number.
- Payments recorded before this update show "Create invoice".

**Analytics** (Admin → Analytics): daily, weekly, monthly and yearly totals, change versus the previous period, projects versus subscriptions, monthly recurring revenue, and breakdowns by client, item and payment method. Click any bar to see its payments.

**Search** on the admin Payments page and in the client portal matches invoice numbers, project or subscription names, clients, references and dates written any common way (`2026-10-04`, `04/10/2026`, `4 oct 2026`, `october 2026`).

**Client portal:** the Total, Paid and Pending cards open a breakdown per project and subscription, filterable by month.

## Live chat via Telegram

Visitors chat from the bubble on your homepage. Each message goes to your Telegram through your own bot. **Reply to the message in Telegram** (swipe left on it) and the visitor sees your answer in their chat window within a few seconds. A 👍 on your message confirms it was delivered.

Setup (about 5 minutes, also shown step by step in **Admin → Live chat**):

1. In Telegram, message **@BotFather**, send `/newbot`, pick a name, and copy the token into `TELEGRAM_BOT_TOKEN`.
2. Open your new bot and press **Start**. In Admin → Live chat press **Find my chat ID**, and save it as `TELEGRAM_OWNER_CHAT_ID`.
3. Set `TELEGRAM_WEBHOOK_SECRET` to a random string (letters, numbers, `-`, `_`), and `NEXT_PUBLIC_SITE_URL` to your live https address. Redeploy.
4. Press **Connect webhook**, then **Send test message**.

In Telegram: `/chats` lists recent conversations, `/help` shows how replying works. Only your chat ID can reply; anyone else messaging the bot is ignored.

How it works: visitor messages and your replies are stored in MongoDB (`ChatSession`, `ChatMessage`). Telegram calls `/api/telegram/webhook` (verified by the secret header). The visitor's widget checks for new messages every 3 seconds while open and every 20 seconds while closed, which works on serverless hosts like Vercel and Netlify. Visitors are identified by a random token kept in their browser; only its hash is stored. Rate limits stop spam.

You can also read and reply in **Admin → Live chat**; dashboard replies are copied into Telegram so the thread stays complete. Close or block conversations there too.

If a visitor leaves their email and has closed the page, your reply is emailed to them, provided `RESEND_API_KEY` and `CONTACT_FROM_EMAIL` are set with a domain verified in Resend.

**Local development:** Telegram can't reach `localhost`, so run `npm run telegram:poll` alongside `npm run dev`. It removes the bot's webhook while running, so use a separate test bot locally (or press Connect webhook on the live site afterwards).

## Image gallery

The "A closer look" section shows two rows of screenshots drifting slowly in opposite directions (about 60 px a second). It uses image **links**, nothing is uploaded:
- every portfolio project's **Cover image** and **Gallery images** (Admin → Projects), and
- any extra links in **Site & profile → Extra gallery images** (one per line, up to 40).

Hovering pauses a row and shows the project name; clicking scrolls to that project's case card. A broken link shows a styled placeholder instead of a broken image. Images load lazily. With reduced motion turned on, the rows stay still and can be swiped. The section hides itself until there is at least one image. To change the speed, edit `seconds = filled.length * 7` in `src/components/site/gallery.tsx` (bigger number = slower).

## Contact form and visitor location

- Messages from the footer form are saved to MongoDB and appear in **Admin → Messages** (unread count in the sidebar). Reply, mark read, archive or delete from there.
- Optional email alerts: set `RESEND_API_KEY` and `CONTACT_NOTIFY_EMAIL` (free tier at resend.com). Without them, messages are still saved.
- Spam protection: hidden honeypot field, a minimum fill time, and 5 messages per hour per IP.
- The visitor's city, country and time zone come from your host's IP headers (Vercel and Netlify add them automatically, Cloudflare with "visitor location headers" on). Locally, it falls back to the browser's time zone. Nothing is stored except the city and country on submitted messages.
- Set your own time zone in **Site & profile** so the footer can show the time difference.

## How the money works

- Each project has a **billing currency**. Paid and pending are always calculated in that currency, so they are exact.
- A payment can arrive in a different currency (e.g. a CAD project paid in EUR via Wise). The exchange rate is **saved with the payment** (today’s market rate by default, or type your bank’s actual rate). That way the ledger never drifts when rates move later.
- For the same reason, a project’s currency is **locked once it has payments**.
- Overpayments show as a credit, never as negative pending.
- Totals across projects (dashboard, client summary) are converted at **today’s** rate for display only. Hover any amount to see the original.

## Security

- Passwords hashed with bcrypt (cost 12). Sessions are signed JWTs in an httpOnly, SameSite=Lax cookie (7 days).
- Roles are enforced three times: middleware, every page, **and every server action** (`requireAdmin()`).
- The portal always queries by the logged-in client’s id, never by an id from the URL.
- Public page queries select only portfolio fields. Client names and money never reach it.
- Login throttling: 5 failed attempts locks the email for 10 min. This is in-memory, so move it to Redis/Upstash if you run multiple instances.
- Pausing a client blocks login immediately. An existing session ends at next page load.
- Security headers (X-Frame-Options, nosniff, Referrer-Policy) are set in `next.config.mjs`.

## Deploy (Vercel + MongoDB Atlas)

1. Push to GitHub, import into Vercel, then add `MONGODB_URI` and `AUTH_SECRET` as env vars.
2. In Atlas → Network Access, allow `0.0.0.0/0` (Vercel IPs are dynamic) and use a strong DB user password.
3. Run `npm run seed` once locally against the production URI.

## Project map

```
src/
  app/            page.tsx (public) · login/ · portal/ · admin/{clients,projects,payments,settings}
  components/     site/ (hero orbit, work list, stack, contact) · admin/ · portal/ · ui.tsx · theme-toggle.tsx
  lib/            models/ · actions/ (server actions, zod-validated) · ledger.ts · summary.ts · currency.ts · rates.ts · auth.ts
  middleware.ts   route protection
scripts/seed.ts
```

## Good next steps

- Photo and cover uploads (Cloudinary or UploadThing) instead of pasting URLs
- Email the client automatically when a payment is recorded (Resend)
- PDF invoices per payment, and a “Pay now” Stripe link for pending balances
- Audit log of edits to payments
