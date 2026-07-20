import { formatINR } from '../lib/utils';
import { Wallet, CalendarDays, TrendingUp, PiggyBank } from 'lucide-react';
import type { ReactNode } from 'react';

type CardProps = {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: 'default' | 'green' | 'red';
  sub?: string;
};

function Card({ label, value, icon, tone = 'default', sub }: CardProps) {
  const toneClass =
    tone === 'green'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'red'
      ? 'text-red-600 dark:text-red-400'
      : 'text-gray-900 dark:text-gray-100';
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
        <span className="text-gray-300 dark:text-gray-700">{icon}</span>
      </div>
      <span className={`text-2xl font-bold tracking-tight ${toneClass}`}>{value}</span>
      {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
    </div>
  );
}

type Props = {
  monthlyTotal: number;
  today: number;
  average: number;
  remaining: number;
  budget: number;
};

export function SummaryCards({ monthlyTotal, today, average, remaining, budget }: Props) {
  const over = remaining < 0;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card label="Monthly Total" value={formatINR(monthlyTotal)} icon={<Wallet size={18} />} />
      <Card label="Today's Expense" value={formatINR(today)} icon={<CalendarDays size={18} />} />
      <Card label="Avg Daily" value={formatINR(average)} icon={<TrendingUp size={18} />} sub="per entry day" />
      <Card
        label="Remaining Budget"
        value={formatINR(Math.abs(remaining))}
        icon={<PiggyBank size={18} />}
        tone={over ? 'red' : 'green'}
        sub={over ? `Over budget by ${formatINR(Math.abs(remaining))}` : `of ${formatINR(budget)}`}
      />
    </div>
  );
}
