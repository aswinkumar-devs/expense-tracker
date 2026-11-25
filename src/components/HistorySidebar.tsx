import { useMemo } from 'react';
import type { Store } from '../lib/types';
import { monthlyTotal } from '../lib/calculator';
import { formatMonthLabel, formatINR } from '../lib/utils';
import { History as HistoryIcon, X, Trash2 } from 'lucide-react';

type Props = {
  store: Store;
  activeKey: string;
  onSelect: (key: string) => void;
  onDeleteMonth: (key: string) => void;
  open: boolean;
  onClose: () => void;
};

export function HistorySidebar({ store, activeKey, onSelect, onDeleteMonth, open, onClose }: Props) {
  const months = useMemo(() => Object.keys(store.months).sort((a, b) => b.localeCompare(a)), [store]);

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed lg:static top-0 right-0 z-40 h-full lg:h-auto w-72 max-w-[80vw] bg-white dark:bg-gray-900 border-l lg:border-l-0 lg:border-r border-gray-200 dark:border-gray-800 p-4 transform transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <HistoryIcon size={16} /> Month History
          </h3>
          <button onClick={onClose} className="lg:hidden p-1 rounded-md text-gray-400 hover:bg-gray-100" aria-label="Close history">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-1 max-h-[70vh] overflow-y-auto">
          {months.map((k) => {
            const active = k === activeKey;
            const isCurrent = k === store.activeMonthKey;
            const data = store.months[k];
            const total = data ? monthlyTotal(data.rows) : 0;
            return (
              <div
                key={k}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition flex justify-between items-center gap-2 ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <button onClick={() => onSelect(k)} className="flex-1 min-w-0 text-left">
                  <span className="block truncate">{formatMonthLabel(k)}</span>
                  <span className="block text-xs font-normal text-gray-400">
                    {data ? `${data.rows.length} entries · ${formatINR(total)}` : 'No entries'}
                  </span>
                </button>
                {!isCurrent && (
                  <button
                    onClick={() => onDeleteMonth(k)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-800 transition shrink-0"
                    aria-label={`Delete ${formatMonthLabel(k)}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
          {months.length === 0 && <p className="text-sm text-gray-400">No history yet.</p>}
        </div>
      </aside>
    </>
  );
}
