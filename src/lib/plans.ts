import { connectDB } from './db';
import { Plan } from './models/Plan';
import { Project } from './models/Project';
import { planRow } from './subscriptions';
import type { PlanRow } from './types';

export type BillingOptions = { plans: PlanRow[]; projects: { id: string; name: string; clientId: string }[] };

/** Active plans and each client's projects, for the subscription form. */
export async function loadBillingOptions(): Promise<BillingOptions> {
  await connectDB();
  const [plans, projects]: [any[], any[]] = await Promise.all([
    Plan.find({ active: true }).sort({ sortOrder: 1, createdAt: 1 }).lean(),
    Project.find({ client: { $ne: null } }).select('name client').sort({ name: 1 }).lean(),
  ]);
  return { plans: plans.map(planRow), projects: projects.map((p) => ({ id: String(p._id), name: p.name, clientId: String(p.client) })) };
}
