import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Plus } from 'lucide-react';
import { Avatar, Modal } from './ui';
import { useStore } from '@/store/context';
import { PARISHES } from '@/types';
import { formatDateLong, monthName } from '@/utils/format';

export function CalendarView() {
  const { events, users, addEvent } = useStore();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(today.toISOString().slice(0, 10));
  const [addOpen, setAddOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today.toISOString().slice(0, 10));
  const [time, setTime] = useState('18:00');
  const [parish, setParish] = useState<string>(PARISHES[0]);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const monthGrid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const eventsByDate = useMemo(() => {
    const map: Record<string, typeof events> = {};
    for (const e of events) (map[e.date] ??= []).push(e);
    return map;
  }, [events]);

  const selectedEvents = selected ? eventsByDate[selected] ?? [] : [];
  const userOf = (id: string) => users.find((u) => u.id === id);

  const submit = () => {
    if (!title.trim()) return;
    addEvent({ title: title.trim(), date, time, parish, location: location || 'TBA', description });
    setTitle(''); setLocation(''); setDescription('');
    setAddOpen(false);
    setSelected(date);
    setCursor(new Date(date + 'T00:00:00'));
  };

  return (
    <div className="space-y-4">
      <header className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold">
            <CalendarDays size={22} className="text-gold-300" /> Community <span className="gold-text">Calendar</span>
          </h1>
          <p className="mt-1 text-sm text-ink-400">{events.length} upcoming gatherings</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="gold-btn">
          <Plus size={16} /> Add event
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Calendar */}
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="ghost-btn p-2"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="font-serif text-lg font-semibold">
              {monthName(cursor.getMonth())} {cursor.getFullYear()}
            </div>
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="ghost-btn p-2"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-ink-400">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthGrid.map((cell, i) => {
              const iso = cell.date.toISOString().slice(0, 10);
              const hasEvents = (eventsByDate[iso]?.length ?? 0) > 0;
              const isToday = iso === today.toISOString().slice(0, 10);
              const isSelected = iso === selected;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(iso)}
                  className={`relative aspect-square rounded-lg p-1 text-sm transition-all ${
                    !cell.currentMonth ? 'text-ink-600' : 'text-ink-200 hover:bg-ink-800'
                  } ${isSelected ? 'bg-gold-400/15 shadow-[inset_0_0_0_1px_rgba(212,175,55,0.5)]' : ''}`}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full ${
                    isToday ? 'bg-gold-400 font-bold text-ink-950' : ''
                  }`}>
                    {cell.date.getDate()}
                  </span>
                  {hasEvents && (
                    <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-gold-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail */}
        <div className="card flex flex-col p-4">
          <div className="mb-3 border-b border-ink-700 pb-2">
            <div className="text-xs uppercase tracking-wider text-ink-400">Selected day</div>
            <div className="font-serif text-lg font-semibold">{selected ? formatDateLong(selected) : '—'}</div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin">
            {selectedEvents.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-400">No events on this day.</p>
            ) : (
              selectedEvents.map((e) => {
                const host = userOf(e.createdBy);
                return (
                  <div key={e.id} className="rounded-xl border border-ink-700 bg-ink-850/60 p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-gold-400/15 text-gold-200">
                        <Clock size={14} />
                        <span className="text-[9px] font-bold">{e.time}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-ink-100">{e.title}</div>
                        <div className="truncate text-xs text-ink-400">{e.parish}</div>
                        <div className="mt-1 flex items-center gap-1 text-xs text-ink-400">
                          <MapPin size={11} /> {e.location}
                        </div>
                        {e.description && <p className="mt-1 text-xs text-ink-300">{e.description}</p>}
                        {host && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <Avatar src={host.photo} name={host.name} size={18} />
                            <span className="text-[10px] text-ink-400">by {host.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Add event modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} size="md">
        <div className="p-5">
          <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
            <Plus size={18} className="text-gold-300" /> Add an event
          </h2>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-400">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Youth group bonfire" className="input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-400">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-400">Time</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-400">Parish</label>
              <select value={parish} onChange={(e) => setParish(e.target.value)} className="input">
                {PARISHES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-400">Location</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Church hall" className="input" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-400">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Details…" className="input resize-none" />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setAddOpen(false)} className="ghost-btn py-2">Cancel</button>
            <button onClick={submit} disabled={!title.trim()} className="gold-btn py-2">Add event</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function buildMonthGrid(cursor: Date) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const cells: { date: Date; currentMonth: boolean }[] = [];
  // leading days from prev month
  for (let i = startDay - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month, -i), currentMonth: false });
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), currentMonth: true });
  }
  // trailing
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), currentMonth: false });
  }
  return cells;
}
