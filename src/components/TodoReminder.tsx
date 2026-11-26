import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  Check,
  Clock,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  X,
} from 'lucide-react';
import { MONTH_NAMES, todayISO, uid } from '../lib/utils';

export type TodoRepeat = 'none' | 'daily' | 'monthly';
export type TodoPriority = 'low' | 'medium' | 'high';

export type TodoItem = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  repeat: TodoRepeat;
  priority: TodoPriority;
  done: boolean;
  notifiedAt?: string;
  note?: string;
};

const LS_KEY = 'todoReminders.v1';

export function loadTodos(): TodoItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTodos(items: TodoItem[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {
    // ignore storage quota errors
  }
}

function nowLocalKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function nextOccurrenceDate(dateStr: string, repeat: TodoRepeat): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (repeat === 'daily') d.setDate(d.getDate() + 1);
  else if (repeat === 'monthly') d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function fireSystemNotification(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-96.png',
          tag: `todo-${title}`,
        });
        return;
      }
    }
    new Notification(title, { body, icon: '/icons/icon-192.png' });
  } catch {
    // fallback silently if blocked
  }
}

/**
 * Background reminder watcher: fires notifications when tasks hit their scheduled date/time,
 * even while the user is on another tab.
 */
export function useTodoReminderWatcher(
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void
): number {
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    function check() {
      const items = loadTodos();
      const nowKey = nowLocalKey();
      let changed = false;
      let due = 0;

      const updated = items.map((item) => {
        if (item.done) return item;
        const targetKey = `${item.date}T${item.time || '09:00'}`;
        if (targetKey <= nowKey) {
          due += 1;
          if (!item.notifiedAt) {
            changed = true;
            fireSystemNotification('Task Reminder', `${item.title}${item.note ? ` — ${item.note}` : ''}`);
            notify(`Reminder: ${item.title}`, 'info');
            return { ...item, notifiedAt: nowKey };
          }
        }
        return item;
      });

      setDueCount(due);
      if (changed) {
        saveTodos(updated);
        window.dispatchEvent(new Event('todo-reminders-updated'));
      }
    }

    check();
    const id = setInterval(check, 15000);
    window.addEventListener('todo-reminders-updated', check);
    return () => {
      clearInterval(id);
      window.removeEventListener('todo-reminders-updated', check);
    };
  }, [notify]);

  return dueCount;
}

export function TodoReminder({
  notify,
}: {
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [items, setItems] = useState<TodoItem[]>(loadTodos);
  const [filter, setFilter] = useState<'pending' | 'today' | 'done' | 'all'>('pending');
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<TodoItem | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('09:00');
  const [repeat, setRepeat] = useState<TodoRepeat>('none');
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [note, setNote] = useState('');

  useEffect(() => {
    saveTodos(items);
    window.dispatchEvent(new Event('todo-reminders-updated'));
  }, [items]);

  useEffect(() => {
    const sync = () => setItems(loadTodos());
    window.addEventListener('todo-reminders-updated', sync);
    return () => window.removeEventListener('todo-reminders-updated', sync);
  }, []);

  async function requestPermission() {
    if (typeof Notification === 'undefined') {
      notify('Notifications are not supported in this browser', 'error');
      return;
    }
    const res = await Notification.requestPermission();
    setPerm(res);
    if (res === 'granted') {
      notify('Notifications enabled!');
      fireSystemNotification('Reminders Active', 'You will be notified when tasks are due.');
    } else if (res === 'denied') {
      notify('Notification permission denied in browser settings', 'error');
    }
  }

  function openForm(item?: TodoItem) {
    setEditing(item || null);
    setTitle(item?.title || '');
    setDate(item?.date || todayISO());
    setTime(item?.time || '09:00');
    setRepeat(item?.repeat || 'none');
    setPriority(item?.priority || 'medium');
    setNote(item?.note || '');
    setSheetOpen(true);
  }

  function saveTask() {
    const clean = title.trim();
    if (!clean) {
      notify('Enter a task title', 'error');
      return;
    }
    const nextItem: TodoItem = {
      id: editing?.id || uid(),
      title: clean,
      date: date || todayISO(),
      time: time || '09:00',
      repeat,
      priority,
      done: editing?.done || false,
      notifiedAt: undefined, // re-arm reminder if edited
      note: note.trim() || undefined,
    };
    setItems((prev) =>
      editing ? prev.map((x) => (x.id === editing.id ? nextItem : x)) : [nextItem, ...prev]
    );
    setSheetOpen(false);
    setEditing(null);
    notify(editing ? 'Task updated' : 'Reminder added');
  }

  function toggleDone(item: TodoItem) {
    if (!item.done && item.repeat !== 'none') {
      const nextDate = nextOccurrenceDate(item.date, item.repeat);
      setItems((prev) =>
        prev.map((x) =>
          x.id === item.id ? { ...x, date: nextDate, notifiedAt: undefined, done: false } : x
        )
      );
      notify(`Completed! Next ${item.repeat} reminder set for ${nextDate}`, 'success');
      return;
    }
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)));
  }

  function removeTask(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
    notify('Task deleted', 'info');
  }

  const today = todayISO();
  const nowKey = nowLocalKey();

  const pendingCount = items.filter((i) => !i.done).length;
  const todayCount = items.filter((i) => !i.done && i.date === today).length;
  const doneCount = items.filter((i) => i.done).length;

  const filtered = useMemo(() => {
    return items
      .filter((i) => {
        if (filter === 'pending') return !i.done;
        if (filter === 'today') return !i.done && i.date === today;
        if (filter === 'done') return i.done;
        return true;
      })
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
      });
  }, [items, filter, today]);

  return (
    <div className="space-y-3">
      {/* Notification Permission Banner */}
      {perm !== 'granted' ? (
        <section className="panel flex items-center justify-between gap-2 border-amber-200 bg-amber-50/70 dark:border-amber-800/60 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 min-w-0">
            <BellOff size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="min-w-0">
              <b className="block text-xs text-slate-900 dark:text-slate-100">
                {perm === 'denied' ? 'Notifications blocked' : 'Enable reminder alerts'}
              </b>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {perm === 'denied'
                  ? 'Allow notifications in browser site settings'
                  : 'Get alerted when tasks reach their due time'}
              </span>
            </div>
          </div>
          {perm !== 'denied' && perm !== 'unsupported' && (
            <button
              onClick={requestPermission}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold"
            >
              Allow
            </button>
          )}
        </section>
      ) : (
        <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <BellRing size={12} /> Notifications active
          </span>
          <button
            onClick={() => fireSystemNotification('Test Reminder', 'Your To-Do notifications are working!')}
            className="text-indigo-600 dark:text-indigo-400 font-medium"
          >
            Test alert
          </button>
        </div>
      )}

      {/* Summary Card */}
      <section className="overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-white via-indigo-50/60 to-violet-100/50 shadow-[0_8px_24px_-6px_rgba(79,70,229,0.14)] dark:border-indigo-500/20 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/35">
        <div className="grid grid-cols-3 divide-x divide-slate-200/70 dark:divide-slate-800/80">
          <div className="px-2 py-2.5 text-center">
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">Pending</span>
            <strong className="mt-0.5 block text-base text-slate-950 dark:text-white">{pendingCount}</strong>
          </div>
          <div className="px-2 py-2.5 text-center">
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">Today</span>
            <strong className="mt-0.5 block text-base text-indigo-600 dark:text-indigo-400">{todayCount}</strong>
          </div>
          <div className="px-2 py-2.5 text-center">
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">Done</span>
            <strong className="mt-0.5 block text-base text-emerald-600 dark:text-emerald-400">{doneCount}</strong>
          </div>
        </div>
      </section>

      {/* Filter & Add Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {(['pending', 'today', 'done', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`chip !min-h-[32px] px-3 capitalize ${
                filter === f
                  ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                  : ''
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => openForm()}
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-semibold shadow-sm"
        >
          <Plus size={14} /> Add Task
        </button>
      </div>

      {/* Task List */}
      <section className="panel !p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <Bell size={24} className="mx-auto text-indigo-400" />
            <p className="text-xs text-slate-400">No tasks in this view. Tap Add Task to set a reminder.</p>
          </div>
        ) : (
          <div className="divide-y divide-indigo-100/70 dark:divide-slate-800">
            {filtered.map((item) => {
              const isOverdue = !item.done && `${item.date}T${item.time}` <= nowKey;
              const dayLabel = `${Number(item.date.slice(8))} ${MONTH_NAMES[Number(item.date.slice(5, 7)) - 1].slice(0, 3)}`;
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-2.5 px-3 py-2.5 text-xs ${
                    item.done ? 'opacity-55' : isOverdue ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''
                  }`}
                >
                  <button
                    aria-label={item.done ? 'Mark pending' : 'Mark done'}
                    onClick={() => toggleDone(item)}
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                      item.done
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500'
                    }`}
                  >
                    {item.done && <Check size={12} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`font-semibold text-sm ${
                          item.done ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {item.title}
                      </span>
                      {item.priority === 'high' && !item.done && (
                        <span className="rounded bg-rose-100 dark:bg-rose-950/50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                          High
                        </span>
                      )}
                      {item.repeat !== 'none' && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 text-[10px] text-indigo-600 dark:text-indigo-300">
                          <Repeat size={10} /> {item.repeat}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className={`inline-flex items-center gap-1 ${isOverdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}`}>
                        <Clock size={11} /> {dayLabel} · {item.time}
                        {isOverdue ? ' (Due)' : ''}
                      </span>
                    </div>
                    {item.note && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{item.note}</p>}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      aria-label="Edit task"
                      onClick={() => openForm(item)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 rounded"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      aria-label="Delete task"
                      onClick={() => removeTask(item.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded"
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

      {doneCount > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              setItems((prev) => prev.filter((i) => !i.done));
              notify('Cleared completed tasks', 'info');
            }}
            className="text-xs text-slate-500 hover:text-rose-600"
          >
            Clear completed ({doneCount})
          </button>
        </div>
      )}

      {/* Add / Edit Task Sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50">
          <button className="absolute inset-0 bg-slate-950/50" aria-label="Close" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 pb-[calc(12px+env(safe-area-inset-bottom))] space-y-2.5 shadow-2xl">
            <div className="flex items-center justify-between">
              <b className="text-sm">{editing ? 'Edit Task' : 'New Task & Reminder'}</b>
              <button className="icon-btn !min-h-[32px] !min-w-[32px]" onClick={() => setSheetOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveTask();
                }
              }}
              placeholder="Task title (e.g. Pay Wi-Fi bill)"
              className="input-base text-base font-medium py-1.5"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-base text-base sm:text-sm py-1.5 px-2"
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="input-base text-base sm:text-sm py-1.5 px-2"
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1">
                {(['none', 'daily', 'monthly'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRepeat(r)}
                    className={`chip !min-h-[30px] px-2.5 capitalize ${
                      repeat === r
                        ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : ''
                    }`}
                  >
                    {r === 'none' ? 'Once' : r}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {(['low', 'medium', 'high'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`chip !min-h-[30px] px-2 capitalize ${
                      priority === p
                        ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : ''
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
              className="input-base text-base sm:text-sm py-1.5"
            />
            <button
              onClick={saveTask}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold flex items-center justify-center gap-1"
            >
              <Plus size={16} /> Save Reminder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
