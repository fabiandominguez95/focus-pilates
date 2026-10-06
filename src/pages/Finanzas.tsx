import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { Sheet, Field, Progress, useConfirm } from '../ui';
import { resumenMes, ultimoSaldo, salario, allMonths } from '../fin';
import { addMonthKey, diasHabilesMes, feriados, fmtDate, gs, monthLabel, monthOf, num, timeToMin, uid, daysInMonth, parseD, DIAS3, hm } from '../util';
import { buildIndex } from '../logic';

function NumInput({ value, onSave, disabled, className }: { value: any; onSave: (n: number) => void; disabled?: boolean; className?: string }) {
  const [v, setV] = useState(String(Math.round(Number(value) || 0))); useEffect(() => setV(String(Math.round(Number(value) || 0))), [value]);
  return <input className={'num ' + (className || '')} disabled={disabled} inputMode="numeric" value={v === '0' ? '0' : Number(v).toLocaleString('es-PY')} onFocus={(e) => e.target.select()}
    onChange={(e) => setV(e.target.value.replace(/\D/g, '') || '0')} onBlur={() => { if (Number(v) !== Math.round(Number(value) || 0)) onSave(Number(v)); }} />;
}

export function useHorasEstimadas(m: string) {
  const { d } = useApp();
  return useMemo(() => {
    const fija = d.profesoras.find((p: any) => p.tipo === 'fija')?.id; const per: Record<string, Set<string>> = {};
    d.clases.forEach((c: any) => { if (!c.fecha.startsWith(m) || !(c.estado === 'agendada' || c.estado === 'asistio')) return; const pid = c.profesora_id || fija; (per[pid] ||= new Set()).add(c.fecha + c.hora); });
    const out: Record<string, number> = {}; Object.keys(per).forEach((k) => (out[k] = per[k].size)); return out;
  }, [d.clases, d.profesoras, m]);
}

export function SalarioCalc({ m, onApply, cerrado }: { m: string; onApply?: (total: number, detalle: any, dias: number) => void; cerrado?: boolean }) {
  const { d, cfg, toast } = useApp(); const est = useHorasEstimadas(m);
  const [fer, setFer] = useState<{ list: [string, string][]; fuente: string }>({ list: [], fuente: '' });
  useEffect(() => { feriados(m.slice(0, 4), cfg.pais).then((r) => setFer({ ...r, list: r.list.filter(([f]) => f.startsWith(m)) })); }, [m, cfg.pais]);
  const cierre = d.cierres.find((c: any) => c.mes === m);
  const sugeridos = diasHabilesMes(m, cfg.dias_habiles_semana, fer.list.map((x) => x[0]));
  const [dias, setDias] = useState<string>(cierre?.dias_habiles ? String(cierre.dias_habiles) : ''); const diasN = Number(dias) || sugeridos;
  const horasDia = (timeToMin(cfg.cierre) - timeToMin(cfg.apertura)) / 60;
  const fijas = d.profesoras.filter((p: any) => p.tipo === 'fija' && p.activa !== false);
  const [horas, setHoras] = useState<Record<string, string>>({}); const [bases, setBases] = useState<Record<string, string>>({}); const [supl, setSupl] = useState('0');
  const horasDe = (id: string) => (horas[id] !== undefined ? Number(horas[id]) : cierre?.horas?.[id] ?? est[id] ?? 0);
  const baseDe = (p: any) => (bases[p.id] !== undefined ? Number(bases[p.id]) : Number(p.salario_base) || 0);
  const filas = fijas.map((p: any) => ({ p, base: baseDe(p), horas: horasDe(p.id), sal: salario(baseDe(p), diasN, horasDe(p.id), horasDia) }));
  const sup = (Number(supl) || 0) * (Number(cfg.monto_suplente) || 0);
  const total = filas.reduce((a: number, f: any) => a + f.sal, 0) + sup;
  return (
    <div className="stack">
      <div className="row2"><Field label="Días hábiles" hint={`Sugerido: ${sugeridos}`}><input inputMode="numeric" disabled={cerrado} placeholder={String(sugeridos)} value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, ''))} /></Field>
        <Field label="Horas por día" hint="horario de apertura"><input disabled value={horasDia} /></Field></div>
      {filas.map((f: any) => <div className="box" key={f.p.id}><b>{f.p.nombre}</b>
        <div className="row2"><Field label="Salario base"><input inputMode="numeric" disabled={cerrado} value={bases[f.p.id] ?? String(Math.round(f.base))} onChange={(e) => setBases({ ...bases, [f.p.id]: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field label="Horas trabajadas" hint={`Estimadas: ${est[f.p.id] || 0}`}><input inputMode="decimal" disabled={cerrado} value={horas[f.p.id] ?? String(f.horas)} onChange={(e) => setHoras({ ...horas, [f.p.id]: e.target.value.replace(/[^\d.]/g, '') })} /></Field></div>
        <div className="kv"><span>{gs(f.base)} ÷ {diasN} días ÷ {horasDia} h × {f.horas} h</span><b>{gs(f.sal)}</b></div></div>)}
      {Number(cfg.monto_suplente) > 0 || true ? <Field label={`Suplencias (cantidad) × ${gs(cfg.monto_suplente)}`}><input inputMode="numeric" disabled={cerrado} value={supl} onChange={(e) => setSupl(e.target.value.replace(/\D/g, ''))} /></Field> : null}
      <div className="box big-total"><span>Total salarios{sup ? ' + suplencias' : ''}</span><b>{gs(total)}</b></div>
      <div><b className="small">Feriados de {monthLabel(m)}</b> <span className="muted small">({fer.fuente === 'online' ? 'según calendario online' : 'lista de respaldo, verificá'}; solo recomendación)</span>
        {fer.list.length === 0 ? <div className="muted small">Sin feriados cargados para este mes.</div> : fer.list.map(([f, n]) => <div className="kv" key={f}><span>{DIAS3[parseD(f).getDay()]} {fmtDate(f)}</span><b>{n}</b></div>)}</div>
      {onApply && !cerrado && <button className="btn big" onClick={() => { if (!baseDe(fijas[0] || {}) && !sup) { toast('Falta cargar el salario base'); return; } onApply(total, { dias: diasN, horas: Object.fromEntries(filas.map((f: any) => [f.p.id, f.horas])), suplencias: Number(supl) || 0 }, diasN); }}>Aplicar a Salarios del mes</button>}
    </div>
  );
}

export default function Finanzas() {
  const { d, cfg, hoy, upd, ins, toast, isAdmin, reload } = useApp();
  const { ask, node } = useConfirm();
  const [m, setM] = useState(monthOf(hoy)); const [sum, setSum] = useState<Set<string>>(new Set()); const [add, setAdd] = useState(false); const [sim, setSim] = useState(false); const [cierre, setCierre] = useState(false); const [verPagos, setVerPagos] = useState(false); const [saldoEd, setSaldoEd] = useState(false);
  const r = useMemo(() => resumenMes(d, m), [d, m]); const cerrada = d.cierres.find((c: any) => c.mes === m)?.estado === 'cerrado';
  const idx = useMemo(() => buildIndex(d), [d]);
  const saldo = ultimoSaldo(d); const neto = (Number(saldo?.monto) || 0) - r.pend;
  const pagados = r.egr.filter((e: any) => e.pagado).length; const prog = r.egr.length ? pagados / r.egr.length : 0;
  const sumaSel = r.egr.filter((e: any) => sum.has(e.id)).reduce((a: number, e: any) => a + (Number(e.monto) || 0), 0);
  const prev3 = [1, 2, 3].map((n) => resumenMes(d, addMonthKey(m, -n))).filter((x) => x.nPagos > 0);
  const ticket = prev3.length ? prev3.reduce((a, x) => a + x.ingSubs, 0) / prev3.reduce((a, x) => a + x.nPagos, 0) : r.nPagos ? r.ingSubs / r.nPagos : 0;
  const costo = r.egresos || (prev3.length ? prev3.reduce((a, x) => a + x.egresos, 0) / prev3.length : 0);
  const equilibrio = ticket ? Math.ceil(costo / ticket) : 0;
  const lock = !isAdmin || cerrada;

  const cargarConceptos = async () => {
    const have = new Set(r.egr.map((e: any) => e.concepto)); const rows = d.conceptos.filter((c: any) => c.activo !== false && c.fijo && !have.has(c.nombre)).map((c: any) => ({ mes: m, concepto: c.nombre, tipo: c.tipo, monto: Number(c.monto_default) || 0, pagado: false, suma: c.suma !== false && c.tipo === 'general' }));
    if (!rows.length) { toast('Ya están todos los conceptos fijos'); return; } await ins('egresos', rows); toast(`${rows.length} conceptos agregados`);
  };
  const toggleSum = (id: string) => setSum((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const aplicarSalario = async (total: number, detalle: any, dias?: number) => {
    const ex = r.egr.find((e: any) => e.tipo === 'salario');
    if (ex) await upd('egresos', ex.id, { monto: Math.round(total), detalle }); else await ins('egresos', { mes: m, concepto: 'Salarios', tipo: 'salario', monto: Math.round(total), pagado: false, suma: false, detalle });
    try { const { dbUpsert } = await import('../api'); await dbUpsert('fp_cierres', { mes: m, dias_habiles: dias || detalle.dias, horas: detalle.horas }, 'mes'); await reload(); } catch { /* */ }
    toast('Salarios actualizados'); setSim(false); setCierre(false);
  };
  return (
    <div className="page">{node}
      <header className="page-head"><h1>Finanzas</h1></header>
      <div className="datebar"><button onClick={() => setM(addMonthKey(m, -1))}>‹</button><b>{monthLabel(m)}{cerrada ? ' · cerrado 🔒' : ''}</b><button onClick={() => setM(addMonthKey(m, 1))}>›</button><button className="chip" onClick={() => setM(monthOf(hoy))}>Hoy</button></div>
      <div className="kpis">
        <div className="kpi"><span>Ingresos</span><b>{gs(r.ingresos)}</b><small>{r.nPagos} pagos{r.ingVentas ? ` + ventas ${gs(r.ingVentas)}` : ''}</small></div>
        <div className="kpi"><span>Egresos</span><b>{gs(r.egresos)}</b><small>costo operativo</small></div>
        <div className={'kpi ' + (r.balance >= 0 ? 'pos' : 'neg')}><span>Balance</span><b>{gs(r.balance)}</b><small>{r.balance >= 0 ? 'ganancia' : 'pérdida'} del mes</small></div>
        <div className="kpi"><span>Equilibrio</span><b>{equilibrio} personas</b><small>ticket prom. {gs(ticket)}</small></div>
      </div>

      <section className="box">
        <div className="sec-head"><h3>Posición de cuenta</h3>{isAdmin && <button className="btn sm ghost" onClick={() => setSaldoEd(true)}>Actualizar</button>}</div>
        <div className="kv"><span>En cuenta{saldo ? ` (${fmtDate(saldo.fecha)})` : ''}</span><b>{gs(saldo?.monto || 0)}</b></div>
        <div className="kv"><span>− Egresos pendientes de {monthLabel(m)}</span><b>{gs(r.pend)}</b></div>
        <div className={'kv total ' + (neto >= 0 ? 'pos' : 'neg')}><span>Ganancia / pérdida global</span><b>{gs(neto)}</b></div>
        <div className="muted small">Es lo que tenés en cuenta menos lo que todavía falta pagar este mes.</div>
      </section>

      <section>
        <div className="sec-head"><h2>Egresos del mes</h2><span className="count">{pagados}/{r.egr.length}</span></div>
        <Progress value={prog} tone={prog === 1 ? 'full' : ''} />
        <div className="list" style={{ marginTop: 10 }}>
          {r.egr.length === 0 && <div className="muted pad">No hay egresos cargados para este mes.</div>}
          {[...r.egr].sort((a: any, b: any) => (a.tipo === 'alquiler' ? -2 : a.tipo === 'salario' ? -1 : 0) - (b.tipo === 'alquiler' ? -2 : b.tipo === 'salario' ? -1 : 0)).map((e: any) => (
            <div key={e.id} className={'egreso' + (e.pagado ? ' paid' : '')}>
              <button className={'ck' + (e.pagado ? ' on' : '')} disabled={lock} onClick={() => upd('egresos', e.id, { pagado: !e.pagado, pagado_fecha: !e.pagado ? hoy : null }).catch((er: any) => toast(er.message))} aria-label="Pagado">{e.pagado ? '✓' : ''}</button>
              <div className="grow"><b>{e.concepto}</b></div>
              <NumInput value={e.monto} disabled={lock} onSave={(n) => upd('egresos', e.id, { monto: n }).catch((er: any) => toast(er.message))} />
              {e.tipo === 'general' && <button className={'sigma' + (sum.has(e.id) ? ' on' : '')} onClick={() => toggleSum(e.id)} title="Sumar">Σ</button>}
              {isAdmin && !cerrada && <button className="x2" onClick={async () => { if (await ask(`¿Quitar "${e.concepto}" de este mes?`)) upd('egresos', e.id, { deleted_at: new Date().toISOString() }); }}>✕</button>}
            </div>))}
        </div>
        {sum.size > 0 && <div className="sumbar"><span>Suma de seleccionados ({sum.size})</span><b>{gs(sumaSel)}</b><button className="chip" onClick={() => setSum(new Set())}>Limpiar</button></div>}
        {!lock && <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}><button className="btn sm" onClick={() => setAdd(true)}>+ Agregar egreso</button><button className="btn sm ghost" onClick={cargarConceptos}>Cargar fijos del mes</button></div>}
        <div className="muted small pad">Σ marca los gastos generales que pagás vos y te reintegran: la suma queda abajo, aparte del alquiler y el salario.</div>
      </section>

      <section className="row2">
        <button className="btn ghost" onClick={() => setSim(true)}>Simulador de salario</button>
        {isAdmin && <button className="btn" onClick={() => setCierre(true)}>{cerrada ? 'Ver cierre' : 'Cerrar mes'}</button>}
      </section>

      <section><div className="sec-head"><h2>Ingresos</h2><button className="btn sm ghost" onClick={() => setVerPagos(!verPagos)}>{verPagos ? 'Ocultar' : 'Ver detalle'}</button></div>
        <div className="kv"><span>Suscripciones y clases únicas</span><b>{gs(r.ingSubs)}</b></div><div className="kv"><span>Productos</span><b>{gs(r.ingVentas)}</b></div>
        {verPagos && <div className="list">{[...r.pagos].sort((a: any, b: any) => b.pago_fecha.localeCompare(a.pago_fecha)).map((s: any) => <div className="kv" key={s.id}><span>{fmtDate(s.pago_fecha)} · {idx.personaById.get(s.persona_id)?.nombre || '—'} · {s.plan_nombre}{idx.metodoById.get(s.pago_metodo_id) ? ` · ${idx.metodoById.get(s.pago_metodo_id).nombre}` : ''}</span><b>{gs(s.pago_monto)}</b></div>)}</div>}</section>

      {add && <AddEgreso m={m} onClose={() => setAdd(false)} />}
      {sim && <Sheet title={`Simulador · ${monthLabel(m)}`} onClose={() => setSim(false)}><SalarioCalc m={m} onApply={isAdmin && !cerrada ? aplicarSalario : undefined} cerrado={false} /></Sheet>}
      {cierre && <CierreSheet m={m} cerrada={cerrada} r={r} onClose={() => setCierre(false)} aplicar={aplicarSalario} />}
      {saldoEd && <SaldoSheet onClose={() => setSaldoEd(false)} />}
    </div>
  );
}

function AddEgreso({ m, onClose }: { m: string; onClose: () => void }) {
  const { d, ins, toast } = useApp(); const have = new Set(d.egresos.filter((e: any) => e.mes === m).map((e: any) => e.concepto));
  const opts = d.conceptos.filter((c: any) => c.activo !== false && !have.has(c.nombre));
  const [nombre, setNombre] = useState(''); const [monto, setMonto] = useState(''); const [suma, setSuma] = useState(true);
  return (
    <Sheet title="Agregar egreso" onClose={onClose}><div className="stack">
      {opts.length > 0 && <div className="chips wrap">{opts.map((c: any) => <button key={c.id} className="chip" onClick={() => { setNombre(c.nombre); setMonto(String(Math.round(c.monto_default || 0))); setSuma(c.tipo === 'general'); }}>{c.nombre}</button>)}</div>}
      <Field label="Concepto"><input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
      <Field label="Monto"><input inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))} /></Field>
      <label className="check"><input type="checkbox" checked={suma} onChange={(e) => setSuma(e.target.checked)} /> Es gasto general (entra en la suma Σ)</label>
      <button className="btn big" disabled={!nombre.trim()} onClick={async () => { try { await ins('egresos', { mes: m, concepto: nombre.trim(), tipo: 'general', monto: Number(monto) || 0, pagado: false, suma }); if (!d.conceptos.some((c: any) => c.nombre.toLowerCase() === nombre.trim().toLowerCase())) await ins('conceptos', { nombre: nombre.trim(), tipo: 'general', monto_default: Number(monto) || 0, suma: true, fijo: false, activo: true, orden: 99 }).catch(() => {}); onClose(); } catch (e: any) { toast('Error: ' + e.message); } }}>Agregar</button></div></Sheet>
  );
}
function SaldoSheet({ onClose }: { onClose: () => void }) {
  const { hoy, ins, toast } = useApp(); const [v, setV] = useState(''); const [n, setN] = useState('');
  return (<Sheet title="Saldo en cuenta" onClose={onClose}><div className="stack"><Field label="Monto actual en la cuenta"><input inputMode="numeric" autoFocus value={v ? Number(v).toLocaleString('es-PY') : ''} onChange={(e) => setV(e.target.value.replace(/\D/g, ''))} /></Field><Field label="Nota (opcional)"><input value={n} onChange={(e) => setN(e.target.value)} /></Field>
    <button className="btn big" disabled={!v} onClick={async () => { try { await ins('saldos', { fecha: hoy, monto: Number(v), nota: n || null }); toast('Saldo actualizado'); onClose(); } catch (e: any) { toast('Error: ' + e.message); } }}>Guardar</button></div></Sheet>);
}
function CierreSheet({ m, cerrada, r, onClose, aplicar }: { m: string; cerrada: boolean; r: any; onClose: () => void; aplicar: (t: number, det: any, dias: number) => Promise<void> }) {
  const { d, me, upd, ins, toast, hoy, reload } = useApp(); const { ask, node } = useConfirm(); const c = d.cierres.find((x: any) => x.mes === m);
  const pendSinPagar = r.egr.filter((e: any) => !e.pagado).length;
  const cerrar = async () => {
    if (pendSinPagar && !(await ask(`Quedan ${pendSinPagar} egresos sin tildar como pagados. ¿Cerrar igual el mes?`))) return;
    const row = { estado: 'cerrado', cerrado_en: new Date().toISOString(), cerrado_por: me?.nick };
    try { if (c) { const { dbUpdate } = await import('../api'); await dbUpdate('fp_cierres', 'mes', m, row); } else await ins('cierres', { mes: m, ...row }); toast('Mes cerrado 🔒'); await reload(); onClose(); } catch (e: any) { toast('Error: ' + e.message); }
  };
  const reabrir = async () => { if (!(await ask('¿Reabrir el mes para poder editarlo?'))) return; const { dbUpdate } = await import('../api'); await dbUpdate('fp_cierres', 'mes', m, { estado: 'abierto', cerrado_en: null }); toast('Mes reabierto'); await reload(); onClose(); };
  return (
    <Sheet title={`Cierre de ${monthLabel(m)}`} onClose={onClose} wide>{node}
      <div className="kpis small"><div className="kpi"><span>Ingresos</span><b>{gs(r.ingresos)}</b></div><div className="kpi"><span>Egresos</span><b>{gs(r.egresos)}</b></div><div className={'kpi ' + (r.balance >= 0 ? 'pos' : 'neg')}><span>Balance</span><b>{gs(r.balance)}</b></div></div>
      <h3>Salarios</h3>
      <SalarioCalc m={m} onApply={aplicar} cerrado={cerrada} />
      <div style={{ marginTop: 16 }}>{cerrada ? <button className="btn ghost" onClick={reabrir}>Reabrir mes</button> : <button className="btn big" onClick={cerrar}>🔒 Cerrar mes (bloquea los egresos)</button>}</div>
    </Sheet>
  );
}
