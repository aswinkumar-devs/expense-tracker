import { useMemo } from 'react';
import type { ExpenseRow, Schema } from '../lib/types';
import { rowTotal, columnSum } from '../lib/calculator';
import { formatINR } from '../lib/utils';

type Props = {
  rows: ExpenseRow[];
  budget: number;
  monthLabel: string;
  schema: Schema;
};

export function ExpenseChart({ rows, budget, monthLabel, schema }: Props) {
  const maxDay = useMemo(() => {
    if (rows.length === 0) return 0;
    return Math.max(...rows.map(rowTotal), 1);
  }, [rows]);

  const colSums = useMemo(
    () => schema.columns.map((c) => ({ key: c.id, label: c.label, value: columnSum(rows, c.id) })),
    [rows, schema]
  );
  const totalCol = colSums.reduce((s, c) => s + c.value, 0) || 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Daily Expense — {monthLabel}</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No data yet.</p>
        ) : (
          <div className="flex items-end gap-1 h-40 overflow-x-auto">
            {rows.map((r) => {
              const h = (rowTotal(r) / maxDay) * 100;
              return (
                <div key={r.id} className="flex flex-col items-center gap-1 min-w-[24px] flex-1">
                  <div
                    className="w-full rounded-t-md bg-blue-500 hover:bg-blue-600 transition-all"
                    style={{ height: `${Math.max(h, 2)}%` }}
                    title={`${r.date}: ${formatINR(rowTotal(r))}`}
                  />
                  <span className="text-[9px] text-gray-400">{r.date.slice(8)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Route Breakdown</h3>
        {totalCol === 1 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No data yet.</p>
        ) : (
          <div className="space-y-2">
            {colSums.map((c) => {
              const pct = (c.value / totalCol) * 100;
              return (
                <div key={c.key}>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                    <span className="truncate pr-2">{c.label}</span>
                    <span className="font-medium">{formatINR(c.value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
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
