import type { ExpenseRow, Schema } from '../lib/types';
import { rowTotal, columnSum } from '../lib/calculator';
import { formatDateShort, formatINR } from '../lib/utils';
import { Pencil, Trash2, StickyNote } from 'lucide-react';

type Props = {
  rows: ExpenseRow[];
  schema: Schema;
  onEdit: (row: ExpenseRow) => void;
  onDelete: (row: ExpenseRow) => void;
};

export function ExpenseTable({ rows, schema, onEdit, onDelete }: Props) {
  if (rows.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-10 text-center">
        <p className="text-sm text-gray-400">No entries yet. Add your first expense above.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop / tablet: scrollable table */}
      <div className="hidden sm:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">
                <th className="px-3 py-3 text-left font-semibold sticky left-0 bg-gray-50 dark:bg-gray-800/60">Date</th>
                {schema.columns.map((col) => (
                  <th key={col.id} className="px-3 py-3 text-right font-semibold whitespace-nowrap" title={col.label}>
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-right font-semibold">Total</th>
                {schema.noteEnabled && <th className="px-3 py-3 text-left font-semibold">Note</th>}
                <th className="px-3 py-3 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-gray-100 dark:border-gray-800 hover:bg-blue-50/40 dark:hover:bg-gray-800/40 transition"
                >
                  <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-900">
                    {formatDateShort(r.date)}
                  </td>
                  {schema.columns.map((col) => (
                    <td key={col.id} className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300">
                      {r.values[col.id] ? formatINR(r.values[col.id]) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right font-semibold text-blue-700 dark:text-blue-300">
                    {formatINR(rowTotal(r))}
                  </td>
                  {schema.noteEnabled && (
                    <td className="px-3 py-2.5 text-left text-gray-600 dark:text-gray-400 max-w-[16rem]">
                      {r.note ? (
                        <span className="inline-flex items-start gap-1 align-top">
                          <StickyNote size={13} className="mt-0.5 shrink-0 text-amber-500" />
                          <span className="break-words whitespace-pre-wrap">{r.note}</span>
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onEdit(r)}
                        className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-800 transition"
                        aria-label="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => onDelete(r)}
                        className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-800 transition"
                        aria-label="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 dark:bg-gray-800/60 font-semibold text-gray-900 dark:text-gray-100">
                <td className="px-3 py-3 sticky left-0 bg-gray-50 dark:bg-gray-800/60">Total</td>
                {schema.columns.map((col) => (
                  <td key={col.id} className="px-3 py-3 text-right">{formatINR(columnSum(rows, col.id))}</td>
                ))}
                <td className="px-3 py-3 text-right text-blue-700 dark:text-blue-300">{formatINR(rows.reduce((s, r) => s + rowTotal(r), 0))}</td>
                {schema.noteEnabled && <td />}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="sm:hidden space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatDateShort(r.date)}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEdit(r)}
                  className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition"
                  aria-label="Edit"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => onDelete(r)}
                  className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition"
                  aria-label="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {schema.columns.map((col) => (
                <div key={col.id} className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 truncate pr-1" title={col.label}>{col.label}</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{r.values[col.id] ? formatINR(r.values[col.id]) : '—'}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <span className="text-xs text-gray-500">Total</span>
              <span className="text-base font-bold text-blue-700 dark:text-blue-300">{formatINR(rowTotal(r))}</span>
            </div>
            {schema.noteEnabled && r.note && (
              <div className="mt-2 flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <StickyNote size={13} className="mt-0.5 shrink-0 text-amber-500" />
                <span className="break-words whitespace-pre-wrap">{r.note}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
