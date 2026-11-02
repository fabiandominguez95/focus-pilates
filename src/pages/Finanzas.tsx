import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { Sheet, Field, Progress, useConfirm } from '../ui';
import { resumenMes, ultimoSaldo, salario, allMonths } from '../fin';
import { addMonthKey, diasHabilesMes, feriados, fmtDate, gs, monthLabel, monthOf, num, timeToMin, uid, daysInMonth, parseD, DIAS3, hm } from '../util';
import { buildIndex, claseTerminada, estadoPersona } from '../logic';
import { useWhats } from '../classes';
import { useNoRenueva, NoRenuevaSheet } from '../norenueva';
import { DeudaCard, AporteBtn } from '../deuda';
import { PagoParcialSheet, pagadoParcial, restante } from '../egpagos';

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

// Salario que se va devengando durante el mes (según las horas ya dadas) y proyectado a fin de mes (según todas las agendadas)
export function useSalarioMes(m: string) {
  const { d, cfg, hoy } = useApp(); const [fer, setFer] = useState<string[]>([]);
  useEffect(() => { feriados(m.slice(0, 4), cfg.pais).then((r) => setFer(r.list.map(([f]) => f).filter((f) => f.startsWith(m)))); }, [m, cfg.pais]);
  return useMemo(() => {
    const cierre = d.cierres.find((c: any) => c.mes === m); const dias = Number(cierre?.dias_habiles) || diasHabilesMes(m, cfg.dias_habiles_semana, fer) || 1;
    const horasDia = (timeToMin(cfg.cierre) - timeToMin(cfg.apertura)) / 60; const fijas = d.profesoras.filter((p: any) => p.tipo === 'fija' && p.activa !== false); const fijaId = fijas[0]?.id;
    const todas: Record<string, Set<string>> = {}; const dadas: Record<string, Set<string>> = {};
    d.clases.forEach((c: any) => {
      if (!c.fecha.startsWith(m) || !(c.estado === 'agendada' || c.estado === 'asistio')) return; const pid = c.profesora_id || fijaId; const k = c.fecha + c.hora;
      (todas[pid] ||= new Set()).add(k); if (c.estado === 'asistio' || claseTerminada(c, hoy, undefined, cfg.duracion_min)) (dadas[pid] ||= new Set()).add(k);
    });
    const egSal = d.egresos.find((e: any) => e.mes === m && e.tipo === 'salario'); const sup = (Number(egSal?.detalle?.suplencias) || 0) * (Number(cfg.monto_suplente) || 0);
    const calc = (src: Record<string, Set<string>>) => fijas.reduce((a: number, p: any) => a + salario(Number(p.salario_base) || 0, dias, src[p.id]?.size || 0, horasDia), 0) + sup;
    return { devengado: calc(dadas), proyectado: calc(todas) };
  }, [d.clases, d.profesoras, d.cierres, d.egresos, cfg, hoy, m, fer]);
}

// Cuánto falta para pagar el mes, y con qué se cubre: este mes vs. ganancia de meses anteriores
function Cobertura({ m, r, cerrada, pc, inclIng, setInclIng, inclSal, setInclSal, arr, inclArr, setInclArr }: { m: string; r: any; cerrada: boolean; pc: any; inclIng: boolean; setInclIng: (b: boolean) => void; inclSal: boolean; setInclSal: (b: boolean) => void; arr: number; inclArr: boolean; setInclArr: (b: boolean) => void }) {
  const { d, hoy, isAdmin } = useApp(); const sal = useSalarioMes(m); const [det, setDet] = useState(false);
  const esActual = m >= monthOf(hoy);
  const otros = r.egr.filter((e: any) => e.tipo !== 'salario').reduce((a: number, e: any) => a + (Number(e.monto) || 0), 0);
  const salReal = r.egr.filter((e: any) => e.tipo === 'salario').reduce((a: number, e: any) => a + (Number(e.monto) || 0), 0);
  const est = !cerrada && esActual; const ea = est && inclArr ? arr : 0; const metaHoy = (!est ? r.egresos : otros + (inclSal ? Math.max(sal.proyectado, 0) : sal.devengado)) + ea; const metaFin = (!est ? r.egresos : otros + Math.max(sal.proyectado, 0)) + ea;
  const reserva = useMemo(() => { const meses = allMonths(d, hoy).filter((x) => x < m); return Math.max(0, meses.reduce((a, x) => a + resumenMes(d, x).balance, 0)); }, [d, hoy, m]);
  const conMes = Math.min(r.ingresos, metaHoy); const falta0 = Math.max(0, metaHoy - conMes); const conReserva = Math.min(reserva, falta0); const falta1 = falta0 - conReserva;
  const aporteMes = (d.aportes || []).filter((x: any) => x.tipo === 'aporte' && x.mes === m).reduce((a: number, x: any) => a + (Number(x.monto) || 0), 0); const conAporte = Math.min(aporteMes, falta1); const falta = falta1 - conAporte;
  const escala = Math.max(metaFin, metaHoy, r.ingresos, 1); const w = (x: number) => Math.max(0, Math.min(100, (x / escala) * 100)) + '%';
  const titulo = metaHoy <= 0 ? 'Todavía no hay gastos cargados' : falta === 0 && conReserva === 0 && conAporte === 0 ? '✓ Este mes ya cubre sus gastos' : falta === 0 && conAporte > 0 && conReserva === 0 ? 'Se cubre con plata que pusiste vos' : falta === 0 ? 'Se cubre, pero usando ganancia de meses anteriores' : 'Todavía falta para cubrir el mes';
  return (
    <section className="box cob">
      <div className="sec-head"><h3>¿Cuánto falta para pagar el mes?</h3></div>
      {est && <div className="chips wrap cob-chips"><span className="muted small">Estimar:</span>
        {pc.futuro && pc.faltan.length > 0 && <button className={'chip sm' + (inclIng ? ' on' : '')} onClick={() => setInclIng(!inclIng)}>{inclIng ? '✓ ' : ''}Renovaciones +{gs(pc.porCobrar)}</button>}
        {arr > 0 && <button className={'chip sm' + (inclArr ? ' on' : '')} onClick={() => setInclArr(!inclArr)}>{inclArr ? '✓ ' : ''}Arrastre de meses anteriores +{gs(arr)}</button>}
        <button className={'chip sm' + (inclSal ? ' on' : '')} onClick={() => setInclSal(!inclSal)}>{inclSal ? '✓ ' : ''}Salario a fin de mes {gs(Math.max(sal.proyectado, 0))}</button></div>}
      <div className={'cob-t ' + (falta > 0 ? 'neg' : conReserva > 0 ? 'mid' : 'pos')}>{titulo}</div>
      <div className="cob-bar">
        <i className="cob-a" style={{ width: w(conMes) }} /><i className="cob-b" style={{ width: w(conReserva), left: w(conMes) }} />{conAporte > 0 && <i className="cob-f" style={{ left: w(conMes + conReserva), width: w(conAporte), opacity: .9, background: 'var(--sand)' }} />}{falta > 0 && <i className="cob-f" style={{ left: w(conMes + conReserva + conAporte), width: w(falta), opacity: .55 }} />}
        {metaFin > metaHoy && <i className="cob-c" style={{ left: w(metaHoy), width: w(metaFin - metaHoy) }} />}
        {metaHoy > 0 && <u className="cob-tick" style={{ left: w(metaHoy) }} />}
      </div>
      <div className="cob-leg">
        <span><i className="cob-a" /> Con este mes <b>{gs(conMes)}</b></span>
        {conReserva > 0 && <span><i className="cob-b" /> Con ganancia de meses anteriores <b>{gs(conReserva)}</b></span>}
        {conAporte > 0 && <span><i className="cob-f" style={{ background: 'var(--sand)' }} /> Con plata que pusiste vos <b>{gs(conAporte)}</b></span>}
        {falta > 0 && <span><i className="cob-f" /> Falta <b>{gs(falta)}</b></span>}
      </div>
      <div className="kv" onClick={() => setDet(!det)} style={{ cursor: 'pointer' }}><span>{det ? '▾' : '▸'} Gastos {!est ? 'del mes' : inclSal ? 'estimados a fin de mes' : 'de hoy'} ({gs(otros)} + salarios {gs(!est ? salReal : inclSal ? Math.max(sal.proyectado, 0) : sal.devengado)})</span><b>{gs(metaHoy)}</b></div>
      {det && r.egr.filter((e: any) => e.tipo !== 'salario').map((e: any) => <div className="kv small muted" key={e.id}><span>· {e.concepto}</span><b>{gs(e.monto)}</b></div>)}
      {metaFin > metaHoy && !inclSal && <div className="kv"><span>Proyectado a fin de mes (salarios suben con las clases)</span><b>{gs(metaFin)}</b></div>}
      <div className="kv"><span>Ingresos de este mes{inclIng && pc.futuro ? ' (con estimado)' : ''}</span><b>{gs(r.ingresos)}</b></div>
      {r.ingresos > metaHoy && metaHoy > 0 && <div className="kv"><span>Sobra de este mes</span><b>{gs(r.ingresos - metaHoy)}</b></div>}
      {isAdmin && <AporteBtn m={m} falta={falta} />}
      <div className="muted small">Ganancia acumulada de meses anteriores disponible: {gs(reserva)}. El salario se calcula con las horas ya dadas y va subiendo; la franja clara es lo que aún se suma hasta fin de mes.</div>
    </section>
  );
}


// Por cobrar: quiénes deberían renovar este mes y cuánto entraría; y quiénes ya pagaron
function usePorCobrar(m: string, r: any) {
  const { d, cfg, hoy } = useApp(); const nr = useNoRenueva();
  const idx = useMemo(() => buildIndex(d), [d]); const finMes = m + '-' + String(daysInMonth(m)).padStart(2, '0');
  const futuro = m >= monthOf(hoy);
  return useMemo(() => {
    const listos: any[] = [], faltan: any[] = [], noVan: any[] = []; const vistos = new Set<string>();
    r.pagos.forEach((s: any) => { if (s.tipo === 'unica' || vistos.has(s.persona_id)) return; vistos.add(s.persona_id); listos.push({ p: idx.personaById.get(s.persona_id), s, monto: Number(s.pago_monto) || 0 }); });
    if (futuro) d.personas.forEach((p: any) => {
      if (vistos.has(p.id)) return; const e = estadoPersona(p, idx, cfg, hoy); const s = e.sub; if (!s || s.tipo === 'unica' || e.stage !== 'inscripta') return;
      const subs = idx.subsByP.get(p.id) || []; if (subs.some((x: any) => x.tipo !== 'unica' && x.inicio > s.inicio)) return;
      const pl = idx.planById.get(s.plan_id); const monto = Number(s.precio_final) || Number(pl?.precio) || 0; const mk = nr.marcado(p.id, s);
      if (!s.pago_fecha) { if (s.inicio <= finMes) (mk ? noVan : faltan).push({ p, s, monto, vence: s.inicio, atraso: e.atraso, impago: true, motivo: mk?.motivo }); return; }
      const due = new Date(s.fin + 'T12:00:00'); due.setDate(due.getDate() + 1); const dueS = due.toISOString().slice(0, 10);
      if (dueS <= finMes) (mk ? noVan : faltan).push({ p, s, monto, vence: dueS, atraso: Math.max(0, e.atraso), impago: false, motivo: mk?.motivo });
    });
    faltan.sort((a, b) => a.vence.localeCompare(b.vence));
    const porCobrar = faltan.reduce((a, x) => a + x.monto, 0);
    return { listos, faltan, noVan, porCobrar, futuro };
  }, [d, idx, cfg, hoy, m, r.pagos, futuro, finMes, nr.map]);
}

function PorCobrar({ m, r, pc }: { m: string; r: any; pc: any }) {
  const { hoy } = useApp(); const wa = useWhats(); const [open, setOpen] = useState(false);
  const { listos, faltan, noVan, porCobrar, futuro } = pc; const nrh = useNoRenueva(); const [nrT, setNrT] = useState<any>(null);
  const cobrado = r.ingSubs; const total = cobrado + porCobrar;
  if (!futuro && !listos.length) return null;
  const pct = total ? Math.min(100, (cobrado / total) * 100) : 0;
  return (
    <section className="box cob">
      <div className="sec-head"><h3>Estimado de renovaciones</h3><button className="btn sm ghost" onClick={() => setOpen(true)}>Ver quiénes</button></div>
      {futuro ? <div className="cob-t">{faltan.length ? `Si renuevan las ${faltan.length} personas que faltan, entran ${gs(porCobrar)} más` : 'No quedan renovaciones por esperar este mes'}</div> : <div className="cob-t">Cobrado del mes por suscripciones</div>}
      <div className="cob-bar" onClick={() => setOpen(true)} style={{ cursor: 'pointer' }}>
        <i className="cob-a" style={{ width: pct + '%' }} />{pct < 100 && <i className="cob-f" style={{ left: pct + '%', width: (100 - pct) + '%', opacity: .55 }} />}
      </div>
      <div className="cob-leg"><span><i className="cob-a" /> Ya cobrado <b>{gs(cobrado)}</b> · {listos.length} {listos.length === 1 ? 'persona' : 'personas'}</span>{futuro && <span><i className="cob-f" /> Falta (si renuevan) <b>{gs(porCobrar)}</b> · {faltan.length}</span>}</div>
      {futuro && <div className="kv"><span>Total posible de suscripciones</span><b>{gs(total)}</b></div>}
      {futuro && <div className="muted small">Estimado con el precio de la última suscripción de cada persona inscripta. No es seguro que todas renueven.</div>}
      {nrT && <NoRenuevaSheet p={nrT.p} sub={nrT.sub} onClose={() => setNrT(null)} />}
      {open && <Sheet title={`Renovaciones · ${monthLabel(m)}`} onClose={() => setOpen(false)}>
        <div className="stack">
          {futuro && <><div className="sec-head"><h3>Faltan por renovar · {faltan.length}</h3><b>{gs(porCobrar)}</b></div>
            {faltan.length === 0 && <div className="muted small">Nadie pendiente.</div>}
            {faltan.map((x) => <div className="kv" key={x.p.id}><span><b>{x.p.nombre}</b><br /><small className="muted">{x.s.plan_nombre} · {x.impago ? 'sin pagar desde' : 'vence'} {fmtDate(x.impago ? x.vence : x.s.fin)}{x.vence < hoy ? ' · atrasada' : ''}</small></span>
              <span className="row" style={{ gap: 8, alignItems: 'center' }}><b>{gs(x.monto)}</b><button className="btn sm ghost" onClick={() => setNrT({ p: x.p, sub: x.s })}>No renovará</button><button className="btn sm ghost" onClick={() => wa(x.p, x.vence < hoy ? 'atraso' : 'renovacion', { vence: fmtDate(x.s.fin), plan: x.s.plan_nombre || 'plan' })}>WhatsApp</button></span></div>)}
            {noVan.length > 0 && <><div className="sec-head"><h3>Ya dijeron que no renuevan · {noVan.length}</h3><b>{gs(noVan.reduce((a: number, x: any) => a + x.monto, 0))}</b></div>
              {noVan.map((x: any) => <div className="kv" key={x.p.id}><span><b>{x.p.nombre}</b><br /><small className="muted">{x.s.plan_nombre} · {x.motivo || 'sin motivo'}</small></span><button className="btn sm ghost" onClick={() => nrh.deshacer(x.p.id)}>Deshacer</button></div>)}</>}</>}
          <div className="sec-head"><h3>Ya pagaron · {listos.length}</h3><b>{gs(cobrado)}</b></div>
          {listos.length === 0 && <div className="muted small">Todavía nadie este mes.</div>}
          {listos.map((x) => <div className="kv" key={x.s.id}><span><b>{x.p?.nombre || '—'}</b><br /><small className="muted">{x.s.plan_nombre} · pagó el {fmtDate(x.s.pago_fecha)}</small></span><b>{gs(x.monto)}</b></div>)}
        </div></Sheet>}
    </section>
  );
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
  const [m, setM] = useState(monthOf(hoy)); const [sum, setSum] = useState<Set<string>>(new Set()); const [add, setAdd] = useState(false); const [sim, setSim] = useState(false); const [cierre, setCierre] = useState(false); const [verPagos, setVerPagos] = useState(false); const [saldoEd, setSaldoEd] = useState(false); const [pagoE, setPagoE] = useState<any>(null); const [inclArr, setInclArr] = useState(true);
  const r0 = useMemo(() => resumenMes(d, m), [d, m]); const [inclIng, setInclIng] = useState(false); const [inclSal, setInclSal] = useState(false); const pc = usePorCobrar(m, r0); const salE = useSalarioMes(m);
  const cerrada = d.cierres.find((c: any) => c.mes === m)?.estado === 'cerrado';
  const estOk = !cerrada && m >= monthOf(hoy); const extraIng = inclIng && pc.futuro ? pc.porCobrar : 0;
  const salCargado = r0.egr.filter((e: any) => e.tipo === 'salario').reduce((a: number, e: any) => a + (Number(e.monto) || 0), 0); const extraEgr = inclSal && estOk ? Math.max(salE.proyectado, 0) - salCargado : 0;
  const r = useMemo(() => (extraIng || extraEgr) ? { ...r0, ingresos: r0.ingresos + extraIng, egresos: r0.egresos + extraEgr, balance: r0.balance + extraIng - extraEgr } : r0, [r0, extraIng, extraEgr]);
  const idx = useMemo(() => buildIndex(d), [d]);
  const arrRows = useMemo(() => d.egresos.filter((e: any) => e.mes < m && !e.suma && restante(d, e) > 0).sort((a: any, b: any) => a.mes.localeCompare(b.mes)), [d.egresos, d.egpagos, m]); const arr = arrRows.reduce((a: number, e: any) => a + restante(d, e), 0);
  const saldo = ultimoSaldo(d); const caja = useMemo(() => {
    const base = Number(saldo?.monto) || 0; const sf = saldo?.fecha || ''; const sc = saldo?.created_at || ''; const N = (x: any) => Number(x) || 0;
    const nuevo = (f: string, c: string) => !!f && (f > sf || (f === sf && !!c && c > sc));
    const ing = d.suscripciones.filter((x: any) => !x.cancelada && x.pago_fecha && nuevo(x.pago_fecha, x.created_at)).reduce((a: number, x: any) => a + N(x.pago_monto), 0) + d.ventas.filter((x: any) => nuevo(x.fecha, x.created_at)).reduce((a: number, x: any) => a + N(x.total), 0);
    const mov = (d.aportes || []).filter((x: any) => (x.created_at || '') > sc);
    const ap = mov.filter((x: any) => x.tipo === 'aporte').reduce((a: number, x: any) => a + N(x.monto), 0); const dv = mov.filter((x: any) => x.tipo === 'devolucion').reduce((a: number, x: any) => a + N(x.monto), 0);
    const propio = (e: any) => e.suma; // lo pagó el dueño: sale de la cuenta recién cuando se lo devuelven
    const pagP = (d.egpagos || []).filter((x: any) => nuevo(x.fecha, x.created_at) && !propio(d.egresos.find((e: any) => e.id === x.egreso_id) || {})).reduce((a: number, x: any) => a + N(x.monto), 0);
    const pag = pagP + d.egresos.filter((e: any) => !propio(e) && e.pagado && e.pagado_fecha && e.pagado_fecha >= sf).reduce((a: number, e: any) => a + Math.max(0, N(e.monto) - pagadoParcial(d, e.id)), 0);
    const reint = d.egresos.filter((e: any) => propio(e) && e.reintegrado && e.reintegrado_fecha && e.reintegrado_fecha >= sf).reduce((a: number, e: any) => a + N(e.monto), 0);
    const pend = d.egresos.filter((e: any) => !propio(e)).reduce((a: number, e: any) => a + restante(d, e), 0);
    const hoyCuenta = base + ing + ap - dv - pag - reint;
    return { base, ing, ap, dv, pag, reint, pend, hoyCuenta, neto: hoyCuenta - pend };
  }, [d.suscripciones, d.ventas, d.aportes, d.egresos, d.egpagos, saldo]); const neto = caja.neto;
  const pagados = r.egr.filter((e: any) => e.pagado).length; const prog = r.egr.length ? pagados / r.egr.length : 0;
  const sumaSel = r.egr.filter((e: any) => e.suma).reduce((a: number, e: any) => a + (Number(e.monto) || 0), 0);
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
        <div className="kpi"><span>Egresos{extraEgr ? ' est.' : ''}</span><b>{gs(r.egresos)}</b><small>{extraEgr ? 'con salario estimado' : 'costo operativo'}</small></div>
        <div className={'kpi ' + (r.balance >= 0 ? 'pos' : 'neg')}><span>Balance{extraIng || extraEgr ? ' est.' : ''}</span><b>{gs(r.balance)}</b><small>{extraIng || extraEgr ? 'con estimados' : (r.balance >= 0 ? 'ganancia' : 'pérdida') + ' del mes'}</small></div>
        <div className="kpi"><span>Equilibrio</span><b>{equilibrio} personas</b><small>ticket prom. {gs(ticket)}</small></div>
      </div>

      <Cobertura m={m} r={r} cerrada={cerrada} pc={pc} inclIng={inclIng} setInclIng={setInclIng} inclSal={inclSal} setInclSal={setInclSal} arr={arr} inclArr={inclArr} setInclArr={setInclArr} />
      <PorCobrar m={m} r={r0} pc={pc} />
      {isAdmin && <DeudaCard m={m} />}

      <section className="box">
        <div className="sec-head"><h3>Posición de cuenta</h3>{isAdmin && <button className="btn sm ghost" onClick={() => setSaldoEd(true)}>Actualizar</button>}</div>
        <div className="kv"><span><b>En cuenta ahora (estimado)</b></span><b style={{ fontSize: 20 }}>{gs(caja.hoyCuenta)}</b></div>
        <div className="muted small">Saldo que cargaste el {saldo ? fmtDate(saldo.fecha) : '—'}: {gs(caja.base)}{caja.ing > 0 ? ` + cobros ${gs(caja.ing)}` : ''}{caja.ap > 0 ? ` + tus aportes ${gs(caja.ap)}` : ''}{caja.pag > 0 ? ` − egresos pagados ${gs(caja.pag)}` : ''}{caja.dv + caja.reint > 0 ? ` − devoluciones ${gs(caja.dv + caja.reint)}` : ''}.</div>
        <div className="kv"><span>− Egresos sin pagar (todos los meses, descontando pagos parciales)</span><b>{gs(caja.pend)}</b></div>
        <div className={'kv total ' + (neto >= 0 ? 'pos' : 'neg')}><span>{neto >= 0 ? 'Queda después de pagar todo' : 'Falta para pagar todo'}</span><b>{gs(Math.abs(neto))}</b></div>
        <div className="muted small">Se calcula solo: el último saldo que cargaste, más cobros y aportes, menos lo que marques como pagado. Si no coincide con el banco, tocá Actualizar. Los gastos que pagaste vos (Σ) no salen de la cuenta hasta que te los devuelvan.</div>
      </section>

      <section>
        <div className="sec-head"><h2>Egresos del mes</h2><span className="count">{pagados}/{r.egr.length}</span></div>
        <Progress value={prog} tone={prog === 1 ? 'full' : ''} />
        <div className="list" style={{ marginTop: 10 }}>
          {r.egr.length === 0 && <div className="muted pad">No hay egresos cargados para este mes.</div>}
          {[...r.egr].sort((a: any, b: any) => (a.tipo === 'alquiler' ? -2 : a.tipo === 'salario' ? -1 : 0) - (b.tipo === 'alquiler' ? -2 : b.tipo === 'salario' ? -1 : 0)).map((e: any) => (
            <div key={e.id} className={'egreso' + (e.pagado ? ' paid' : '')}>
              <button className={'ck' + (e.pagado ? ' on' : '')} disabled={lock} onClick={() => upd('egresos', e.id, { pagado: !e.pagado, pagado_fecha: !e.pagado ? hoy : null }).catch((er: any) => toast(er.message))} aria-label="Pagado">{e.pagado ? '✓' : ''}</button>
              <div className="grow"><b>{e.concepto}</b>{!e.pagado && !e.suma && pagadoParcial(d, e.id) > 0 && <small className="muted"> · pagado {gs(pagadoParcial(d, e.id))}, resta {gs(restante(d, e))}</small>}{isAdmin && !e.pagado && !e.suma && <div><button className="link-btn" onClick={() => setPagoE(e)}>Pagar parte</button></div>}</div>
              <NumInput value={e.monto} disabled={lock} onSave={(n) => upd('egresos', e.id, { monto: n }).catch((er: any) => toast(er.message))} />
              {e.tipo === 'general' && <button className={'sigma' + (e.suma ? ' on' : '')} disabled={!isAdmin} onClick={() => upd('egresos', e.id, { suma: !e.suma, ...(e.suma ? { reintegrado: false, reintegrado_fecha: null } : {}) }).catch((er: any) => toast(er.message))} title="Lo pagué yo (me lo tienen que devolver)">Σ</button>}
              {isAdmin && !cerrada && <button className="x2" onClick={async () => { if (await ask(`¿Quitar "${e.concepto}" de este mes?`)) upd('egresos', e.id, { deleted_at: new Date().toISOString() }); }}>✕</button>}
            </div>))}
        </div>
        {arr > 0 && <div className="arrastre">
          <div className="sec-head"><h3>Deuda de meses anteriores</h3><b>{gs(arr)}</b></div>
          {arrRows.map((e: any) => <div className="egreso" key={e.id}><div className="grow"><b>{e.concepto}</b> <small className="muted">{monthLabel(e.mes)}{pagadoParcial(d, e.id) > 0 ? ` · ya pagaste ${gs(pagadoParcial(d, e.id))} de ${gs(e.monto)}` : ''}</small></div><b>{gs(restante(d, e))}</b>{isAdmin && <button className="btn sm ghost" onClick={() => setPagoE(e)}>Pagar</button>}</div>)}
          <div className="kv total"><span>A pagar este mes (egresos del mes + deuda anterior)</span><b>{gs(r.pend + arr)}</b></div>
          <div className="muted small">Cada deuda queda en su mes con su monto original (el balance de ese mes no cambia), pero acá se suma porque hay que pagarla. Podés pagarla de a partes.</div></div>}
        {r.egr.some((e: any) => e.suma) && <div className="sumbar"><span>Pagados por vos este mes ({r.egr.filter((e: any) => e.suma).length})</span><b>{gs(sumaSel)}</b></div>}
        {!lock && <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}><button className="btn sm" onClick={() => setAdd(true)}>+ Agregar egreso</button><button className="btn sm ghost" onClick={cargarConceptos}>Cargar fijos del mes</button></div>}
        <div className="muted small pad">Σ marca los gastos que pagás vos de tu bolsillo: quedan sumados en «Cuenta con vos» hasta que te los devuelvan.</div>
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
      {pagoE && <PagoParcialSheet e={d.egresos.find((x: any) => x.id === pagoE.id) || pagoE} onClose={() => setPagoE(null)} />}
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
