import React, { useMemo, useState } from 'react';
import { useApp } from './store';
import { Sheet, Field } from './ui';

// «Ya no va a renovar»: certeza de que la persona no vuelve (motivo válido). Se guarda como aviso y vale solo para esa suscripción.
export const MOTIVOS = ['Se mudó', 'Salud', 'Económico', 'Horarios / tiempo', 'Viaje', 'Otro'];

export function useNoRenueva() {
  const { d, ins, upd, me, toast } = useApp();
  const map = useMemo(() => {
    const m = new Map<string, { id: string; sub: string; motivo: string }>();
    d.avisos.forEach((a: any) => { if (a.tipo !== 'no_renueva') return; const [sub, ...rest] = String(a.ref || '').split('|'); m.set(a.persona_id, { id: a.id, sub, motivo: rest.join('|') }); });
    return m;
  }, [d.avisos]);
  const marcado = (personaId: string, sub: any) => { const x = map.get(personaId); return !!x && !!sub && x.sub === sub.id ? x : null; };
  const marcar = async (p: any, sub: any, motivo: string) => { try { await ins('avisos', { persona_id: p.id, tipo: 'no_renueva', ref: sub.id + '|' + motivo, usuario: me?.nick }); toast('Anotado: no va a renovar'); } catch (e: any) { toast('Error: ' + e.message); } };
  const deshacer = async (personaId: string) => { try { for (const a of d.avisos.filter((a: any) => a.persona_id === personaId && a.tipo === 'no_renueva')) await upd('avisos', a.id, { deleted_at: new Date().toISOString() }); toast('Vuelve a la lista'); } catch (e: any) { toast('Error: ' + e.message); } };
  return { map, marcado, marcar, deshacer };
}

export function NoRenuevaSheet({ p, sub, onClose }: { p: any; sub: any; onClose: () => void }) {
  const { marcar } = useNoRenueva(); const [mot, setMot] = useState(MOTIVOS[0]); const [otro, setOtro] = useState('');
  const motivo = mot === 'Otro' ? (otro.trim() || 'Otro') : mot;
  return (
    <Sheet title={`${p.nombre} · no va a renovar`} onClose={onClose}>
      <div className="stack">
        <div className="muted">Ya avisó que no vuelve. Sale de Seguimiento y del estimado de renovaciones. Si más adelante renueva, vuelve a aparecer sola.</div>
        <Field label="Motivo"><select value={mot} onChange={(e) => setMot(e.target.value)}>{MOTIVOS.map((m) => <option key={m}>{m}</option>)}</select></Field>
        {mot === 'Otro' && <Field label="¿Cuál?"><input value={otro} onChange={(e) => setOtro(e.target.value)} placeholder="Opcional" /></Field>}
        <button className="btn big" onClick={async () => { await marcar(p, sub, motivo); onClose(); }}>Confirmar: no va a renovar</button>
      </div>
    </Sheet>
  );
}
