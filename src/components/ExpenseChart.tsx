import { useMemo } from 'react';
import type { ExpenseRow, Schema } from '../lib/types';
import { rowTotal, columnSum, monthlyTotal } from '../lib/calculator';
import { formatINR, todayISO } from '../lib/utils';

type Props = {
  rows: ExpenseRow[];
  budget: number;
  monthLabel: string;
  schema: Schema;
};

export function ExpenseChart({ rows, budget, monthLabel, schema }: Props) {
  const total = useMemo(() => monthlyTotal(rows), [rows]);

  const daily = useMemo(
    () => rows.map((r) => ({ date: r.date, total: rowTotal(r) })),
    [rows]
  );

  const maxDay = useMemo(() => (daily.length ? Math.max(...daily.map((d) => d.total), 1) : 0), [daily]);
  const avg = rows.length ? total / rows.length : 0;
  const today = todayISO();

  const colSums = useMemo(
    () =>
      schema.columns
        .map((c) => ({ key: c.id, label: c.label, value: columnSum(rows, c.id) }))
        .filter((c) => c.value > 0),
    [rows, schema]
  );
  const totalCol = colSums.reduce((s, c) => s + c.value, 0) || 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Daily expense bars */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Daily Expense — {monthLabel}</h3>
          <span className="text-xs text-gray-400">
            {rows.length} day{rows.length === 1 ? '' : 's'}
          </span>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400 py-10 text-center">No data yet. Add an entry to see the chart.</p>
        ) : (
          <>
            <div className="h-44 flex items-end gap-1.5 overflow-x-auto pb-1">
              {daily.map((d) => {
                const h = (d.total / maxDay) * 100;
                const isToday = d.date === today;
                return (
                  <div key={d.date} className="flex flex-col items-center gap-1 min-w-[28px] flex-1">
                    <span className="text-[9px] text-gray-400 whitespace-nowrap">{formatINR(d.total)}</span>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          isToday ? 'bg-amber-500' : 'bg-blue-500 hover:bg-blue-600'
                        }`}
                        style={{ height: `${Math.max(h, 3)}%` }}
                        title={`${d.date}: ${formatINR(d.total)}`}
                      />
                    </div>
                    <span className={`text-[9px] whitespace-nowrap ${isToday ? 'text-amber-600 font-bold' : 'text-gray-400'}`}>
                      {d.date.slice(8)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-gray-400 text-center">
              Highest {formatINR(maxDay)} · Avg {formatINR(avg)} per day
            </p>
          </>
        )}
      </div>

      {/* Route / category breakdown */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Route Breakdown</h3>
        {colSums.length === 0 ? (
          <p className="text-sm text-gray-400 py-10 text-center">No data yet.</p>
        ) : (
          <div className="space-y-2.5">
            {colSums.map((c) => {
              const pct = (c.value / totalCol) * 100;
              return (
                <div key={c.key}>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                    <span className="truncate pr-2">{c.label}</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 shrink-0">
                      {formatINR(c.value)} · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between text-xs">
          <span className="text-gray-500">Budget</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{formatINR(budget)}</span>
        </div>
      </div>
    </div>
  );
}
