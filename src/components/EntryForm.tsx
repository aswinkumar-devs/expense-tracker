import { useState } from 'react';
import type { ExpenseRow, Schema } from '../lib/types';
import { emptyRow, parseExpenseInput } from '../lib/calculator';
import { todayISO } from '../lib/utils';

type Props = {
  editing: ExpenseRow | null;
  existingDates: string[];
  schema: Schema;
  lastRow: ExpenseRow | null;
  onSubmit: (row: ExpenseRow) => 'saved' | 'updated' | 'duplicate';
  onReset: () => void;
};

export function EntryForm({ editing, schema, onSubmit, onReset }: Props) {
  const [row, setRow] = useState<ExpenseRow>(() => emptyRow(todayISO(), schema.columns[0]?.id || ''));
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = {
      ...row,
      id: editing?.id || row.id,
      columnId: row.columnId || schema.columns[0]?.id || '',
      amount: parseExpenseInput(amount),
      note: row.note?.trim() || undefined,
    };
    onSubmit(next);
  }

  return (
    <form
      onSubmit={submit}
      className="panel space-y-2"
    >
      <input
        type="date"
        value={row.date}
        onChange={(e) => setRow({ ...row, date: e.target.value })}
        className="input-base"
      />
      <select
        value={row.columnId}
        onChange={(e) => setRow({ ...row, columnId: e.target.value })}
        className="input-base"
      >
        {schema.columns
          .filter((c) => !c.hidden)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
      </select>
      <input
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="input-base"
        placeholder="Amount"
      />
      <input
        value={row.note || ''}
        onChange={(e) => setRow({ ...row, note: e.target.value })}
        className="input-base"
        placeholder="Note"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setRow(emptyRow(todayISO(), schema.columns[0]?.id || ''));
            setAmount('');
            onReset();
          }}
          className="settings-btn"
        >
          Reset
        </button>
        <button
          type="submit"
          className="settings-btn bg-blue-600 text-white justify-center"
        >
          Save
        </button>
      </div>
    </form>
  );
}
