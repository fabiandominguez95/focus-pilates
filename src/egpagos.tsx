import React, { useState } from 'react';
import { useApp } from './store';
import { Sheet, Field } from './ui';
import { fmtDate, gs } from './util';

export const pagosDe = (d: any, id: string) => (d.egpagos || []).filter((p: any) => p.egreso_id === id);
export const pagadoParcial = (d: any, id: string) => pagosDe(d, id).reduce((a: number, p: any) => a + (Number(p.monto) || 0), 0);
export const restante = (d: any, e: any) => e.pagado ? 0 : Math.max(0, (Number(e.monto) || 0) - pagadoParcial(d, e.id));

// Pago parcial de un egreso: se puede ir pagando en cuotas; el egreso queda en su mes con su monto fijo.
export function PagoParcialSheet({ e, onClose }: { e: any; onClose: () => void }) {
  const { d, hoy, ins, upd, toast } = useApp(); const hechos = pagosDe(d, e.id).sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
  const pagado = pagadoParcial(d, e.id); const falta = Math.max(0, (Number(e.monto) || 0) - pagado);
  const [monto, setMonto] = useState(String(falta)); const [nota, setNota] = useState(''); const [busy, setBusy] = useState(false);
  const guardar = async () => { if (busy) return; setBusy(true); try {
    const n = Math.min(Number(monto), falta); await ins('egpagos', { egreso_id: e.id, fecha: hoy, monto: n, nota: nota.trim() || null });
    if (pagado + n >= (Number(e.monto) || 0)) await upd('egresos', e.id, { pagado: true, pagado_fecha: hoy });
    toast(pagado + n >= (Number(e.monto) || 0) ? 'Pagado completo' : 'Pago parcial anotado'); onClose();
  } catch (er: any) { toast('Error: ' + er.message); } finally { setBusy(false); } };
  const quitar = async (p: any) => { try { await upd('egpagos', p.id, { deleted_at: new Date().toISOString() }); if (e.pagado) await upd('egresos', e.id, { pagado: false, pagado_fecha: null }); toast('Pago quitado'); } catch (er: any) { toast('Error: ' + er.message); } };
  return (
    <Sheet title={e.concepto} onClose={onClose}>
      <div className="stack">
        <div className="kv"><span>Total del egreso</span><b>{gs(e.monto)}</b></div>
        <div className="kv"><span>Ya pagado</span><b>{gs(pagado)}</b></div>
        <div className="kv total neg"><span>Resta pagar</span><b>{gs(falta)}</b></div>
        {hechos.map((p: any) => <div className="kv small" key={p.id}><span>{fmtDate(p.fecha)}{p.nota ? ' · ' + p.nota : ''}</span><span className="row" style={{ gap: 8, alignItems: 'center' }}><b>{gs(p.monto)}</b><button className="x2" aria-label="Quitar" onClick={() => quitar(p)}>✕</button></span></div>)}
        {falta > 0 && <>
          <Field label="Cuánto pagás ahora"><input inputMode="numeric" value={monto ? Number(monto).toLocaleString('es-PY') : ''} onChange={(ev) => setMonto(ev.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Nota (opcional)"><input value={nota} onChange={(ev) => setNota(ev.target.value)} /></Field>
          <button className="btn big" disabled={!Number(monto) || busy} onClick={guardar}>Registrar pago</button>
          <div className="muted small">Lo que no pagues ahora queda como arrastre en el mes siguiente, sin cambiar el monto de este mes.</div></>}
      </div>
    </Sheet>
  );
}
