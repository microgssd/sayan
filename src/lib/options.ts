import type { Currency } from './currency';
import type { ProjectRow } from './types';

export type ProjectOption = { id: string; name: string; clientName: string | null; currency: Currency; pending: number };

export const toOptions = (projects: ProjectRow[]): ProjectOption[] =>
  projects.map((p) => ({ id: p.id, name: p.name, clientName: p.client?.name ?? null, currency: p.currency, pending: p.pending }));
