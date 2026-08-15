'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const fmt = (n) => '$' + Math.abs(Math.round(n)).toLocaleString('es-AR');
const fmtDate = (iso) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

export default function Home() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('*, event_attendees(member_id), event_expenses(amount)')
      .order('created_at', { ascending: false })
      .limit(30);

    const enriched = (data || []).map((e) => ({
      ...e,
      attendeeCount: e.event_attendees?.length || 0,
      total: (e.event_expenses || []).reduce(
        (s, x) => s + parseFloat(x.amount || 0),
        0
      ),
    }));
    setEvents(enriched);
    setLoading(false);
  };

  const createEvent = async () => {
    setCreating(true);
    const { data: event, error } = await supabase
      .from('events')
      .insert({ date: new Date().toISOString().slice(0, 10) })
      .select()
      .single();

    if (error || !event) {
      setCreating(false);
      alert('Error al crear evento');
      return;
    }

    const { data: members } = await supabase
      .from('members')
      .select('id')
      .eq('is_default', true);

    if (members?.length) {
      await supabase
        .from('event_attendees')
        .insert(members.map((m) => ({ event_id: event.id, member_id: m.id })));
    }

    router.push(`/evento/${event.id}`);
  };

  return (
    <div className="pb-10">
      <div className="pt-10 pb-6 text-center">
        <div className="text-5xl mb-3">🍷</div>
        <h1 className="text-3xl font-bold tracking-tight text-stone-800">Mesa de Galanes</h1>
        <p className="text-stone-400 text-sm mt-1">La Cuenta</p>
      </div>

      <div className="px-4">
        <button
          onClick={createEvent}
          disabled={creating}
          className="w-full bg-amber-600 hover:bg-amber-500 active:bg-amber-700
                     disabled:opacity-50 text-white font-semibold py-4 rounded-2xl
                     text-lg transition shadow-lg shadow-amber-600/20"
        >
          {creating ? 'Creando…' : '🍽️ Nueva Cena'}
        </button>
      </div>

      {loading ? (
        <div className="text-center text-stone-400 mt-12">Cargando…</div>
      ) : events.length > 0 ? (
        <div className="mt-8 px-4">
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
            Últimas cenas
          </h2>
          <div className="space-y-2">
            {events.map((ev) => (
              <button
                key={ev.id}
                onClick={() => router.push(`/evento/${ev.id}`)}
                className="w-full bg-white hover:bg-stone-50 rounded-xl
                           p-4 text-left transition shadow-sm border border-stone-200"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm text-stone-400">
                      {fmtDate(ev.date)}
                    </div>
                    <div className="text-stone-700 text-lg font-medium">
                      {ev.attendeeCount} personas
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-lg">{fmt(ev.total)}</div>
                    {ev.attendeeCount > 0 && ev.total > 0 && (
                      <div className="text-sm text-stone-400">
                        {fmt(ev.total / ev.attendeeCount)} c/u
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center text-stone-400 mt-12">
          Creá la primera cena para empezar
        </div>
      )}
    </div>
  );
}
