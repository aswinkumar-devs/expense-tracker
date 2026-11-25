import type { ExpenseRow } from './types';
import { uid } from './utils';

export function rowTotal(r: ExpenseRow): number {
  return r.amount || 0;
}

export function monthlyTotal(rows: ExpenseRow[]): number {
  return rows.reduce((sum, r) => sum + r.amount, 0);
}

export function todaysExpense(rows: ExpenseRow[], date: string): number {
  return rows.filter((r) => r.date === date).reduce((sum, r) => sum + r.amount, 0);
}

export function averageDaily(rows: ExpenseRow[], monthKey?: string): number {
  if (!monthKey) return 0;
  const [year, month] = monthKey.split('-').map(Number);
  const now = new Date();
  const elapsed = monthKey === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    ? now.getDate()
    : new Date(year, month, 0).getDate();
  return elapsed > 0 ? monthlyTotal(rows) / elapsed : 0;
}

export function remainingBudget(budget: number, rows: ExpenseRow[]): number {
  return budget - monthlyTotal(rows);
}

export function emptyRow(date: string, columnId: string): ExpenseRow {
  return { id: uid(), date, columnId, amount: 0, note: '' };
}

export function parseExpenseInput(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function columnSum(rows: ExpenseRow[], columnId: string): number {
  return rows.reduce((sum, r) => sum + (r.columnId === columnId ? r.amount : 0), 0);
}
