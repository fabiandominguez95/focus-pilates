import React, { useMemo, useState } from 'react';
import { useApp } from './store';
import { Sheet } from './ui';
import { fmtDate } from './util';

// Promo de reactivación: se registra (solo admin) si se le ofreció al invitarla a volver, y si la usó al inscribirse.
export function usePromo() {
  const { d, ins, upd, me, hoy, toast, isAdmin } = useApp();
  const map = useMemo(() => {
    const m = new Map<string, { ofrecida?: any; usada?: any }>();
    d.avisos.forEach((a: any) => { if (a.tipo !== 'promo_ofrecida' && a.tipo !== 'promo_usada') return; const x = m.get(a.persona_id) || {}; if (a.tipo === 'promo_ofrecida') x.ofrecida = a; else x.usada = a; m.set(a.persona_id, x); });
    return m;
  }, [d.avisos]);
  const get = (id: string) => map.get(id) || {};
  const ofrecer = async (p: any) => { if (get(p.id).ofrecida) return; try { await ins('avisos', { persona_id: p.id, tipo: 'promo_ofrecida', ref: hoy, usuario: me?.nick }); } catch (e: any) { toast('Error: ' + e.message); } };
  const quitar = async (p: any) => { try { for (const a of d.avisos.filter((a: any) => a.persona_id === p.id && (a.tipo === 'promo_ofrecida' || a.tipo === 'promo_usada'))) await upd('avisos', a.id, { deleted_at: new Date().toISOString() }); toast('Ofrecimiento de promo quitado'); } catch (e: any) { toast('Error: ' + e.message); } };
  const usada = async (p: any, subId: string) => { try { await ins('avisos', { persona_id: p.id, tipo: 'promo_usada', ref: subId, usuario: me?.nick }); } catch { /* */ } };
  return { map, get, ofrecer, quitar, usada, isAdmin };
}

export function PromoBadge({ id }: { id: string }) {
  const { get, isAdmin } = usePromo(); const x = get(id);
  if (!isAdmin || !x.ofrecida) return null;
  return <span className="badge promo" title={'Se le ofreció promo el ' + fmtDate(x.ofrecida.ref)}>{x.usada ? '🎁 Usó la promo' : '🎁 Ya tuvo promo'}</span>;
}

// Pregunta rápida antes de abrir WhatsApp (solo admin)
export function PromoAsk({ p, onChoose, onClose }: { p: any; onChoose: (conPromo: boolean) => void; onClose: () => void }) {
  const { get } = usePromo(); const x = get(p.id);
  return (
    <Sheet title={`Invitar a ${p.nombre}`} onClose={onClose}>
      <div className="stack">
        {x.ofrecida && <div className="muted">🎁 Ya se le ofreció promo el {fmtDate(x.ofrecida.ref)}.</div>}
        <div><b>¿Le ofrecés promo?</b><div className="muted small">Solo queda anotado para que lo veas después; no hace falta decir cuál.</div></div>
        <button className="btn big" onClick={() => onChoose(true)}>Sí, con promo</button>
        <button className="btn big ghost" onClick={() => onChoose(false)}>No, sin promo</button>
      </div>
    </Sheet>
  );
}

// Nota breve (motivo de baneo / de no contactar)
export function NotaSheet({ title, value, onSave, onClose, hint }: { title: string; value: string; onSave: (v: string) => void | Promise<any>; onClose: () => void; hint?: string }) {
  const [v, setV] = useState(value || '');
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="stack">
        {hint && <div className="muted small">{hint}</div>}
        <textarea rows={4} value={v} autoFocus onChange={(e) => setV(e.target.value)} placeholder="Motivo (opcional)" />
        <button className="btn big" onClick={async () => { await onSave(v.trim()); onClose(); }}>Guardar</button>
      </div>
    </Sheet>
  );
}
