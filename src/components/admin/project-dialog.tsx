'use client';

import { FolderPlus, Pencil } from 'lucide-react';
import { useState } from 'react';
import { createProject, updateProject } from '@/lib/actions/projects';
import { CURRENCIES } from '@/lib/currency';
import { PROJECT_STATUSES, STATUS_LABEL, type ClientLite, type ProjectRow } from '@/lib/types';
import { toDateInput } from '@/lib/utils';
import { Button, Dialog, Field, Input, Select, Textarea, useActionForm } from '../ui';
import { Flag } from '../flags';
import { cn } from '@/lib/utils';

export function ProjectDialog({
  project,
  clients,
  defaultClientId,
}: {
  project?: ProjectRow;
  clients: ClientLite[];
  defaultClientId?: string;
}) {
  const [open, setOpen] = useState(false);
  const action = project ? updateProject.bind(null, project.id) : createProject;
  const { pending, onSubmit } = useActionForm(action, () => setOpen(false));
  const currencyLocked = !!project && project.payments.length > 0;

  return (
    <>
      {project ? (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`Edit ${project.name}`}>
          <Pencil /> Edit
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <FolderPlus /> New project
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={project ? `Edit ${project.name}` : 'New project'} wide>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Project name" className="sm:col-span-2">
            <Input name="name" defaultValue={project?.name} required />
          </Field>
          <Field label="Client">
            <Select name="clientId" defaultValue={project?.client?.id ?? defaultClientId ?? ''}>
              <option value="">No client (personal project)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.company ? ` (${c.company})` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={project?.status ?? 'in-progress'}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Total project cost">
            <Input name="totalCost" type="number" step="0.01" min="0" defaultValue={project?.totalCost ?? ''} required />
          </Field>
          <Field label="Billing currency" hint={currencyLocked ? 'Locked because payments are recorded.' : undefined}>
            {currencyLocked ? (
              <>
                <input type="hidden" name="currency" value={project!.currency} />
                <Select value={project!.currency} disabled>
                  <option>{project!.currency}</option>
                </Select>
              </>
            ) : (
              <Select name="currency" defaultValue={project?.currency ?? 'USD'}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Start date">
            <Input name="startDate" type="date" defaultValue={toDateInput(project?.startDate) || new Date().toISOString().slice(0, 10)} required />
          </Field>
          <Field label="Delivered on">
            <Input name="deliveredAt" type="date" defaultValue={toDateInput(project?.deliveredAt)} />
          </Field>
          <Field label="Tech stack" hint="Comma separated, e.g. Next.js, NestJS, MongoDB" className="sm:col-span-2">
            <Input name="stack" defaultValue={project?.stack.join(', ')} />
          </Field>
          <Field label="Summary" hint="Shown on your public site if this project is in the portfolio." className="sm:col-span-2">
            <Textarea name="summary" defaultValue={project?.summary} />
          </Field>
          <Field label="Live URL">
            <Input name="liveUrl" type="url" placeholder="https://" defaultValue={project?.liveUrl} />
          </Field>
          <Field label="Preview URL (Netlify, Vercel)">
            <Input name="previewUrl" type="url" placeholder="https://" defaultValue={project?.previewUrl} />
          </Field>
          <Field label="Repository URL">
            <Input name="repoUrl" type="url" placeholder="https://" defaultValue={project?.repoUrl} />
          </Field>
          <Field label="Cover image URL" hint="Appears on hover in your work list.">
            <Input name="coverImage" type="url" placeholder="https://" defaultValue={project?.coverImage} />
          </Field>
          <Field label="Outcome" hint="One line on the result, shown large on the case card. e.g. Cut checkout time by 40%" className="sm:col-span-2">
            <Input name="outcome" defaultValue={project?.outcome} maxLength={200} />
          </Field>
          <Field label="Gallery images" hint="Up to 4 image URLs, one per line. Shown beside the cover." className="sm:col-span-2">
            <Textarea name="gallery" defaultValue={project?.gallery.join('\n')} placeholder="https://" />
          </Field>
          <Field label="Client quote" hint="Optional testimonial shown on the case card." className="sm:col-span-2">
            <Textarea name="testimonialQuote" defaultValue={project?.testimonial.quote} />
          </Field>
          <Field label="Quote author">
            <Input name="testimonialAuthor" defaultValue={project?.testimonial.author} />
          </Field>
          <Field label="Author role">
            <Input name="testimonialRole" defaultValue={project?.testimonial.role} placeholder="Founder, Acme" />
          </Field>
          <Field label="Portfolio order" hint="Lower numbers show first.">
            <Input name="sortOrder" type="number" defaultValue={project?.sortOrder ?? 0} />
          </Field>
          <ProjectTranslations project={project} />
          <label className="flex items-center gap-3 self-end rounded-lg border border-line px-3 py-2.5 text-sm">
            <input type="checkbox" name="showInPortfolio" defaultChecked={project?.showInPortfolio} className="h-4 w-4 accent-[rgb(var(--accent))]" />
            Show on public portfolio
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={pending}>{project ? 'Save changes' : 'Create project'}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

const PT_FIELDS = [
  ['summary', 'Summary'],
  ['outcome', 'Outcome'],
  ['quote', 'Client quote'],
  ['role', 'Author role'],
] as const;

/** Optional: correct the automatic French, German and Spanish versions. Untouched fields re-translate when the English changes. */
function ProjectTranslations({ project }: { project?: ProjectRow }) {
  const [tab, setTab] = useState<'fr' | 'de' | 'es'>('fr');
  return (
    <details className="group rounded-xl border border-line p-3 sm:col-span-2">
      <summary className="cursor-pointer select-none text-sm font-semibold">Translations (automatic, editable)</summary>
      <p className="mt-2 text-xs text-muted">Filled in automatically when you save. Change anything here to override it.</p>
      <div className="mt-3 inline-flex rounded-full border border-line bg-bg p-1 text-xs font-semibold">
        {(['fr', 'de', 'es'] as const).map((l) => (
          <button key={l} type="button" onClick={() => setTab(l)} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1', tab === l ? 'bg-accent text-accent-ink' : 'text-muted')}>
            <span className="block h-3.5 w-3.5 overflow-hidden rounded-full">
              <Flag lang={l} className="h-full w-full" />
            </span>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      {(['fr', 'de', 'es'] as const).map((l) => (
        <div key={l} className={cn('mt-3 grid gap-3', tab !== l && 'hidden')}>
          {PT_FIELDS.map(([f, label]) => (
            <Field key={f} label={label}>
              {f === 'role' ? (
                <Input name={`tr_${l}_${f}`} defaultValue={project?.translations?.[l]?.[f] ?? ''} />
              ) : (
                <Textarea name={`tr_${l}_${f}`} defaultValue={project?.translations?.[l]?.[f] ?? ''} className="min-h-[64px]" />
              )}
            </Field>
          ))}
        </div>
      ))}
    </details>
  );
}
