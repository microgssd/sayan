'use client';

import { Pencil, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { createClient, updateClient } from '@/lib/actions/clients';
import { CURRENCIES, CURRENCY_META } from '@/lib/currency';
import type { ClientRow } from '@/lib/types';
import { Button, Dialog, Field, Input, Select, Textarea, useActionForm } from '../ui';

export function ClientDialog({ client }: { client?: ClientRow }) {
  const [open, setOpen] = useState(false);
  const action = client ? updateClient.bind(null, client.id) : createClient;
  const { pending, onSubmit } = useActionForm(action, () => setOpen(false));

  return (
    <>
      {client ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil /> Edit
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <UserPlus /> Add client
        </Button>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={client ? `Edit ${client.name}` : 'Add client'}
        description={client ? undefined : 'They’ll log in with this email and password to see their payments.'}
        wide
      >
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <Input name="name" defaultValue={client?.name} required />
          </Field>
          <Field label="Company">
            <Input name="company" defaultValue={client?.company} />
          </Field>
          <Field label="Email (login)">
            <Input name="email" type="email" defaultValue={client?.email} required />
          </Field>
          <Field label="Phone">
            <Input name="phone" defaultValue={client?.phone} />
          </Field>
          <Field label="Preferred currency" hint="Their portal opens in this currency.">
            <Select name="preferredCurrency" defaultValue={client?.preferredCurrency ?? 'USD'}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}, {CURRENCY_META[c].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={client ? 'New password' : 'Password'} hint={client ? 'Leave blank to keep the current password.' : 'At least 8 characters.'}>
            <Input name="password" type="text" autoComplete="new-password" minLength={client ? undefined : 8} required={!client} />
          </Field>
          <Field label="Private notes" hint="Only you can see these." className="sm:col-span-2">
            <Textarea name="notes" defaultValue={client?.notes} />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={pending}>{client ? 'Save changes' : 'Add client'}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
