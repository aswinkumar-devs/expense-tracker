import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  Search,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { formatINR, formatMonthLabel, MONTH_NAMES, todayISO, uid } from '../lib/utils';

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type EntryKind = 'expense' | 'saving' | 'income';

type SalaryEntry = {
  id: string;
  date: string;
  kind: EntryKind;
  category: string;
  account: string;
  amount: number;
  note?: string;
};

type CategoryMap = Record<EntryKind, string[]>;

type SalaryMonthData = {
  salary: number;
  entries: SalaryEntry[];
};

type SalaryStoreV2 = {
  categories: CategoryMap;
  accounts: string[];
  months: Record<string, SalaryMonthData>;
};

const LS_KEY = 'salaryTracker.v1';

const DEFAULT_CATEGORIES: CategoryMap = {
  expense: ['Rent', 'Food', 'Bills', 'Groceries', 'Shopping', 'EMI', 'Medical', 'Other'],
  saving: ['Bank Savings', 'SIP / Mutual Fund', 'RD / FD', 'Emergency Fund', 'Gold', 'Other'],
  income: ['Bonus', 'Freelance', 'Cashback', 'Other'],
};

const DEFAULT_ACCOUNTS = ['Bank / UPI', 'Cash', 'Card'];

function loadSalaryStore(): SalaryStoreV2 {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { categories: DEFAULT_CATEGORIES, accounts: DEFAULT_ACCOUNTS, months: {} };
    const parsed = JSON.parse(raw);
    // Migrate v1 flat month-keyed object if present
    if (parsed && !parsed.months && typeof parsed === 'object') {
      return { categories: DEFAULT_CATEGORIES, accounts: DEFAULT_ACCOUNTS, months: parsed as Record<string, SalaryMonthData> };
    }
    return {
      categories: {
        expense: parsed.categories?.expense?.length ? parsed.categories.expense : DEFAULT_CATEGORIES.expense,
        saving: parsed.categories?.saving?.length ? parsed.categories.saving : DEFAULT_CATEGORIES.saving,
        income: parsed.categories?.income?.length ? parsed.categories.income : DEFAULT_CATEGORIES.income,
      },
      accounts: parsed.accounts?.length ? parsed.accounts : DEFAULT_ACCOUNTS,
      months: parsed.months || {},
    };
  } catch {
    return { categories: DEFAULT_CATEGORIES, accounts: DEFAULT_ACCOUNTS, months: {} };
  }
}

export function SalaryTracker({
  monthKey,
  notify,
}: {
  monthKey: string;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [store, setStore] = useState<SalaryStoreV2>(loadSalaryStore);
  const [editingSalary, setEditingSalary] = useState(false);
  const [salaryInput, setSalaryInput] = useState('');
  const [filterKind, setFilterKind] = useState<'all' | EntryKind>('all');
  const [query, setQuery] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<SalaryEntry | null>(null);
  const [kind, setKind] = useState<EntryKind>('expense');
  const [category, setCategory] = useState('Rent');
  const [account, setAccount] = useState(store.accounts[0] || 'Bank / UPI');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [newCatInput, setNewCatInput] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(store));
    } catch {
      // ignore storage quota errors
    }
  }, [store]);

  const prevMonthSalary = useMemo(() => {
    const keys = Object.keys(store.months).filter((k) => k < monthKey).sort().reverse();
    return keys.length ? store.months[keys[0]].salary : 0;
  }, [store.months, monthKey]);

  const monthData: SalaryMonthData = store.months[monthKey] || { salary: prevMonthSalary, entries: [] };

  function updateMonth(updater: (cur: SalaryMonthData) => SalaryMonthData) {
    setStore((prev) => {
      const cur = prev.months[monthKey] || { salary: prevMonthSalary, entries: [] };
      return { ...prev, months: { ...prev.months, [monthKey]: updater(cur) } };
    });
  }

  const extraIncome = monthData.entries.filter((e) => e.kind === 'income').reduce((s, e) => s + e.amount, 0);
  const totalIncome = monthData.salary + extraIncome;
  const totalExpenses = monthData.entries.filter((e) => e.kind === 'expense').reduce((s, e) => s + e.amount, 0);
  const totalSavings = monthData.entries.filter((e) => e.kind === 'saving').reduce((s, e) => s + e.amount, 0);
  const cashInHand = totalIncome - totalExpenses - totalSavings;

  const expensePct = totalIncome > 0 ? Math.min(100, (totalExpenses / totalIncome) * 100) : 0;
  const savingPct = totalIncome > 0 ? Math.min(100 - expensePct, (totalSavings / totalIncome) * 100) : 0;

  // Account-wise net flow for the month (salary goes into first account by default)
  const accountSummary = useMemo(() => {
    const map = new Map<string, { spent: number; saved: number; income: number }>();
    for (const acc of store.accounts) map.set(acc, { spent: 0, saved: 0, income: 0 });
    const primaryAcc = store.accounts[0] || 'Bank / UPI';
    if (monthData.salary > 0) {
      const cur = map.get(primaryAcc) || { spent: 0, saved: 0, income: 0 };
      cur.income += monthData.salary;
      map.set(primaryAcc, cur);
    }
    for (const e of monthData.entries) {
      const acc = e.account || primaryAcc;
      const cur = map.get(acc) || { spent: 0, saved: 0, income: 0 };
      if (e.kind === 'expense') cur.spent += e.amount;
      else if (e.kind === 'saving') cur.saved += e.amount;
      else cur.income += e.amount;
      map.set(acc, cur);
    }
    return [...map.entries()];
  }, [monthData, store.accounts]);

  // Category breakdown for expenses & savings
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { kind: EntryKind; total: number }>();
    for (const e of monthData.entries) {
      if (e.kind === 'income') continue;
      const key = `${e.kind}:${e.category}`;
      const cur = map.get(key) || { kind: e.kind, total: 0 };
      cur.total += e.amount;
      map.set(key, cur);
    }
    return [...map.entries()]
      .map(([key, v]) => ({ category: key.split(':').slice(1).join(':'), kind: v.kind, total: v.total }))
      .sort((a, b) => b.total - a.total);
  }, [monthData.entries]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return monthData.entries
      .filter((e) => (filterKind === 'all' || e.kind === filterKind))
      .filter(
        (e) =>
          !q ||
          e.category.toLowerCase().includes(q) ||
          (e.note && e.note.toLowerCase().includes(q)) ||
          (e.account && e.account.toLowerCase().includes(q)) ||
          e.date.includes(q)
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [monthData.entries, filterKind, query]);

  function openAdd(targetKind: EntryKind, existing?: SalaryEntry) {
    const k = existing?.kind || targetKind;
    const cats = store.categories[k];
    setEditingEntry(existing || null);
    setKind(k);
    setCategory(existing?.category || cats[0] || 'Other');
    setAccount(existing?.account || store.accounts[0] || 'Bank / UPI');
    setAmount(existing ? String(existing.amount) : '');
    setDate(existing?.date || (monthKey === todayISO().slice(0, 7) ? todayISO() : `${monthKey}-01`));
    setNote(existing?.note || '');
    setAddingCat(false);
    setNewCatInput('');
    setSheetOpen(true);
  }

  function addCustomCategory() {
    const name = newCatInput.trim();
    if (!name) return;
    if (store.categories[kind].some((c) => c.toLowerCase() === name.toLowerCase())) {
      setCategory(store.categories[kind].find((c) => c.toLowerCase() === name.toLowerCase()) || name);
      setAddingCat(false);
      setNewCatInput('');
      return;
    }
    setStore((prev) => ({
      ...prev,
      categories: { ...prev.categories, [kind]: [...prev.categories[kind], name] },
    }));
    setCategory(name);
    setNewCatInput('');
    setAddingCat(false);
    notify(`Category "${name}" added`);
  }

  function deleteCategory(catName: string) {
    if (store.categories[kind].length <= 1) return;
    setStore((prev) => {
      const nextCats = prev.categories[kind].filter((c) => c !== catName);
      if (category === catName) setCategory(nextCats[0] || 'Other');
      return { ...prev, categories: { ...prev.categories, [kind]: nextCats } };
    });
    notify(`Removed "${catName}"`, 'info');
  }

  function saveEntry() {
    const num = Number(amount);
    if (!num || num <= 0) {
      notify('Enter an amount above ₹0', 'error');
      return;
    }
    const cat = category.trim() || 'Other';
    // Auto-save typed category if new
    if (!store.categories[kind].some((c) => c.toLowerCase() === cat.toLowerCase())) {
      setStore((prev) => ({
        ...prev,
        categories: { ...prev.categories, [kind]: [...prev.categories[kind], cat] },
      }));
    }
    const entry: SalaryEntry = {
      id: editingEntry?.id || uid(),
      date: date || todayISO(),
      kind,
      category: cat,
      account: account || store.accounts[0] || 'Bank / UPI',
      amount: num,
      note: note.trim() || undefined,
    };
    updateMonth((cur) => ({
      ...cur,
      entries: editingEntry
        ? cur.entries.map((e) => (e.id === editingEntry.id ? entry : e))
        : [...cur.entries, entry],
    }));
    setSheetOpen(false);
    setEditingEntry(null);
    notify(editingEntry ? 'Entry updated' : 'Entry added');
  }

  function removeEntry(id: string) {
    updateMonth((cur) => ({ ...cur, entries: cur.entries.filter((e) => e.id !== id) }));
    notify('Entry deleted', 'info');
  }

  function exportLedgerCSV() {
    const lines = [['Date', 'Type', 'Category', 'Account', 'Amount', 'Note'].map(csvCell).join(',')];
    if (monthData.salary > 0) {
      lines.push([`${monthKey}-01`, 'Salary', 'Monthly Salary', store.accounts[0] || 'Bank / UPI', monthData.salary, ''].map(csvCell).join(','));
    }
    for (const e of [...monthData.entries].sort((a, b) => a.date.localeCompare(b.date))) {
      lines.push([e.date, e.kind, e.category, e.account || '', e.amount, e.note || ''].map(csvCell).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salary-ledger-${monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Ledger CSV exported');
  }

  const catOptions = store.categories[kind];

  return (
    <div className="space-y-3">
      {/* Overview Card */}
      <section className="overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-white via-indigo-50/60 to-violet-100/50 shadow-[0_8px_24px_-6px_rgba(79,70,229,0.14)] dark:border-indigo-500/20 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/35">
        <div className="flex items-center justify-between px-3 py-2 border-b border-indigo-100/80 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <Wallet size={15} className="text-indigo-600 dark:text-indigo-400" />
            <b className="text-xs">{formatMonthLabel(monthKey)} · Wallet</b>
          </div>
          {editingSalary ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = Math.max(0, Number(salaryInput) || 0);
                updateMonth((cur) => ({ ...cur, salary: val }));
                setEditingSalary(false);
                notify('Monthly salary updated');
              }}
              className="flex items-center gap-1"
            >
              <input
                autoFocus
                inputMode="decimal"
                type="number"
                min="0"
                value={salaryInput}
                onChange={(e) => setSalaryInput(e.target.value)}
                placeholder="Salary"
                className="input-base !w-24 py-0.5 px-1.5 text-base sm:text-xs font-semibold"
              />
              <button type="submit" className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold">
                Save
              </button>
              <button type="button" onClick={() => setEditingSalary(false)} className="px-1 text-[11px] text-slate-500">
                <X size={13} />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSalaryInput(String(monthData.salary || ''));
                setEditingSalary(true);
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400"
            >
              <span>Salary {formatINR(monthData.salary)}</span>
              <Pencil size={11} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 divide-x divide-slate-200/70 dark:divide-slate-800/80">
          <div className="px-2 py-3 text-center">
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">Expenses</span>
            <strong className="mt-0.5 block text-base text-rose-600 dark:text-rose-400">
              {formatINR(totalExpenses)}
            </strong>
          </div>
          <div className="px-2 py-3 text-center">
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">Saved</span>
            <strong className="mt-0.5 block text-base text-emerald-600 dark:text-emerald-400">
              {formatINR(totalSavings)}
            </strong>
          </div>
          <div className="px-2 py-3 text-center">
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">Balance</span>
            <strong
              className={`mt-0.5 block text-base ${
                cashInHand < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-950 dark:text-white'
              }`}
            >
              {formatINR(cashInHand)}
            </strong>
          </div>
        </div>

        {/* Stacked Allocation Bar */}
        <div className="h-2 bg-slate-100 dark:bg-slate-800 flex overflow-hidden">
          <div className="h-full bg-rose-500 transition-all" style={{ width: `${expensePct}%` }} title="Expenses" />
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${savingPct}%` }} title="Savings" />
        </div>

        <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span>
            Inflow <b className="text-slate-800 dark:text-slate-200">{formatINR(totalIncome)}</b>
          </span>
          <div className="flex items-center gap-3">
            {totalIncome > 0 && (
              <span>
                Saved <b className="text-emerald-600 dark:text-emerald-400">{Math.round((totalSavings / totalIncome) * 100)}%</b>
              </span>
            )}
            <button onClick={exportLedgerCSV} className="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400">
              <Download size={11} /> CSV
            </button>
          </div>
        </div>
      </section>

      {/* Account Balances Strip */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {accountSummary.map(([acc, s]) => {
          const net = s.income - s.spent - s.saved;
          return (
            <div key={acc} className="panel !py-2 !px-3 shrink-0 min-w-[115px]">
              <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                <Landmark size={11} />
                <span>{acc}</span>
              </div>
              <b className={`block text-xs mt-0.5 tabular-nums ${net < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
                {formatINR(net)}
              </b>
              <span className="block text-[10px] text-slate-400">Out {formatINR(s.spent + s.saved)}</span>
            </div>
          );
        })}
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => openAdd('expense')}
          className="panel !p-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:border-rose-300 dark:hover:border-rose-500/40 transition"
        >
          <TrendingDown size={14} /> Expense
        </button>
        <button
          onClick={() => openAdd('saving')}
          className="panel !p-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-500/40 transition"
        >
          <PiggyBank size={14} /> Saving
        </button>
        <button
          onClick={() => openAdd('income')}
          className="panel !p-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition"
        >
          <TrendingUp size={14} /> Income
        </button>
      </div>

      {/* Category Breakdown Toggle */}
      {categoryBreakdown.length > 0 && (
        <section className="panel !p-0 overflow-hidden">
          <button
            onClick={() => setShowBreakdown((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <span className="inline-flex items-center gap-1.5">
              <Tag size={13} className="text-indigo-500" /> Category Breakdown ({categoryBreakdown.length})
            </span>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400">{showBreakdown ? 'Hide' : 'View'}</span>
          </button>
          {showBreakdown && (
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-indigo-100/70 dark:border-slate-800">
              {categoryBreakdown.map((item) => {
                const denom = Math.max(totalIncome, totalExpenses + totalSavings, 1);
                const pct = Math.min(100, Math.round((item.total / denom) * 100));
                return (
                  <div key={`${item.kind}-${item.category}`}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-700 dark:text-slate-300">
                        {item.category}{' '}
                        <span className="text-[10px] text-slate-400">({item.kind})</span>
                      </span>
                      <b className="tabular-nums">
                        {formatINR(item.total)} <span className="text-[10px] font-normal text-slate-400">({pct}%)</span>
                      </b>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                      <div
                        className={`h-full rounded-full ${item.kind === 'saving' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Search & Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search category, account, note or date"
            className="input-base pl-8 py-1.5 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(['all', 'expense', 'saving', 'income'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterKind(f)}
              className={`chip !min-h-[30px] px-3 capitalize ${
                filterKind === f
                  ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                  : ''
              }`}
            >
              {f === 'all' ? 'All' : f === 'expense' ? 'Expenses' : f === 'saving' ? 'Savings' : 'Income'}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger List */}
      <section className="panel !p-0 overflow-hidden">
        {filteredEntries.length === 0 ? (
          <p className="p-6 text-center text-xs text-slate-400">
            Set your salary above and log where your expenses &amp; savings go.
          </p>
        ) : (
          <div className="divide-y divide-indigo-100/70 dark:divide-slate-800">
            {filteredEntries.map((e) => {
              const dayLabel = `${Number(e.date.slice(8))} ${MONTH_NAMES[Number(e.date.slice(5, 7)) - 1].slice(0, 3)}`;
              return (
                <div key={e.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                          e.kind === 'expense'
                            ? 'bg-rose-500'
                            : e.kind === 'saving'
                            ? 'bg-emerald-500'
                            : 'bg-indigo-500'
                        }`}
                      />
                      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{e.category}</span>
                      <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                        {e.account || 'Bank / UPI'}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">{dayLabel}</span>
                    </div>
                    {e.note && <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate pl-3.5 mt-0.5">{e.note}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <b
                      className={`tabular-nums ${
                        e.kind === 'expense'
                          ? 'text-rose-600 dark:text-rose-400'
                          : e.kind === 'saving'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-indigo-600 dark:text-indigo-400'
                      }`}
                    >
                      {e.kind === 'expense' ? '-' : '+'}
                      {formatINR(e.amount)}
                    </b>
                    <button
                      aria-label="Edit entry"
                      onClick={() => openAdd(e.kind, e)}
                      className="p-1 text-slate-500 hover:text-indigo-600 rounded"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      aria-label="Delete entry"
                      onClick={() => removeEntry(e.id)}
                      className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Add / Edit Sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50">
          <button className="absolute inset-0 bg-slate-950/50" aria-label="Close" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-2xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 pb-[calc(12px+env(safe-area-inset-bottom))] space-y-2.5 shadow-2xl">
            <div className="flex items-center justify-between">
              <b className="text-sm">
                {editingEntry ? 'Edit' : 'Add'} {kind === 'expense' ? 'Expense' : kind === 'saving' ? 'Saving' : 'Income'}
              </b>
              <button className="icon-btn !min-h-[32px] !min-w-[32px]" onClick={() => setSheetOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Category chips + Add new category */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1.5">
                {catOptions.map((c) => (
                  <span
                    key={c}
                    className={`inline-flex items-center rounded-xl border text-xs transition ${
                      category === c
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'border-indigo-100 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <button type="button" onClick={() => setCategory(c)} className="px-2.5 py-1">
                      {c}
                    </button>
                    {catOptions.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Delete ${c}`}
                        onClick={() => deleteCategory(c)}
                        className="pr-1.5 text-slate-400 hover:text-rose-500"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setAddingCat((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-700 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400"
                >
                  <Plus size={12} /> New category
                </button>
              </div>
              {addingCat && (
                <div className="flex gap-1.5">
                  <input
                    autoFocus
                    value={newCatInput}
                    onChange={(e) => setNewCatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomCategory();
                      }
                    }}
                    placeholder="New category name…"
                    className="input-base flex-1 py-1 text-base sm:text-xs"
                  />
                  <button
                    type="button"
                    onClick={addCustomCategory}
                    className="px-3 py-1 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Account selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-[11px] text-slate-400 shrink-0">Account:</span>
              {store.accounts.map((acc) => (
                <button
                  key={acc}
                  type="button"
                  onClick={() => setAccount(acc)}
                  className={`chip !min-h-[30px] px-2.5 ${
                    account === acc
                      ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : ''
                  }`}
                >
                  {acc}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-[1fr_132px] gap-1.5">
              <input
                autoFocus={!addingCat}
                inputMode="decimal"
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="₹ Amount"
                className="input-base text-base font-semibold py-1.5"
              />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-base text-base sm:text-sm py-1.5 px-2"
              />
            </div>

            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveEntry();
                }
              }}
              placeholder="Note / details (optional)"
              className="input-base text-base sm:text-sm py-1.5"
            />

            <button
              onClick={saveEntry}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold flex items-center justify-center gap-1"
            >
              <Plus size={16} /> Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
