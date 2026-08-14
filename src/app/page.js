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

    // Agregar todos los miembros habituales como asistentes
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
      {/* Header */}
      <div className="pt-10 pb-6 text-center">
        <div className="text-5xl mb-3">🍷</div>
        <h1 className="text-3xl font-bold tracking-tight">Mesa de Galanes</h1>
        <p className="text-neutral-500 text-sm mt-1">
          La Cuenta
        </p>
      </div>

      {/* CTA */}
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

      {/* Historial */}
      {loading ? (
        <div className="text-center text-neutral-600 mt-12">Cargando…</div>
      ) : events.length > 0 ? (
        <div className="mt-8 px-4">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
            Últimas cenas
          </h2>
          <div className="space-y-2">
            {events.map((ev) => (
              <button
                key={ev.id}
                onClick={() => router.push(`/evento/${ev.id}`)}
                className="w-full bg-neutral-900 hover:bg-neutral-800 rounded-xl
                           p-4 text-left transition"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm text-neutral-400">
                      {fmtDate(ev.date)}
                    </div>
                    <div className="text-neutral-300">
                      {ev.attendeeCount} personas
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{fmt(ev.total)}</div>
                    {ev.attendeeCount > 0 && ev.total > 0 && (
                      <div className="text-sm text-neutral-500">
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
        <div className="text-center text-neutral-600 mt-12">
          Creá la primera cena para empezar
        </div>
      )}
    </div>
  );
}
