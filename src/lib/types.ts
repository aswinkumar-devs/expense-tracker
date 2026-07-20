export type ColumnDef = {
  id: string;
  label: string;
};

export type Schema = {
  columns: ColumnDef[];
  noteEnabled?: boolean;
};

export type ExpenseRow = {
  id: string;
  date: string; // YYYY-MM-DD
  values: Record<string, number>; // keyed by column id
  note?: string;
};

export type MonthData = {
  monthKey: string; // YYYY-MM
  budget: number;
  rows: ExpenseRow[];
  createdAt: string; // ISO
};

export type History = Record<string, MonthData>; // keyed by YYYY-MM

export type Store = {
  schema: Schema;
  currentMonth: MonthData;
  history: History;
};

export const DEFAULT_SCHEMA: Schema = {
  noteEnabled: false,
  columns: [
    { id: 'sk', label: 'Somanur → Karumathampatti' },
    { id: 'kg', label: 'Karumathampatti → Gandhipuram' },
    { id: 'grp', label: 'Gandhipuram → R.S. Puram' },
    { id: 'rpg', label: 'R.S. Puram → Gandhipuram' },
    { id: 'gk', label: 'Gandhipuram → Karumathampatti' },
    { id: 'ks', label: 'Karumathampatti → Somanur' },
    { id: 'others', label: 'Others' },
  ],
};

export function schemaColumnIds(schema: Schema): string[] {
  return schema.columns.map((c) => c.id);
}
