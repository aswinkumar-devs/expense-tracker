import type { Store, MonthData, ExpenseRow, Schema } from './types';
import { DEFAULT_SCHEMA, schemaColumnIds } from './types';
import { currentMonthKey, monthKeyFromDate, uid } from './utils';

const KEY = 'busExpenseTracker';
const SCHEMA_KEY = 'busExpenseTracker.schema';
export const DEFAULT_BUDGET = 5000;

function monthSort(a: string, b: string) { return b.localeCompare(a); }

function freshMonth(key: string, budget = DEFAULT_BUDGET): MonthData {
  return { monthKey: key, budget, rows: [], createdAt: new Date().toISOString() };
}

function loadSchema(): Schema {
  try {
    const raw = localStorage.getItem(SCHEMA_KEY);
    if (!raw) return DEFAULT_SCHEMA;
    const parsed = JSON.parse(raw) as Schema;
    if (!parsed.columns || !Array.isArray(parsed.columns) || !parsed.columns.length) return DEFAULT_SCHEMA;
    return {
      ...parsed,
      columns: parsed.columns.map((c) => ({ shortLabel: c.shortLabel, defaultFare: c.defaultFare, hidden: c.hidden, ...c })),
    };
  } catch { return DEFAULT_SCHEMA; }
}

export function saveSchema(schema: Schema): void { localStorage.setItem(SCHEMA_KEY, JSON.stringify(schema)); }

type LegacyRecord = Record<string, unknown>;

function migrateExpense(row: LegacyRecord, schema: Schema): ExpenseRow[] {
  if (typeof row.amount === 'number' && typeof row.columnId === 'string') {
    return [{ id: typeof row.id === 'string' ? row.id : uid(), date: String(row.date), time: typeof row.time === 'string' ? row.time : undefined, columnId: row.columnId, amount: row.amount, note: typeof row.note === 'string' ? row.note.trim() : undefined }];
  }
  if (row.values && typeof row.values === 'object') {
    return Object.entries(row.values as Record<string, number>).flatMap(([columnId, value]) => {
      const amount = typeof value === 'number' ? value : 0;
      return amount > 0 ? [{ id: uid(), date: String(row.date), time: typeof row.time === 'string' ? row.time : undefined, columnId, amount, note: typeof row.note === 'string' ? row.note.trim() : undefined }] : [];
    });
  }
  return schema.columns.flatMap((c) => {
    const value = row[c.id];
    const amount = typeof value === 'number' ? value : 0;
    return amount > 0 ? [{ id: uid(), date: String(row.date), time: typeof row.time === 'string' ? row.time : undefined, columnId: c.id, amount, note: typeof row.note === 'string' ? row.note.trim() : undefined }] : [];
  });
}

function migrateMonth(raw: LegacyRecord, schema: Schema, fallbackKey: string): MonthData {
  const monthKey = typeof raw.monthKey === 'string' && /^\d{4}-\d{2}$/.test(raw.monthKey) ? raw.monthKey : fallbackKey;
  const rows = Array.isArray(raw.rows) ? raw.rows.flatMap((r) => migrateExpense(r as LegacyRecord, schema)) : [];
  return { monthKey, budget: typeof raw.budget === 'number' ? raw.budget : DEFAULT_BUDGET, rows, createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString() };
}

export function loadStore(): Store {
  const schema = loadSchema();
  const raw = localStorage.getItem(KEY);
  let parsed: LegacyRecord | null = null;
  try { parsed = raw ? JSON.parse(raw) as LegacyRecord : null; } catch { parsed = null; }

  if (parsed?.months && typeof parsed.months === 'object') {
    const months: Record<string, MonthData> = {};
    for (const [key, value] of Object.entries(parsed.months)) months[key] = migrateMonth(value as LegacyRecord, schema, key);
    const currentKey = currentMonthKey();
    if (!months[currentKey]) {
      const priorKey = Object.keys(months).sort(monthSort)[0];
      const priorBudget = priorKey ? months[priorKey].budget : DEFAULT_BUDGET;
      months[currentKey] = freshMonth(currentKey, priorBudget);
    }
    const active = typeof parsed.activeMonthKey === 'string' && months[parsed.activeMonthKey] ? parsed.activeMonthKey : currentKey;
    const store: Store = { schema, months, activeMonthKey: active };
    saveStore(store);
    return store;
  }

  if (raw) {
    const oneTimeBackupKey = `${KEY}.old-backup`;
    if (!localStorage.getItem(oneTimeBackupKey)) localStorage.setItem(oneTimeBackupKey, raw);
  }

  const months: Record<string, MonthData> = {};
  if (parsed?.currentMonth && typeof parsed.currentMonth === 'object') {
    const currentKey = currentMonthKey();
    const current = migrateMonth(parsed.currentMonth as LegacyRecord, schema, currentKey);
    months[current.monthKey || currentKey] = current;
  }
  if (parsed?.history && typeof parsed.history === 'object') {
    for (const [key, value] of Object.entries(parsed.history)) {
      months[key] = migrateMonth(value as LegacyRecord, schema, key);
    }
  }
  const currentKey = currentMonthKey();
  if (!months[currentKey]) {
    const priorKeys = Object.keys(months).sort(monthSort);
    const priorBudget = priorKeys[0] ? months[priorKeys[0]].budget : DEFAULT_BUDGET;
    months[currentKey] = freshMonth(currentKey, priorBudget);
  }
  const store: Store = { schema, months, activeMonthKey: currentKey };
  saveStore(store);
  return store;
}

export function saveStore(store: Store): void {
  localStorage.setItem(KEY, JSON.stringify(store));
  saveSchema(store.schema);
}

export function updateSchema(store: Store, schema: Schema): Store {
  const ids = new Set(schemaColumnIds(schema));
  const months: Record<string, MonthData> = {};
  for (const [key, month] of Object.entries(store.months)) {
    months[key] = { ...month, rows: month.rows.filter((r) => ids.has(r.columnId)) };
  }
  return { ...store, schema, months };
}

export function ensureCurrentMonth(store: Store): Store {
  const key = currentMonthKey();
  if (store.months[key]) return store.activeMonthKey === key ? store : { ...store, activeMonthKey: key };
  const priorKey = Object.keys(store.months).sort(monthSort)[0];
  const budget = priorKey ? store.months[priorKey].budget : DEFAULT_BUDGET;
  return { ...store, months: { ...store.months, [key]: freshMonth(key, budget) }, activeMonthKey: key };
}

export function setActiveMonth(store: Store, key: string): Store {
  return store.months[key] ? { ...store, activeMonthKey: key } : store;
}

export function getActiveMonth(store: Store): MonthData {
  return store.months[store.activeMonthKey] || store.months[currentMonthKey()] || freshMonth(currentMonthKey());
}

export function upsertRow(store: Store, row: ExpenseRow): Store {
  const key = row.date.slice(0, 7);
  const month = store.months[key] || freshMonth(key, store.months[store.activeMonthKey]?.budget ?? DEFAULT_BUDGET);
  const idx = month.rows.findIndex((r) => r.id === row.id);
  const rows = idx >= 0 ? month.rows.map((r, i) => i === idx ? row : r) : [...month.rows, row];
  rows.sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`));
  return { ...store, months: { ...store.months, [key]: { ...month, rows } } };
}

export function deleteRow(store: Store, id: string, monthKey = store.activeMonthKey): Store {
  const month = store.months[monthKey];
  if (!month) return store;
  return { ...store, months: { ...store.months, [monthKey]: { ...month, rows: month.rows.filter((r) => r.id !== id) } } };
}

export function setBudget(store: Store, budget: number, monthKey = store.activeMonthKey): Store {
  const month = store.months[monthKey];
  if (!month) return store;
  return { ...store, months: { ...store.months, [monthKey]: { ...month, budget } } };
}

export function clearMonth(store: Store, monthKey: string): Store {
  const month = store.months[monthKey];
  if (!month) return store;
  return { ...store, months: { ...store.months, [monthKey]: { ...month, rows: [] } } };
}

export function deleteHistoryMonth(store: Store, monthKey: string): Store {
  if (monthKey === currentMonthKey()) return store;
  const months = { ...store.months }; delete months[monthKey];
  return { ...store, months, activeMonthKey: store.activeMonthKey === monthKey ? currentMonthKey() : store.activeMonthKey };
}

export function archiveCurrentMonth(store: Store): Store { return store; }
export function loadMonthFromHistory(store: Store, monthKey: string): Store { return setActiveMonth(store, monthKey); }
export function updateCurrentMonth(store: Store, patch: Partial<MonthData>): Store {
  const key = store.activeMonthKey;
  const month = store.months[key];
  if (!month) return store;
  return { ...store, months: { ...store.months, [key]: { ...month, ...patch } } };
}

export { DEFAULT_SCHEMA, freshMonth, monthKeyFromDate };
