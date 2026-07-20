import type { Store, MonthData, ExpenseRow, Schema } from './types';
import { DEFAULT_SCHEMA, schemaColumnIds } from './types';
import { currentMonthKey } from './utils';
import { emptyRow } from './calculator';

const KEY = 'busExpenseTracker';
const SCHEMA_KEY = 'busExpenseTracker.schema';
const DEFAULT_BUDGET = 5000;

function freshMonth(key: string): MonthData {
  return { monthKey: key, budget: DEFAULT_BUDGET, rows: [], createdAt: new Date().toISOString() };
}

function loadSchema(): Schema {
  try {
    const raw = localStorage.getItem(SCHEMA_KEY);
    if (!raw) return DEFAULT_SCHEMA;
    const parsed = JSON.parse(raw) as Schema;
    if (!parsed.columns || !Array.isArray(parsed.columns) || parsed.columns.length === 0) return DEFAULT_SCHEMA;
    return parsed;
  } catch {
    return DEFAULT_SCHEMA;
  }
}

function saveSchema(schema: Schema): void {
  localStorage.setItem(SCHEMA_KEY, JSON.stringify(schema));
}

// Migrate legacy rows that used fixed fields (sk, kg, etc.) to the new `values` record
function migrateRow(row: any): ExpenseRow {
  if (row.values && typeof row.values === 'object') return row as ExpenseRow;
  const values: Record<string, number> = {};
  for (const col of DEFAULT_SCHEMA.columns) {
    values[col.id] = typeof row[col.id] === 'number' ? row[col.id] : 0;
  }
  return { id: row.id, date: row.date, values };
}

function migrateMonth(m: any): MonthData {
  return {
    monthKey: m.monthKey,
    budget: typeof m.budget === 'number' ? m.budget : DEFAULT_BUDGET,
    rows: Array.isArray(m.rows) ? m.rows.map(migrateRow) : [],
    createdAt: m.createdAt || new Date().toISOString(),
  };
}

export function loadStore(): Store {
  const schema = loadSchema();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const cur = freshMonth(currentMonthKey());
      const store: Store = { schema, currentMonth: cur, history: {} };
      saveStore(store);
      return store;
    }
    const parsed = JSON.parse(raw);
    const currentMonth = migrateMonth(parsed.currentMonth);
    const history: Record<string, MonthData> = {};
    if (parsed.history) {
      for (const [k, v] of Object.entries(parsed.history)) {
        history[k] = migrateMonth(v);
      }
    }
    return { schema, currentMonth, history };
  } catch {
    const cur = freshMonth(currentMonthKey());
    return { schema, currentMonth: cur, history: {} };
  }
}

export function saveStore(store: Store): void {
  localStorage.setItem(KEY, JSON.stringify(store));
  saveSchema(store.schema);
}

export function updateSchema(store: Store, schema: Schema): Store {
  // Ensure all rows have values for new columns, drop removed ones
  const ids = new Set(schemaColumnIds(schema));
  const fixRow = (r: ExpenseRow): ExpenseRow => {
    const values: Record<string, number> = {};
    for (const id of ids) values[id] = r.values[id] || 0;
    return { ...r, values };
  };
  const currentMonth = { ...store.currentMonth, rows: store.currentMonth.rows.map(fixRow) };
  const history: Record<string, MonthData> = {};
  for (const [k, m] of Object.entries(store.history)) {
    history[k] = { ...m, rows: m.rows.map(fixRow) };
  }
  return { schema, currentMonth, history };
}

export function archiveCurrentMonth(store: Store): Store {
  const cur = store.currentMonth;
  const history = { ...store.history, [cur.monthKey]: cur };
  const newMonth = freshMonth(currentMonthKey());
  const next: Store = { ...store, currentMonth: newMonth, history };
  saveStore(next);
  return next;
}

export function loadMonthFromHistory(store: Store, monthKey: string): Store {
  if (monthKey === store.currentMonth.monthKey) return store;
  const hist = store.history[monthKey];
  if (!hist) return store;
  const history = { ...store.history, [store.currentMonth.monthKey]: store.currentMonth };
  delete history[monthKey];
  return { ...store, currentMonth: hist, history };
}

export function updateCurrentMonth(store: Store, patch: Partial<MonthData>): Store {
  return { ...store, currentMonth: { ...store.currentMonth, ...patch } };
}

export function upsertRow(store: Store, row: ExpenseRow): Store {
  const rows = store.currentMonth.rows;
  const idx = rows.findIndex((r) => r.id === row.id);
  let nextRows: ExpenseRow[];
  if (idx >= 0) {
    nextRows = rows.slice();
    nextRows[idx] = row;
  } else {
    nextRows = [...rows, row];
  }
  nextRows.sort((a, b) => a.date.localeCompare(b.date));
  return updateCurrentMonth(store, { rows: nextRows });
}

export function deleteRow(store: Store, id: string): Store {
  return updateCurrentMonth(store, { rows: store.currentMonth.rows.filter((r) => r.id !== id) });
}

export function setBudget(store: Store, budget: number): Store {
  return updateCurrentMonth(store, { budget });
}

export { DEFAULT_BUDGET, emptyRow, DEFAULT_SCHEMA };
