export type ColumnDef = {
  id: string;
  label: string;
  shortLabel?: string;
  defaultFare?: number;
  hidden?: boolean;
};

export type Schema = {
  columns: ColumnDef[];
  noteEnabled?: boolean;
};

export type ExpenseRow = {
  id: string;
  date: string;
  time?: string;
  columnId: string;
  amount: number;
  note?: string;
};

export type MonthData = {
  monthKey: string;
  budget: number;
  rows: ExpenseRow[];
  createdAt: string;
};

export type Store = {
  schema: Schema;
  months: Record<string, MonthData>;
  activeMonthKey: string;
};

export const DEFAULT_SCHEMA: Schema = {
  noteEnabled: true,
  columns: [
    { id: 'sk', label: 'Somanur → Karumathampatti', shortLabel: 'Som→Kar', defaultFare: 0 },
    { id: 'kg', label: 'Karumathampatti → Gandhipuram', shortLabel: 'Kar→Gan', defaultFare: 0 },
    { id: 'grp', label: 'Gandhipuram → R.S. Puram', shortLabel: 'Gan→R.S.', defaultFare: 0 },
    { id: 'rpg', label: 'R.S. Puram → Gandhipuram', shortLabel: 'R.S.→Gan', defaultFare: 0 },
    { id: 'gk', label: 'Gandhipuram → Karumathampatti', shortLabel: 'Gan→Kar', defaultFare: 0 },
    { id: 'ks', label: 'Karumathampatti → Somanur', shortLabel: 'Kar→Som', defaultFare: 0 },
    { id: 'others', label: 'Others', shortLabel: 'Others', defaultFare: 0 },
  ],
};

export function schemaColumnIds(schema: Schema): string[] {
  return schema.columns.map((c) => c.id);
}
