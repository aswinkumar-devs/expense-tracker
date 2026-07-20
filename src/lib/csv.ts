import type { MonthData, Schema } from './types';
import { rowTotal } from './calculator';
import { downloadFile, formatMonthLabel } from './utils';

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportMonthCSV(month: MonthData, schema: Schema): void {
  const headers = ['Date', ...schema.columns.map((c) => c.label), 'Total', ...(schema.noteEnabled ? ['Note'] : [])];
  const lines = [headers.map(csvCell).join(',')];
  for (const r of month.rows) {
    lines.push(
      [r.date, ...schema.columns.map((c) => r.values[c.id] || 0), rowTotal(r), ...(schema.noteEnabled ? [r.note ?? ''] : [])].map(csvCell).join(',')
    );
  }
  const total = month.rows.reduce((s, r) => s + rowTotal(r), 0);
  lines.push(
    ['', ...schema.columns.map((c) => month.rows.reduce((s, r) => s + (r.values[c.id] || 0), 0)), total, ...(schema.noteEnabled ? [''] : [])].map(csvCell).join(',')
  );
  lines.push('');
  lines.push(`Monthly Budget,${month.budget}`);
  lines.push(`Monthly Total,${total}`);
  const content = lines.join('\n');
  downloadFile(`expense-${month.monthKey}-${formatMonthLabel(month.monthKey).replace(' ', '-')}.csv`, content);
}
