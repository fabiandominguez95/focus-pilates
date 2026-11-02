import React, { useMemo, useState } from 'react';
import { useApp } from './store';
import { Sheet, Field } from './ui';
import { fmtDate, gs, monthLabel, monthOf, num } from './util';

// «Cuenta con los dueños»: lo que la empresa le debe a quien puso plata.
// Deuda = gastos marcados Σ (los pagó el dueño) sin reintegrar + aportes para cubrir meses − devoluciones.
export const DEUDA_DESDE = '2026-10';

export function useDeuda() {
  const { d, cfg, ins, upd, hoy, toast } = useApp(); const desde = cfg.deuda_desde || DEUDA_DESDE;
  const pend = useMemo(() => (d.egresos || []).filter((e: any) => e.suma && e.pagado && !e.reintegrado && e.mes >= desde && Number(e.monto) > 0).sort((a: any, b: any) => a.mes.localeCompare(b.mes)), [d.egresos, desde]);
  const movs = useMemo(() => [...(d.aportes || [])].sort((a: any, b: any) => (b.fecha || '').localeCompare(a.fecha || '')), [d.aportes]);
  const sum = (a: any[]) => a.reduce((t: number, x: any) => t + (Number(x.monto) || 0), 0);
  const gastos = sum(pend); const aportes = sum(movs.filter((x: any) => x.tipo === 'aporte')); const devol = sum(movs.filter((x: any) => x.tipo === 'devolucion'));
  const total = gastos + aportes - devol;
  const reintegrar = async (e: any, v: boolean) => { try { await upd('egresos', e.id, { reintegrado: v, reintegrado_fecha: v ? hoy : null }); toast(v ? 'Anotado: te lo devolvieron' : 'Vuelve a pendiente'); } catch (er: any) { toast('Error: ' + er.message); } };
  const addMov = async (tipo: 'aporte' | 'devolucion', monto: number, mes: string, nota: string) => { try { await ins('aportes', { tipo, monto, mes: mes || null, nota: nota || null, fecha: hoy }); toast(tipo === 'aporte' ? 'Aporte anotado' : 'Devolución anotada'); } catch (er: any) { toast('Error: ' + er.message); } };
  const delMov = async (id: string) => { try { await upd('aportes', id, { deleted_at: new Date().toISOString() }); toast('Movimiento quitado'); } catch (er: any) { toast('Error: ' + er.message); } };
  return { desde, pend, movs, gastos, aportes, devol, total, reintegrar, addMov, delMov };
}

export function DeudaCard({ m }: { m: string }) {
  const dd = useDeuda(); const [open, setOpen] = useState(false);
  if (!dd.pend.length && !dd.movs.length) return (<section className="box"><div className="sec-head"><h3>Cuenta con vos</h3><button className="btn sm ghost" onClick={() => setOpen(true)}>Registrar</button></div><div className="muted small">La empresa no te debe nada por ahora. Marcá con Σ los gastos que pagás vos, o registrá un aporte.</div>{open && <DeudaSheet m={m} onClose={() => setOpen(false)} />}</section>);
  return (
    <section className="box">
      <div className="sec-head"><h3>Cuenta con vos</h3><button className="btn sm ghost" onClick={() => setOpen(true)}>Ver detalle</button></div>
      <div className={'cob-t ' + (dd.total > 0 ? 'neg' : 'pos')}>{dd.total > 0 ? `La empresa te debe ${gs(dd.total)}` : dd.total < 0 ? `Le devolvieron de más: ${gs(-dd.total)}` : '✓ Estás al día'}</div>
      <div className="kv"><span>Gastos que pagaste vos y no te devolvieron ({dd.pend.length})</span><b>{gs(dd.gastos)}</b></div>
      <div className="kv"><span>Aportes tuyos para cubrir meses</span><b>{gs(dd.aportes)}</b></div>
      {dd.devol > 0 && <div className="kv"><span>Devoluciones recibidas</span><b>− {gs(dd.devol)}</b></div>}
      <div className="muted small">Cuenta desde {monthLabel(dd.desde)}. No afecta el balance del mes: es plata tuya que la empresa te debe.</div>
      {open && <DeudaSheet m={m} onClose={() => setOpen(false)} />}
    </section>
  );
}

export function DeudaSheet({ m, onClose }: { m: string; onClose: () => void }) {
  const dd = useDeuda(); const { hoy } = useApp();
  const [tipo, setTipo] = useState<'aporte' | 'devolucion'>('devolucion'); const [monto, setMonto] = useState(''); const [mes, setMes] = useState(m); const [nota, setNota] = useState('');
  return (
    <Sheet title="Cuenta con vos" onClose={onClose} wide>
      <div className="stack">
        <div className="box big-total"><span>La empresa te debe</span><b>{gs(dd.total)}</b></div>
        <h3>Gastos que pagaste vos ({dd.pend.length})</h3>
        {dd.pend.length === 0 && <div className="muted small">Ninguno pendiente. Marcá el gasto con Σ y con ✓ pagado en «Egresos del mes» cuando lo pagues vos.</div>}
        {dd.pend.map((e: any) => <div className="kv" key={e.id}><span><b>{e.concepto}</b><br /><small className="muted">{monthLabel(e.mes)}</small></span><span className="row" style={{ gap: 8, alignItems: 'center' }}><b>{gs(e.monto)}</b><button className="btn sm ghost" onClick={() => dd.reintegrar(e, true)}>Me lo devolvieron</button></span></div>)}
        <h3>Aportes y devoluciones</h3>
        {dd.movs.length === 0 && <div className="muted small">Sin movimientos.</div>}
        {dd.movs.map((x: any) => <div className="kv" key={x.id}><span><b>{x.tipo === 'aporte' ? 'Aporte' : 'Devolución'}</b>{x.mes ? ` · ${monthLabel(x.mes)}` : ''}<br /><small className="muted">{fmtDate(x.fecha)}{x.nota ? ' · ' + x.nota : ''}</small></span><span className="row" style={{ gap: 8, alignItems: 'center' }}><b>{x.tipo === 'aporte' ? '+' : '−'} {gs(x.monto)}</b><button className="x2" aria-label="Quitar" onClick={() => dd.delMov(x.id)}>✕</button></span></div>)}
        <div className="box stack">
          <b>Registrar movimiento</b>
          <div className="chips"><button className={'chip' + (tipo === 'devolucion' ? ' on' : '')} onClick={() => setTipo('devolucion')}>Me devolvieron plata</button><button className={'chip' + (tipo === 'aporte' ? ' on' : '')} onClick={() => setTipo('aporte')}>Puse plata</button></div>
          <Field label="Monto"><input inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))} placeholder="0" /></Field>
          {tipo === 'aporte' && <Field label="Para cubrir el mes de"><input type="month" value={mes} onChange={(e) => setMes(e.target.value)} /></Field>}
          <Field label="Nota (opcional)"><input value={nota} onChange={(e) => setNota(e.target.value)} placeholder={tipo === 'aporte' ? 'Ej: cerró octubre en negativo' : 'Ej: transferencia del 5/11'} /></Field>
          <button className="btn" disabled={!Number(monto)} onClick={async () => { await dd.addMov(tipo, Number(monto), tipo === 'aporte' ? mes : monthOf(hoy), nota.trim()); setMonto(''); setNota(''); }}>Guardar</button>
          <div className="muted small">Si te devuelven un gasto puntual (internet, pautas…), usá «Me lo devolvieron» arriba. Para plata en general, registrá una devolución.</div>
        </div>
        {dd.devol + dd.aportes > 0 && <div className="muted small">Total aportado {num(dd.aportes)} · devuelto {num(dd.devol)}.</div>}
      </div>
    </Sheet>
  );
}

export function AporteBtn({ m, falta }: { m: string; falta: number }) {
  const dd = useDeuda(); const [open, setOpen] = useState(false); const [monto, setMonto] = useState(String(Math.round(falta))); const [nota, setNota] = useState('');
  const delMes = dd.movs.filter((x: any) => x.tipo === 'aporte' && x.mes === m).reduce((t: number, x: any) => t + (Number(x.monto) || 0), 0);
  return (<>
    {delMes > 0 && <div className="kv"><span>Ya aportaste vos para {monthLabel(m)}</span><b>{gs(delMes)}</b></div>}
    {falta > 0 && <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => { setMonto(String(Math.round(falta))); setOpen(true); }}>Lo cubro yo ({gs(falta)})</button>}
    {open && <Sheet title="Cubrir el faltante" onClose={() => setOpen(false)}><div className="stack">
      <div className="muted">Anota que pusiste plata de tu bolsillo para cerrar {monthLabel(m)}. Queda en «Cuenta con vos» como deuda de la empresa.</div>
      <Field label="Monto"><input inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))} /></Field>
      <Field label="Nota (opcional)"><input value={nota} onChange={(e) => setNota(e.target.value)} /></Field>
      <button className="btn big" disabled={!Number(monto)} onClick={async () => { await dd.addMov('aporte', Number(monto), m, nota.trim() || 'Faltante del mes'); setOpen(false); }}>Anotar aporte</button></div></Sheet>}
  </>);
}
