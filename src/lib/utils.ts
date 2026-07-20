export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function currentMonthKey(): string {
  return monthKeyFromDate(new Date());
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

export function formatDateShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${MONTH_NAMES[Number(m) - 1].slice(0, 3)}`;
}

export function formatINR(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function clampNonNegative(v: number): number {
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function downloadFile(filename: string, content: string, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
