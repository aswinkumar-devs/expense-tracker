import { useState } from 'react';
import { formatINR } from '../lib/utils';
import { Pencil, Check } from 'lucide-react';

type Props = {
  budget: number;
  spent: number;
  onSave: (v: number) => void;
};

export function BudgetField({ budget, spent, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(budget));
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const over = spent > budget;

  function commit() {
    const n = Number(val);
    if (Number.isFinite(n) && n >= 0) onSave(n);
    else setVal(String(budget));
    setEditing(false);
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Monthly Budget</p>
          {editing ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gray-400">₹</span>
              <input
                autoFocus
                type="number"
                min={0}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && commit()}
                className="w-28 text-xl font-bold text-gray-900 dark:text-gray-100 bg-transparent border-b-2 border-blue-500 focus:outline-none"
              />
            </div>
          ) : (
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">{formatINR(budget)}</p>
          )}
        </div>
        <button
          onClick={editing ? commit : () => { setVal(String(budget)); setEditing(true); }}
          className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-800 transition"
          aria-label={editing ? 'Save budget' : 'Edit budget'}
        >
          {editing ? <Check size={18} /> : <Pencil size={16} />}
        </button>
      </div>

      <div className="mt-3">
        <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs">
          <span className={over ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'}>
            {formatINR(spent)} spent ({pct.toFixed(0)}%)
          </span>
          <span className="text-gray-400">
            {over ? `${formatINR(spent - budget)} over` : `${formatINR(budget - spent)} left`}
          </span>
        </div>
      </div>
    </div>
  );
}
