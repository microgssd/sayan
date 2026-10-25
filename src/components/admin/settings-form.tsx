'use client';

import { changeAdminPassword, updateSettings } from '@/lib/actions/settings';
import type { SiteSettings } from '@/lib/types';
import { initials } from '@/lib/utils';
import { useState } from 'react';
import { Flag } from '../flags';
import { DEFAULT_SETTINGS, DEFAULT_TRANSLATIONS } from '@/lib/defaults';
import { cn } from '@/lib/utils';
import { ActionButton, Button, Field, Input, Select, Textarea, useActionForm } from '../ui';
import { translateEverything } from '@/lib/actions/translate';
import { Languages } from 'lucide-react';
import { KAWAII, KAWAII_LABEL, Kawaii, isKawaii, type KawaiiName } from '../kawaii';

export function SettingsForm({ settings, autoTranslate }: { settings: SiteSettings; autoTranslate: 'deepl' | 'claude' | null }) {
  const { pending, onSubmit } = useActionForm(updateSettings);
  const [photo, setPhoto] = useState(settings.photoUrl);
  const stacksText = settings.stacks.map((g) => `${g.category}: ${g.items.join(', ')}`).join('\n');

  return (
    <form onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
      <section className="grid content-start gap-4 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-display text-base font-semibold">Profile</h2>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-line bg-surface-2">
            {photo ? (
              <img src={photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center font-display font-bold text-accent-fg">{initials(settings.name)}</span>
            )}
          </div>
          <Field label="Photo URL" hint="Square image works best. Host it on Cloudinary, GitHub or your CDN." className="flex-1">
            <Input name="photoUrl" type="url" value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="https://" />
          </Field>
        </div>
        <Field label="Display name">
          <Input name="name" defaultValue={settings.name} required />
        </Field>
        <Field label="Hero sentence" hint="Write [1], [2], [3] where you want screenshots of your first, second and third portfolio projects to appear as pills.">
          <Textarea name="heroTitle" defaultValue={settings.heroTitle} className="min-h-[96px]" />
        </Field>
        <PillPickers initial={settings.heroPills} />
        <Field label="Years of experience" hint="Shown as a stat in the hero. Use 0 to hide it.">
          <Input name="yearsExperience" type="number" min={0} max={60} defaultValue={settings.yearsExperience} />
        </Field>
        <Field label="Intro paragraph" hint="Shown under the hero title.">
          <Textarea name="headline" defaultValue={settings.headline} />
        </Field>
        <Field label="About statement" hint="Lights up word by word as visitors scroll.">
          <Textarea name="bio" defaultValue={settings.bio} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact email">
            <Input name="email" type="email" defaultValue={settings.email} required />
          </Field>
          <Field label="Location">
            <Input name="location" defaultValue={settings.location} />
          </Field>
          <Field label="Your time zone" hint="Shown beside the visitor’s local time in the footer." className="sm:col-span-2">
            <Input name="timezone" defaultValue={settings.timezone} placeholder="Asia/Kolkata" />
          </Field>
        </div>
        <Field label="Availability line" hint="Leave empty to hide the status dot.">
          <Input name="availability" defaultValue={settings.availability} />
        </Field>
      </section>

      <section className="grid content-start gap-4 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-display text-base font-semibold">Links</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['github', 'linkedin', 'x', 'website'] as const).map((k) => (
            <Field key={k} label={k === 'x' ? 'X (Twitter)' : k[0]!.toUpperCase() + k.slice(1)}>
              <Input name={k} type="url" defaultValue={settings.socials[k]} placeholder="https://" />
            </Field>
          ))}
          <Field label="Résumé URL" className="sm:col-span-2">
            <Input name="resumeUrl" type="url" defaultValue={settings.resumeUrl} placeholder="https://" />
          </Field>
        </div>
        <h2 className="mt-2 font-display text-base font-semibold">Image gallery</h2>
        <Field label="Extra gallery images" hint="One image link per line. Your projects’ cover and gallery images are included automatically; add any others here.">
          <Textarea name="galleryImages" defaultValue={settings.galleryImages.join('\n')} placeholder="https://…" className="min-h-[96px] font-mono text-xs" />
        </Field>
        <h2 className="mt-2 font-display text-base font-semibold">Tech stack</h2>
        <Field label="One category per line" hint="Format: Category: item, item, item. Every item scrolls, with its logo, under your hero.">
          <Textarea name="stacks" defaultValue={stacksText} className="min-h-[220px] font-mono text-xs leading-6" />
        </Field>
        <div className="flex justify-end">
          <Button loading={pending}>Save site settings</Button>
        </div>
      </section>

      <Translations settings={settings} autoTranslate={autoTranslate} />
    </form>
  );
}

export function PasswordForm() {
  const { pending, onSubmit } = useActionForm(changeAdminPassword);
  return (
    <form
      onSubmit={(e) => {
        onSubmit(e);
        e.currentTarget.reset();
      }}
      className="mt-6 grid max-w-xl gap-4 rounded-2xl border border-line bg-surface p-6 sm:grid-cols-2"
    >
      <h2 className="font-display text-base font-semibold sm:col-span-2">Your admin password</h2>
      <Field label="Current password">
        <Input name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" hint="At least 10 characters.">
        <Input name="next" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <div className="sm:col-span-2">
        <Button variant="outline" loading={pending}>
          Change password
        </Button>
      </div>
    </form>
  );
}

const TR_LANGS = [
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['es', 'Español'],
] as const;
const TR_FIELDS = [
  ['heroTitle', 'Hero sentence', 'Keep the [1], [2], [3] markers where the project pills go.'],
  ['headline', 'Intro paragraph', ''],
  ['bio', 'About statement', ''],
  ['availability', 'Availability line', ''],
  ['location', 'Location', ''],
] as const;

/** French, German and Spanish versions of your own text. Blank fields fall back to English. */
function Translations({ settings, autoTranslate }: { settings: SiteSettings; autoTranslate: 'deepl' | 'claude' | null }) {
  const [tab, setTab] = useState<'fr' | 'de' | 'es'>('fr');
  return (
    <section className="grid content-start gap-4 rounded-2xl border border-line bg-surface p-6 xl:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">Translations</h2>
          <p className="mt-1 text-sm text-muted">
            {autoTranslate
              ? `Automatic translation is on (${autoTranslate === 'deepl' ? 'DeepL' : 'Claude'}). Your English is translated whenever you save; edit any field below to correct it.`
              : 'Automatic translation is off. Add DEEPL_API_KEY (free at deepl.com/pro-api) or ANTHROPIC_API_KEY to your environment, or type translations below.'}
          </p>
          {autoTranslate && (
            <div className="mt-3">
              <ActionButton type="button" variant="outline" size="sm" action={translateEverything}>
                <Languages /> Translate everything now
              </ActionButton>
            </div>
          )}
        </div>
        <div className="inline-flex rounded-full border border-line bg-bg p-1 text-sm font-semibold">
          {TR_LANGS.map(([l, label]) => (
            <button key={l} type="button" onClick={() => setTab(l)} className={cn('flex items-center gap-2 rounded-full px-3 py-1.5', tab === l ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink')}>
              <span className="block h-4 w-4 overflow-hidden rounded-full">
                <Flag lang={l} className="h-full w-full" />
              </span>
              {label}
            </button>
          ))}
        </div>
      </div>
      {TR_LANGS.map(([l]) => (
        <div key={l} className={cn('grid gap-4 sm:grid-cols-2', tab !== l && 'hidden')}>
          {TR_FIELDS.map(([f, label, hint]) => {
            const isDefault = settings[f] === DEFAULT_SETTINGS[f];
            const Ctl = f === 'availability' || f === 'location' ? Input : Textarea;
            return (
              <Field key={f} label={label} hint={hint || (isDefault ? 'Blank uses a ready-made translation of the default text.' : undefined)} className={f === 'availability' || f === 'location' ? '' : 'sm:col-span-2'}>
                <Ctl
                  name={`tr_${l}_${f}`}
                  defaultValue={settings.translations?.[l]?.[f] ?? ''}
                  placeholder={isDefault ? DEFAULT_TRANSLATIONS[l][f] : settings[f]}
                />
              </Field>
            );
          })}
        </div>
      ))}
    </section>
  );
}

/** Pick a kawaii character for each [1] [2] [3] pill, with a live preview. */
function PillPickers({ initial }: { initial: string[] }) {
  const [pills, setPills] = useState<KawaiiName[]>([0, 1, 2].map((i) => (isKawaii(initial[i]) ? initial[i] : (['rocket', 'bag', 'robot'] as const)[i]!)));
  return (
    <div className="grid gap-2">
      <span className="text-xs font-semibold text-muted">Pill characters</span>
      <div className="grid gap-2">
        {pills.map((p, i) => (
          <label key={i} className="flex items-center gap-3 rounded-xl border border-line p-2.5">
            <span className="flex shrink-0 items-center gap-2">
              <span className="w-10 text-[11px] font-semibold text-muted">[{i + 1}]</span>
              <span className="relative block h-8 w-[4.25rem] shrink-0 overflow-hidden rounded-full bg-[linear-gradient(135deg,#2B1B4F,#4C1D95)] ring-1 ring-[#C084FC]/40">
                <Kawaii name={p} className="absolute inset-0 h-full w-full" />
              </span>
            </span>
            <Select name={`heroPill${i + 1}`} value={p} onChange={(e) => setPills((cur) => cur.map((c, k) => (k === i ? (e.target.value as KawaiiName) : c)))} className="h-9 min-w-0 flex-1 text-sm">
              {KAWAII.map((k) => (
                <option key={k} value={k}>
                  {KAWAII_LABEL[k]}
                </option>
              ))}
            </Select>
          </label>
        ))}
      </div>
    </div>
  );
}
