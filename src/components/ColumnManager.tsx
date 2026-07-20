import { useState } from 'react';
import type { Schema, ColumnDef } from '../lib/types';
import { DEFAULT_SCHEMA } from '../lib/types';
import { Plus, Trash2, ArrowUp, ArrowDown, RotateCcw, X, Columns3, StickyNote } from 'lucide-react';

type Props = {
  schema: Schema;
  onChange: (schema: Schema) => void;
  onClose: () => void;
};

function genId(): string {
  return 'col_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

export function ColumnManager({ schema, onChange, onClose }: Props) {
  const [columns, setColumns] = useState<ColumnDef[]>(() => schema.columns.map((c) => ({ ...c })));
  const [noteEnabled, setNoteEnabled] = useState<boolean>(() => !!schema.noteEnabled);
  const [newLabel, setNewLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  function commit(next: ColumnDef[], nextNoteEnabled: boolean) {
    setColumns(next);
    setNoteEnabled(nextNoteEnabled);
    onChange({ columns: next, noteEnabled: nextNoteEnabled });
  }

  function handleAdd() {
    const label = newLabel.trim();
    if (!label) {
      setError('Column name cannot be empty.');
      return;
    }
    if (columns.some((c) => c.label.toLowerCase() === label.toLowerCase())) {
      setError('A column with this name already exists.');
      return;
    }
    commit([...columns, { id: genId(), label }], noteEnabled);
    setNewLabel('');
    setError(null);
  }

  function handleRename(id: string, label: string) {
    commit(columns.map((c) => (c.id === id ? { ...c, label } : c)), noteEnabled);
  }

  function handleDelete(id: string) {
    if (columns.length <= 1) {
      setError('At least one column is required.');
      return;
    }
    commit(columns.filter((c) => c.id !== id), noteEnabled);
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = columns.slice();
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    commit(next, noteEnabled);
  }

  function moveDown(idx: number) {
    if (idx === columns.length - 1) return;
    const next = columns.slice();
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    commit(next, noteEnabled);
  }

  function handleResetDefault() {
    commit(DEFAULT_SCHEMA.columns.map((c) => ({ ...c })), !!DEFAULT_SCHEMA.noteEnabled);
  }

  function toggleNote() {
    commit(columns, !noteEnabled);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Columns3 size={18} className="text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Manage Columns</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Define the expense categories for your tracker. These columns appear in the form, table, and charts. Your current structure is saved as the default.
          </p>

          <button
            type="button"
            onClick={toggleNote}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition ${
              noteEnabled
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <StickyNote size={16} className={noteEnabled ? 'text-blue-600' : 'text-gray-500'} />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Note field</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {noteEnabled ? 'Shown on entries' : 'Optional'}
              </span>
              <span
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                  noteEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                    noteEnabled ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </span>
            </span>
          </button>

          {columns.map((col, idx) => (
            <div key={col.id} className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
                  aria-label="Move up"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  onClick={() => moveDown(idx)}
                  disabled={idx === columns.length - 1}
                  className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
                  aria-label="Move down"
                >
                  <ArrowDown size={14} />
                </button>
              </div>
              <input
                type="text"
                value={col.label}
                onChange={(e) => handleRename(col.id, e.target.value)}
                className="input-base flex-1"
                placeholder="Column name"
              />
              <button
                onClick={() => handleDelete(col.id)}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-800 transition"
                aria-label="Delete column"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {/* Add new */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
              placeholder="New column name…"
              className="input-base flex-1"
            />
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-1 px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition"
            >
              <Plus size={16} /> Add
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center justify-between">
          <button
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            <RotateCcw size={14} /> Reset to Default
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
