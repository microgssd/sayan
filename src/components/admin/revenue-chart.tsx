'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { convert, formatMoney } from '@/lib/currency';
import type { MonthBucket } from '@/lib/summary';
import { useCurrency } from '../currency-context';

export function RevenueChart({ data }: { data: MonthBucket[] }) {
  const { currency, rates } = useCurrency();
  const rows = data.map((d) => ({ ...d, value: Math.round(convert(d.usd, 'USD', currency, rates)) }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={1} />
              <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0.45} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeDasharray="3 6" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }} />
          <YAxis
            width={64}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }}
            tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })}
          />
          <Tooltip
            cursor={{ fill: 'rgb(var(--accent) / 0.08)' }}
            contentStyle={{
              background: 'rgb(var(--surface))',
              border: '1px solid rgb(var(--line))',
              borderRadius: 12,
              color: 'rgb(var(--ink))',
              fontSize: 13,
            }}
            formatter={(v: number) => [formatMoney(v, currency), 'Received']}
          />
          <Bar dataKey="value" radius={[8, 8, 2, 2]} maxBarSize={42} animationDuration={900}>
            {rows.map((r, i) => (
              <Cell key={r.key} fill={i === rows.length - 1 ? 'rgb(var(--brass))' : 'url(#rev)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
