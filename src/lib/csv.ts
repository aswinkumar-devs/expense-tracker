import type { MonthData, Schema } from './types';
import { downloadFile, formatMonthLabel } from './utils';

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportMonthCSV(month: MonthData, schema: Schema): void {
  const lines = [['Date', 'Route', 'Amount', 'Note'].map(csvCell).join(',')];
  for (const r of month.rows) {
    const route = schema.columns.find((c) => c.id === r.columnId)?.label || r.columnId;
    lines.push([r.date, route, r.amount, r.note || ''].map(csvCell).join(','));
  }
  const total = month.rows.reduce((s, r) => s + r.amount, 0);
  lines.push(''); lines.push(`Monthly Total,${total}`);
  downloadFile(`expense-${month.monthKey}-${formatMonthLabel(month.monthKey).replace(' ', '-')}.csv`, lines.join('\n'));
}
