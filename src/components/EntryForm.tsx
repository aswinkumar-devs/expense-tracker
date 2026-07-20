import { useEffect, useRef, useState } from 'react';
import type { ExpenseRow, Schema } from '../lib/types';
import { emptyRow, parseExpenseInput, rowTotal } from '../lib/calculator';
import { todayISO, formatINR } from '../lib/utils';

type Props = {
  editing: ExpenseRow | null;
  existingDates: string[];
  schema: Schema;
  onSubmit: (row: ExpenseRow) => 'saved' | 'updated' | 'duplicate';
  onReset: () => void;
};

export function EntryForm({ editing, existingDates, schema, onSubmit, onReset }: Props) {
  const [row, setRow] = useState<ExpenseRow>(() => emptyRow(todayISO(), schema));
  const [error, setError] = useState<string | null>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setRow(editing);
  }, [editing]);

  function setField(columnId: string, value: string) {
    setRow((r) => ({ ...r, values: { ...r.values, [columnId]: parseExpenseInput(value) } }));
  }

  function setNote(value: string) {
    setRow((r) => ({ ...r, note: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!row.date) {
      setError('Please pick a date.');
      return;
    }
    const dup = existingDates.includes(row.date) && (!editing || editing.date !== row.date);
    if (dup) {
      setError('Entry already exists for this date. Edit that row instead.');
      return;
    }
    const result = onSubmit(row);
    if (result === 'saved' || result === 'updated') {
      if (!editing) setRow(emptyRow(todayISO(), schema));
      dateRef.current?.focus();
    }
  }

  function handleReset() {
    setRow(emptyRow(editing ? editing.date : todayISO(), schema));
    setError(null);
    onReset();
  }

  const total = rowTotal(row);

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {editing ? 'Edit Entry' : 'Add New Entry'}
        </h2>
        <span className="text-xs text-gray-400">Tab to move · Enter to submit</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <label className="col-span-2 sm:col-span-1 flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Date</span>
          <input
            ref={dateRef}
            type="date"
            value={row.date}
            onChange={(e) => setRow((r) => ({ ...r, date: e.target.value }))}
            className="input-base"
            required
          />
        </label>
        {schema.columns.map((col) => (
          <label key={col.id} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate" title={col.label}>
              {col.label}
            </span>
            <input
              type="number"
              min={0}
              inputMode="decimal"
              step="any"
              value={row.values[col.id] === 0 ? '' : row.values[col.id]}
              placeholder="0"
              onChange={(e) => setField(col.id, e.target.value)}
              className="input-base"
            />
          </label>
        ))}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Total</span>
          <div className="input-base bg-blue-50 dark:bg-gray-800 font-semibold text-blue-700 dark:text-blue-300">
            {formatINR(total)}
          </div>
        </label>
      </div>

      {schema.noteEnabled && (
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Note</span>
          <textarea
            value={row.note ?? ''}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was this amount spent on? (optional)"
            rows={2}
            className="input-base resize-y"
          />
        </label>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-col-reverse sm:flex-row gap-2 justify-end">
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          Reset Form
        </button>
        <button
          type="submit"
          className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition"
        >
          {editing ? 'Update' : 'Submit'}
        </button>
      </div>
    </form>
  );
}
