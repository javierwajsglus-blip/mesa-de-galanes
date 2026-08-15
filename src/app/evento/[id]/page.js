'use client';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const fmt = (n) => '$' + Math.abs(Math.round(n)).toLocaleString('es-AR');
const fmtDate = (iso) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

function Tab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition ${
        active
          ? 'bg-amber-600 text-white shadow'
          : 'text-stone-400 hover:text-stone-600'
      }`}
    >
      {label}
    </button>
  );
}

export default function EventPage() {
  const { id: eventId } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [members, setMembers] = useState([]);
  const [attendeeIds, setAttendeeIds] = useState(new Set());
  const [expenses, setExpenses] = useState({});
  const [expInputs, setExpInputs] = useState({});
  const [tab, setTab] = useState('gastos');
  const [newName, setNewName] = useState('');
  const [toast, setToast] = useState('');

  const savingRef = useRef(new Set());

  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }, []);

  useEffect(() => {
    (async () => {
      const [{ data: ev }, { data: mems }, { data: atts }, { data: exps }] =
        await Promise.all([
          supabase.from('events').select('*').eq('id', eventId).single(),
          supabase.from('members').select('*').order('created_at'),
          supabase.from('event_attendees').select('member_id').eq('event_id', eventId),
          supabase.from('event_expenses').select('member_id, amount').eq('event_id', eventId),
        ]);

      setEvent(ev);
      setMembers(mems || []);
      setAttendeeIds(new Set((atts || []).map((a) => a.member_id)));

      const expMap = {};
      const inputMap = {};
      (exps || []).forEach((e) => {
        expMap[e.member_id] = parseFloat(e.amount);
        inputMap[e.member_id] = String(parseFloat(e.amount));
      });
      setExpenses(expMap);
      setExpInputs(inputMap);
      setLoading(false);
    })();
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`evt-${eventId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'event_attendees',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT')
          setAttendeeIds((p) => new Set([...p, payload.new.member_id]));
        else if (payload.eventType === 'DELETE')
          setAttendeeIds((p) => { const n = new Set(p); n.delete(payload.old.member_id); return n; });
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'event_expenses',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const mid = payload.new.member_id;
          if (savingRef.current.has(mid)) return;
          const amt = parseFloat(payload.new.amount);
          setExpenses((p) => ({ ...p, [mid]: amt }));
          setExpInputs((p) => ({ ...p, [mid]: String(amt) }));
        } else if (payload.eventType === 'DELETE') {
          const mid = payload.old.member_id;
          setExpenses((p) => { const n = { ...p }; delete n[mid]; return n; });
          setExpInputs((p) => { const n = { ...p }; delete n[mid]; return n; });
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'members' }, (payload) => {
        setMembers((p) => p.some((m) => m.id === payload.new.id) ? p : [...p, payload.new]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  const toggleAttendee = async (memberId) => {
    if (attendeeIds.has(memberId)) {
      setAttendeeIds((p) => { const n = new Set(p); n.delete(memberId); return n; });
      await supabase.from('event_attendees').delete().eq('event_id', eventId).eq('member_id', memberId);
      await supabase.from('event_expenses').delete().eq('event_id', eventId).eq('member_id', memberId);
      setExpenses((p) => { const n = { ...p }; delete n[memberId]; return n; });
      setExpInputs((p) => { const n = { ...p }; delete n[memberId]; return n; });
    } else {
      setAttendeeIds((p) => new Set([...p, memberId]));
      await supabase.from('event_attendees').insert({ event_id: eventId, member_id: memberId });
    }
  };

  const onExpenseChange = (memberId, val) => {
    setExpInputs((p) => ({ ...p, [memberId]: val }));
    const num = parseFloat(val.replace(',', '.')) || 0;
    setExpenses((p) => { const n = { ...p }; if (num > 0) n[memberId] = num; else delete n[memberId]; return n; });
  };

  const saveExpense = async (memberId) => {
    const amount = expenses[memberId] || 0;
    savingRef.current.add(memberId);
    try {
      if (amount > 0)
        await supabase.from('event_expenses').upsert({ event_id: eventId, member_id: memberId, amount }, { onConflict: 'event_id,member_id' });
      else
        await supabase.from('event_expenses').delete().eq('event_id', eventId).eq('member_id', memberId);
    } finally {
      setTimeout(() => savingRef.current.delete(memberId), 500);
    }
  };

  const addGuest = async () => {
    const name = newName.trim();
    if (!name) return;
    if (members.some((m) => m.name.toLowerCase() === name.toLowerCase())) return;
    const { data: member } = await supabase.from('members').insert({ name, is_default: false }).select().single();
    if (member) {
      setMembers((p) => [...p, member]);
      setAttendeeIds((p) => new Set([...p, member.id]));
      await supabase.from('event_attendees').insert({ event_id: eventId, member_id: member.id });
    }
    setNewName('');
  };

  const attendeeList = members.filter((m) => attendeeIds.has(m.id));

  const total = useMemo(() =>
    Object.entries(expenses).filter(([id]) => attendeeIds.has(id)).reduce((s, [, a]) => s + a, 0),
    [expenses, attendeeIds]);

  const perPerson = attendeeIds.size > 0 ? total / attendeeIds.size : 0;

  const settlement = useMemo(() =>
    attendeeList.map((m) => ({
      id: m.id, name: m.name, paid: expenses[m.id] || 0,
      share: perPerson, balance: (expenses[m.id] || 0) - perPerson,
    })).sort((a, b) => b.balance - a.balance),
    [attendeeList, expenses, perPerson]);

  const transfers = useMemo(() => {
    const creds = settlement.filter((s) => s.balance > 0.5).map((s) => ({ ...s, rem: s.balance }));
    const debts = settlement.filter((s) => s.balance < -0.5).map((s) => ({ ...s, rem: -s.balance }));
    const res = [];
    let ci = 0, di = 0;
    while (ci < creds.length && di < debts.length) {
      const amt = Math.min(creds[ci].rem, debts[di].rem);
      if (amt > 0.5) res.push({ from: debts[di].name, to: creds[ci].name, amount: amt });
      creds[ci].rem -= amt; debts[di].rem -= amt;
      if (creds[ci].rem < 0.5) ci++; if (debts[di].rem < 0.5) di++;
    }
    return res;
  }, [settlement]);

  const shareLink = async () => {
    const url = window.location.href;
    try { await navigator.share?.({ title: 'Mesa de Galanes', url }); }
    catch {
      try { await navigator.clipboard.writeText(url); }
      catch { const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
      flash('Link copiado');
    }
  };

  const copySettlement = async () => {
    let text = `🍷 Mesa de Galanes — ${event?.date ? fmtDate(event.date) : 'Hoy'}\n`;
    text += `Total: ${fmt(total)} · ${attendeeIds.size} personas · Cuota: ${fmt(perPerson)}\n\n`;
    settlement.forEach((s) => {
      const tag = s.balance > 0.5 ? `✅ Recibe ${fmt(s.balance)}` : s.balance < -0.5 ? `❌ Pone ${fmt(-s.balance)}` : '☑️ Justo';
      text += `${s.name}: ${s.paid > 0 ? `gastó ${fmt(s.paid)}` : 'no compró'} → ${tag}\n`;
    });
    if (transfers.length > 0) {
      text += `\n💸 Transferencias:\n`;
      transfers.forEach((t) => { text += `  ${t.from} ➜ ${t.to}: ${fmt(t.amount)}\n`; });
    }
    try { await navigator.clipboard.writeText(text); }
    catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
    flash('Resumen copiado');
  };

  const deleteEvent = async () => {
    if (!confirm('¿Eliminar este evento?')) return;
    await supabase.from('events').delete().eq('id', eventId);
    router.push('/');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-stone-400">Cargando evento…</div>;
  if (!event) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-stone-400">
      <p>Evento no encontrado</p>
      <button onClick={() => router.push('/')} className="text-amber-600 font-medium">← Volver</button>
    </div>
  );

  return (
    <div className="min-h-screen pb-10">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-stone-800 text-white px-4 py-2 rounded-full text-sm shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-stone-100/95 backdrop-blur-sm border-b border-stone-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-stone-400 hover:text-stone-700 text-lg w-8">←</button>
          <div className="text-center flex-1">
            <div className="font-semibold text-stone-800">🍷 Mesa de Galanes</div>
            <div className="text-xs text-stone-400">{event.date ? fmtDate(event.date) : 'Hoy'}</div>
          </div>
          <button onClick={shareLink} className="text-stone-400 hover:text-amber-600 text-sm font-medium">Compartir</button>
        </div>
        <div className="flex gap-1 mt-3 bg-stone-200 rounded-xl p-1">
          <Tab label={`👥 ${attendeeIds.size}`} active={tab === 'asistentes'} onClick={() => setTab('asistentes')} />
          <Tab label="💰 Gastos" active={tab === 'gastos'} onClick={() => setTab('gastos')} />
          <Tab label="📊 Resultado" active={tab === 'resultado'} onClick={() => setTab('resultado')} />
        </div>
      </div>

      {/* TAB: ASISTENTES */}
      {tab === 'asistentes' && (
        <div className="p-4">
          <p className="text-sm text-stone-400 mb-4">Marcá quiénes están en la cena de hoy</p>
          <div className="space-y-2 mb-5">
            {members.map((m) => {
              const on = attendeeIds.has(m.id);
              return (
                <button key={m.id} onClick={() => toggleAttendee(m.id)}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 transition border ${
                    on ? 'bg-amber-50 border-amber-300' : 'bg-white border-stone-200 hover:border-stone-300'
                  }`}>
                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center text-sm transition ${
                    on ? 'border-amber-500 bg-amber-500 text-white' : 'border-stone-300'
                  }`}>{on && '✓'}</div>
                  <span className={`text-lg font-medium ${on ? 'text-stone-800' : 'text-stone-400'}`}>{m.name}</span>
                  {!m.is_default && <span className="text-xs text-stone-400 ml-auto">Invitado</span>}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addGuest()}
              placeholder="Agregar invitado…"
              className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-base
                         text-stone-800 placeholder-stone-300 focus:outline-none focus:border-amber-400 transition" />
            <button onClick={addGuest} disabled={!newName.trim()}
              className="bg-stone-200 hover:bg-stone-300 disabled:opacity-30 text-stone-600 px-4 rounded-xl text-sm font-bold transition">+</button>
          </div>
        </div>
      )}

      {/* TAB: GASTOS */}
      {tab === 'gastos' && (
        <div className="p-4">
          <p className="text-sm text-stone-400 mb-4">Cada uno carga lo que gastó. Dejá en blanco si no compraste nada.</p>
          {attendeeList.length === 0 ? (
            <div className="text-center py-12 text-stone-400">
              <p>No hay asistentes</p>
              <button onClick={() => setTab('asistentes')} className="text-amber-600 font-medium mt-2">Agregar →</button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {attendeeList.map((m) => (
                  <div key={m.id} className="bg-white rounded-xl px-4 py-3 border border-stone-200 shadow-sm">
                    <label className="text-lg font-medium text-stone-700 mb-1 block">{m.name}</label>
                    <div className="flex items-center gap-1">
                      <span className="text-stone-400 text-xl">$</span>
                      <input type="text" inputMode="decimal"
                        value={expInputs[m.id] || ''}
                        onChange={(e) => onExpenseChange(m.id, e.target.value)}
                        onBlur={() => saveExpense(m.id)}
                        placeholder="0"
                        className="flex-1 bg-transparent text-2xl font-semibold text-stone-800 focus:outline-none placeholder-stone-300" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 bg-white rounded-2xl p-5 text-center border border-stone-200 shadow-sm">
                <div className="text-xs text-stone-400 uppercase tracking-wider">Total gastado</div>
                <div className="text-4xl font-bold text-amber-600 mt-1">{fmt(total)}</div>
                {attendeeIds.size > 0 && total > 0 && (
                  <div className="text-sm text-stone-400 mt-1">{fmt(perPerson)} por persona</div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB: RESULTADO */}
      {tab === 'resultado' && (
        <div className="p-4">
          {total === 0 ? (
            <div className="text-center py-12 text-stone-400">
              <p>No hay gastos cargados todavía</p>
              <button onClick={() => setTab('gastos')} className="text-amber-600 font-medium mt-2">Cargar gastos →</button>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl p-4 mb-4 grid grid-cols-3 text-center gap-2 border border-stone-200 shadow-sm">
                <div>
                  <div className="text-[11px] text-stone-400 uppercase tracking-wide">Total</div>
                  <div className="text-lg font-bold text-amber-600">{fmt(total)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-stone-400 uppercase tracking-wide">Personas</div>
                  <div className="text-lg font-bold text-stone-700">{attendeeIds.size}</div>
                </div>
                <div>
                  <div className="text-[11px] text-stone-400 uppercase tracking-wide">Cuota</div>
                  <div className="text-lg font-bold text-amber-600">{fmt(perPerson)}</div>
                </div>
              </div>

              <div className="space-y-2 mb-5">
                {settlement.map((s) => (
                  <div key={s.id} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between gap-2 border border-stone-200 shadow-sm">
                    <div className="min-w-0">
                      <div className="text-lg font-medium truncate text-stone-800">{s.name}</div>
                      <div className="text-sm text-stone-400">{s.paid > 0 ? `Gastó ${fmt(s.paid)}` : 'No compró'}</div>
                    </div>
                    <div className={`text-right font-semibold whitespace-nowrap ${
                      s.balance > 0.5 ? 'text-emerald-600' : s.balance < -0.5 ? 'text-rose-500' : 'text-stone-400'
                    }`}>
                      {s.balance > 0.5 ? `Recibe ${fmt(s.balance)}` : s.balance < -0.5 ? `Pone ${fmt(-s.balance)}` : 'Justo'}
                    </div>
                  </div>
                ))}
              </div>

              {transfers.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Transferencias</h3>
                  <div className="space-y-2">
                    {transfers.map((t, i) => (
                      <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
                        <div className="text-sm">
                          <span className="font-medium text-stone-700">{t.from}</span>
                          <span className="text-stone-400 mx-1">→</span>
                          <span className="font-medium text-stone-700">{t.to}</span>
                        </div>
                        <div className="font-semibold text-amber-600">{fmt(t.amount)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={copySettlement}
                className="w-full bg-white hover:bg-stone-50 text-stone-600 font-medium py-3 rounded-xl transition
                           flex items-center justify-center gap-2 border border-stone-200 shadow-sm">
                📋 Copiar resumen para WhatsApp
              </button>
            </>
          )}

          <button onClick={deleteEvent} className="w-full mt-8 text-stone-300 hover:text-rose-500 text-sm py-2 transition">
            Eliminar este evento
          </button>
        </div>
      )}
    </div>
  );
}
