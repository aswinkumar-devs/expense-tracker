import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExpenseRow, Store } from './lib/types';
import { loadStore, saveStore, archiveCurrentMonth, loadMonthFromHistory, upsertRow, deleteRow, setBudget, updateSchema } from './lib/storage';
import { monthlyTotal, todaysExpense, averageDaily, remainingBudget } from './lib/calculator';
import { todayISO, formatMonthLabel } from './lib/utils';
import { exportMonthCSV } from './lib/csv';
import { ToastProvider, useToast } from './components/Toast';
import { ConfirmDialog } from './components/ConfirmDialog';
import { SummaryCards } from './components/SummaryCards';
import { BudgetField } from './components/BudgetField';
import { EntryForm } from './components/EntryForm';
import { ExpenseTable } from './components/ExpenseTable';
import { HistorySidebar } from './components/HistorySidebar';
import { ExpenseChart } from './components/ExpenseChart';
import { Plus, Download, RotateCcw, Search, Moon, Sun, Menu, Columns3 } from 'lucide-react';
import { ColumnManager } from './components/ColumnManager';

function Tracker() {
  const { notify } = useToast();
  const [store, setStore] = useState<Store>(() => loadStore());
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<null | 'reset' | 'delete'>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRow | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('bet-dark');
    return saved === '1';
  });

  const month = store.currentMonth;

  useEffect(() => {
    saveStore(store);
  }, [store]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('bet-dark', dark ? '1' : '0');
  }, [dark]);

  const today = todayISO();
  const mTotal = useMemo(() => monthlyTotal(month.rows), [month.rows]);
  const todayExp = useMemo(() => todaysExpense(month.rows, today), [month.rows, today]);
  const avg = useMemo(() => averageDaily(month.rows), [month.rows]);
  const remaining = useMemo(() => remainingBudget(month.budget, month.rows), [month.budget, month.rows]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return month.rows;
    return month.rows.filter((r) => r.date.includes(search.trim()));
  }, [month.rows, search]);

  const existingDates = month.rows.map((r) => r.date);

  function handleSubmit(row: ExpenseRow): 'saved' | 'updated' | 'duplicate' {
    const isEdit = month.rows.some((r) => r.id === row.id);
    setStore((s) => upsertRow(s, row));
    if (isEdit) {
      notify('Updated successfully');
      setEditing(null);
      return 'updated';
    }
    notify('Saved successfully');
    return 'saved';
  }

  function handleEdit(row: ExpenseRow) {
    setEditing(row);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function requestDelete(row: ExpenseRow) {
    setDeleteTarget(row);
    setConfirm('delete');
  }

  function confirmDelete() {
    if (deleteTarget) {
      setStore((s) => deleteRow(s, deleteTarget.id));
      notify('Deleted', 'info');
      if (editing?.id === deleteTarget.id) setEditing(null);
    }
    setDeleteTarget(null);
    setConfirm(null);
  }

  function handleResetMonth() {
    setConfirm('reset');
  }

  function confirmResetMonth() {
    setStore((s) => archiveCurrentMonth(s));
    setEditing(null);
    setSearch('');
    setConfirm(null);
    notify('Month archived', 'info');
  }

  function handleSelectMonth(key: string) {
    if (key === store.currentMonth.monthKey) {
      setHistoryOpen(false);
      return;
    }
    setStore((s) => loadMonthFromHistory(s, key));
    setEditing(null);
    setSearch('');
    setHistoryOpen(false);
    notify(`Loaded ${formatMonthLabel(key)}`, 'info');
  }

  function handleExport() {
    if (month.rows.length === 0) {
      notify('No entries to export', 'error');
      return;
    }
    exportMonthCSV(month, store.schema);
    notify('CSV exported', 'info');
  }

  function handleAddEntry() {
    setEditing(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/icons/icon-96.png" alt="Expense Tracker" className="w-9 h-9 rounded-xl shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold leading-tight truncate">Monthly Expense Tracker</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatMonthLabel(month.monthKey)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setHistoryOpen(true)}
              className="lg:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              aria-label="History"
            >
              <Menu size={20} />
            </button>
            <button
              onClick={() => setDark((d) => !d)}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              aria-label="Toggle dark mode"
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex gap-6">
        {/* Sidebar (desktop) */}
        <div className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-20">
            <HistorySidebar
              store={store}
              activeKey={month.monthKey}
              onSelect={handleSelectMonth}
              open
              onClose={() => {}}
            />
          </div>
        </div>

        {/* Main */}
        <main className="flex-1 min-w-0 space-y-5">
          {/* Top action buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleAddEntry}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition"
            >
              <Plus size={16} /> Add Entry
            </button>
            <button
              onClick={() => setColumnsOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              <Columns3 size={16} /> Manage Columns
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              <Download size={16} /> Export CSV
            </button>
            <button
              onClick={handleResetMonth}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-gray-800 transition"
            >
              <RotateCcw size={16} /> Reset Current Month
            </button>
          </div>

          {/* Summary */}
          <SummaryCards
            monthlyTotal={mTotal}
            today={todayExp}
            average={avg}
            remaining={remaining}
            budget={month.budget}
          />

          {/* Budget */}
          <BudgetField budget={month.budget} onSave={(v) => { setStore((s) => setBudget(s, v)); notify('Budget updated'); }} />

          {/* Form */}
          <div ref={formRef}>
          <EntryForm
            editing={editing}
            existingDates={existingDates}
            schema={store.schema}
            onSubmit={handleSubmit}
            onReset={() => setEditing(null)}
          />
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by date (e.g. 2026-07-12)"
              className="input-base pl-9 max-w-sm"
            />
          </div>

          {/* Table / cards */}
          <ExpenseTable rows={filteredRows} schema={store.schema} onEdit={handleEdit} onDelete={requestDelete} />

          {/* Charts */}
          <ExpenseChart rows={month.rows} budget={month.budget} monthLabel={formatMonthLabel(month.monthKey)} schema={store.schema} />

          <footer className="text-center text-xs text-gray-400 py-6">
            Data stored locally in your browser · {month.rows.length} entries this month
          </footer>
        </main>
      </div>

      {/* Mobile history drawer */}
      <HistorySidebar
        store={store}
        activeKey={month.monthKey}
        onSelect={handleSelectMonth}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete Entry?"
        message={`Delete the entry for ${deleteTarget?.date}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => { setConfirm(null); setDeleteTarget(null); }}
      />
      {columnsOpen && (
        <ColumnManager
          schema={store.schema}
          onChange={(s) => { setStore((prev) => updateSchema(prev, s)); notify('Columns updated'); }}
          onClose={() => setColumnsOpen(false)}
        />
      )}

      <ConfirmDialog
        open={confirm === 'reset'}
        title="Close This Month?"
        message="Are you sure you want to close this month's expenses and start a new month? The current month will be archived into history and a fresh month will begin."
        confirmLabel="Archive & Start New"
        danger
        onConfirm={confirmResetMonth}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Tracker />
    </ToastProvider>
  );
}
