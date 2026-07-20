import type { ExpenseRow, Schema } from './types';
import { schemaColumnIds } from './types';

export function rowTotal(r: ExpenseRow): number {
  return Object.values(r.values).reduce((sum, v) => sum + (v || 0), 0);
}

export function monthlyTotal(rows: ExpenseRow[]): number {
  return rows.reduce((sum, r) => sum + rowTotal(r), 0);
}

export function todaysExpense(rows: ExpenseRow[], todayISO: string): number {
  const row = rows.find((r) => r.date === todayISO);
  return row ? rowTotal(row) : 0;
}

export function averageDaily(rows: ExpenseRow[]): number {
  if (rows.length === 0) return 0;
  return monthlyTotal(rows) / rows.length;
}

export function remainingBudget(budget: number, rows: ExpenseRow[]): number {
  return budget - monthlyTotal(rows);
}

export function emptyRow(date: string, schema: Schema): ExpenseRow {
  const values: Record<string, number> = {};
  for (const id of schemaColumnIds(schema)) values[id] = 0;
  return {
    id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
    date,
    values,
  };
}

export function parseExpenseInput(value: string): number {
  if (!value || value.trim() === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function columnSum(rows: ExpenseRow[], columnId: string): number {
  return rows.reduce((s, r) => s + (r.values[columnId] || 0), 0);
}
