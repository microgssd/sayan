import { NUMBER_KEYS, type NumberKey, type PortfolioStats, type SiteSettings } from './types';

export type ResolvedNumber = { value: number; label: string; suffix: string; auto: number; manual: boolean };

/** Your number if you set one, otherwise the automatic count from your admin data. */
export function resolveNumbers(n: SiteSettings['numbers'], stats: PortfolioStats): Record<NumberKey, ResolvedNumber> {
  const auto: Record<NumberKey, number> = {
    heroClients: stats.activeClients,
    heroProjects: stats.activeProjects,
    years: stats.years,
    projects: stats.shipped,
    clients: stats.clients,
  };
  return Object.fromEntries(
    NUMBER_KEYS.map((k) => [k, { value: n[k].value ?? auto[k], label: n[k].label, suffix: n[k].suffix, auto: auto[k], manual: n[k].value !== null }]),
  ) as Record<NumberKey, ResolvedNumber>;
}
