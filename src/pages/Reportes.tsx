import React, { useMemo, useState } from 'react';
import { useApp } from '../store';
import { buildIndex, estadoPersona, personaStats } from '../logic';
import { allMonths, resumenMes } from '../fin';
import { BarChart, LineChart, Legend, Seg } from '../ui';
import { addMonthKey, diffDays, fmtDate, fmtDateY, gs, hm, monthLabel, monthOf, monthShort, MESES3, num, DIAS } from '../util';
import { ClassPill } from './Agenda';

function monthStats(d: any, m: string) {
  const r = resumenMes(d, m); const cl = d.clases.filter((c: any) => c.fecha.startsWith(m));
  const dadas = cl.filter((c: any) => c.estado === 'asistio').length; const aus = cl.filter((c: any) => c.estado === 'ausente').length;
  const primerSub = new Map<string, string>(); d.suscripciones.forEach((s: any) => { if (s.tipo === 'unica' || s.cancelada) return; const k = primerSub.get(s.persona_id); if (!k || s.inicio < k) primerSub.set(s.persona_id, s.inicio); });
  const altas = [...primerSub.values()].filter((f) => f.startsWith(m)).length;
  const activos = new Set(d.suscripciones.filter((s: any) => s.tipo !== 'unica' && !s.cancelada && s.inicio.slice(0, 7) <= m && s.fin.slice(0, 7) >= m).map((s: any) => s.persona_id)).size;
  const pruebas = cl.filter((c: any) => c.tipo === 'prueba' && c.estado === 'asistio').length;
  return { ...r, dadas, aus, altas, activos, pruebas, asistPct: dadas + aus ? dadas / (dadas + aus) : 0 };
}

export default function Reportes() {
  const { d, hoy, isAdmin } = useApp();
  const [futuro, setFuturo] = useState(false);
  const meses = useMemo(() => allMonths(d, hoy, futuro ? 3 : 0), [d, hoy, futuro]);
  const rows = useMemo(() => meses.map((m) => monthStats(d, m)), [d, meses]);
  const cur = monthOf(hoy); const fadedIdx = meses.map((m, i) => (m > cur ? i : -1)).filter((i) => i >= 0);
  const tot = useMemo(() => { const c = rows.filter((r) => r.m <= cur); return { ing: c.reduce((a, r) => a + r.ingresos, 0), egr: c.reduce((a, r) => a + r.egresos, 0), dadas: c.reduce((a, r) => a + r.dadas, 0), n: c.length }; }, [rows, cur]);
  const years = [...new Set(meses.map((m) => m.slice(0, 4)))]; const yrs = years.length < 2 ? [...years, String(Number(years[0]) + 1)] : years;
  const cmp = yrs.map((y) => ({ name: y, values: MESES3.map((_, i) => { const m = `${y}-${String(i + 1).padStart(2, '0')}`; if (m > cur && !futuro) return null; const r = resumenMes(d, m); return r.ingresos || r.egresos ? r.ingresos : null; }) }));
  if (!isAdmin) return <div className="page"><div className="muted pad">Los reportes financieros son solo para administradores.</div></div>;
  return (
    <div className="page">
      <header className="page-head"><h1>Reporte</h1></header>
      <div className="kpis"><div className="kpi"><span>Ingresos totales</span><b>{gs(tot.ing)}</b><small>{tot.n} meses</small></div><div className="kpi"><span>Egresos totales</span><b>{gs(tot.egr)}</b></div>
        <div className={'kpi ' + (tot.ing - tot.egr >= 0 ? 'pos' : 'neg')}><span>Resultado acumulado</span><b>{gs(tot.ing - tot.egr)}</b></div><div className="kpi"><span>Clases dadas</span><b>{num(tot.dadas)}</b></div></div>
      <label className="check"><input type="checkbox" checked={futuro} onChange={(e) => setFuturo(e.target.checked)} /> Mostrar meses que todavía no ocurrieron</label>
      <section className="box"><h3>Ingresos y egresos por mes</h3><Legend items={['Ingresos', 'Egresos']} colors={['var(--sage)', 'var(--sand)']} />
        <BarChart labels={meses.map(monthShort)} series={[{ name: 'Ingresos', values: rows.map((r) => r.ingresos) }, { name: 'Egresos', values: rows.map((r) => r.egresos) }]} faded={fadedIdx} /></section>
      <section className="box"><h3>Balance por mes</h3><LineChart labels={meses.map(monthShort)} series={[{ name: 'Balance', values: rows.map((r) => (r.m > cur && !futuro ? null : r.ingresos || r.egresos ? r.balance : null)) }]} /></section>
      <section className="box"><h3>Comparativo por año</h3><Legend items={yrs} colors={['var(--sand)', 'var(--sage)', 'var(--sky)']} /><LineChart labels={MESES3} series={cmp} colors={['var(--sand)', 'var(--sage)', 'var(--sky)']} /><div className="muted small">Ingresos de cada mes, año contra año. Con más historia vas a ver la evolución.</div></section>
      <section className="box"><h3>Personas activas y altas</h3><Legend items={['Activas', 'Altas nuevas']} colors={['var(--sage)', 'var(--sky)']} /><LineChart money={false} labels={meses.filter((m) => m <= cur).map(monthShort)} series={[{ name: 'Activas', values: rows.filter((r) => r.m <= cur).map((r) => r.activos) }, { name: 'Altas', values: rows.filter((r) => r.m <= cur).map((r) => r.altas) }]} /></section>
      <section><h3>Detalle mensual</h3><div className="table-wrap"><table className="tbl"><thead><tr><th>Mes</th><th>Ingresos</th><th>Egresos</th><th>Balance</th><th>Pagos</th><th>Activas</th><th>Altas</th><th>Pruebas</th><th>Clases</th><th>Asist.</th></tr></thead>
        <tbody>{[...rows].reverse().filter((r) => r.m <= cur || futuro).map((r) => <tr key={r.m} className={r.m > cur ? 'fut' : ''}><td>{monthShort(r.m)}</td><td>{num(r.ingresos)}</td><td>{num(r.egresos)}</td><td className={r.balance >= 0 ? 'pos' : 'neg'}>{num(r.balance)}</td><td>{r.nPagos}</td><td>{r.activos}</td><td>{r.altas}</td><td>{r.pruebas}</td><td>{r.dadas}</td><td>{r.dadas + r.aus ? Math.round(r.asistPct * 100) + '%' : '—'}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}

export function Facts({ openPersona, embedded }: { openPersona: (id: string) => void; embedded?: boolean }) {
  const { d, cfg, hoy, isAdmin } = useApp(); const idx = useMemo(() => buildIndex(d), [d]);
  const f = useMemo(() => {
    const rows = d.personas.map((p: any) => ({ p, s: personaStats(p, idx, hoy, cfg.recup_dias), e: estadoPersona(p, idx, cfg, hoy) }));
    const top = (k: (r: any) => number, n = 3, filt: (r: any) => boolean = () => true) => [...rows].filter(filt).sort((a, b) => k(b) - k(a)).slice(0, n);
    const dadas = d.clases.filter((c: any) => c.estado === 'asistio'); const prim = [...d.clases.map((c: any) => c.fecha), ...d.suscripciones.map((s: any) => s.inicio)].sort()[0];
    const porSlot = new Map<string, number>(); const porDow = new Array(8).fill(0); const porHora = new Map<string, number>(); const porProfe = new Map<string, number>();
    const slotPersonas = new Map<string, number>();
    dadas.forEach((c: any) => { const k = c.fecha + ' ' + hm(c.hora); slotPersonas.set(k, (slotPersonas.get(k) || 0) + 1); porProfe.set(c.profesora_id || 'sin', (porProfe.get(c.profesora_id || 'sin') || 0) + 1); });
    slotPersonas.forEach((n, k) => { const [fe, h] = k.split(' '); const dow = (new Date(fe + 'T00:00').getDay() + 6) % 7 + 1; porDow[dow] += n; const e = porHora.get(h) || 0; porHora.set(h, e + n); porSlot.set(h, (porSlot.get(h) || 0) + 1); });
    const avgHora = [...porHora.entries()].map(([h, n]) => ({ h, avg: n / (porSlot.get(h) || 1), n })).sort((a, b) => b.avg - a.avg);
    const solas = [...slotPersonas.values()].filter((n) => n === 1).length; const llenas = [...slotPersonas.values()].filter((n) => n >= cfg.cupo).length;
    const planCount = new Map<string, number>(); d.suscripciones.forEach((s: any) => planCount.set(s.plan_nombre, (planCount.get(s.plan_nombre) || 0) + 1));
    const planes = [...planCount.entries()].sort((a, b) => b[1] - a[1]);
    const recuentoDias = [...Array(8).keys()].slice(1).map((n) => [DIAS[n % 7], porDow[n]] as [string, number]);
    const pruebas = d.clases.filter((c: any) => c.tipo === 'prueba' && c.estado === 'asistio'); const conv = rows.filter((r: any) => r.s.clases.some((c: any) => c.tipo === 'prueba' && c.estado === 'asistio') && r.s.meses > 0).length;
    const mesesAbierto = prim ? Math.max(1, Math.round(diffDays(hoy, prim) / 30.4)) : 0;
    const totalIng = d.suscripciones.reduce((a: number, s: any) => a + (Number(s.pago_monto) || 0), 0);
    return { rows, top, dadas, prim, avgHora, solas, llenas, planes, recuentoDias, pruebas, conv, mesesAbierto, totalIng, porProfe, slots: slotPersonas.size };
  }, [d, idx, cfg, hoy]);
  const Card = ({ t, children }: any) => <div className="box fact"><h4>{t}</h4>{children}</div>;
  const Top = ({ list, fmt }: any) => <ol className="top">{list.map((r: any) => <li key={r.p.id}><button onClick={() => openPersona(r.p.id)}>{r.p.nombre}</button><b>{fmt(r)}</b></li>)}</ol>;
  return (
    <div className={embedded ? 'facts-emb' : 'page'}>{embedded ? <h2 style={{ marginBottom: 10 }}>Datos curiosos</h2> : <header className="page-head"><h1>Datos curiosos</h1></header>}
      <div className="kpis">
        <div className="kpi"><span>Abrimos desde</span><b>{f.prim ? fmtDateY(f.prim) : '—'}</b><small>{f.mesesAbierto} meses</small></div>
        <div className="kpi"><span>Clases dadas</span><b>{num(f.dadas.length)}</b><small>{num(f.slots)} horarios con alumnos/as</small></div>
        <div className="kpi"><span>Personas</span><b>{f.rows.length}</b><small>{f.rows.filter((r: any) => r.e.stage === 'inscripta').length} inscriptos/as hoy</small></div>
        {isAdmin && <div className="kpi"><span>Facturado en total</span><b>{gs(f.totalIng)}</b></div>}
      </div>
      <Card t="Quién dio las clases">{[...f.porProfe.entries()].map(([id, n]) => <div className="kv" key={id}><span>{d.profesoras.find((p: any) => p.id === id)?.nombre || 'Sin asignar (histórico)'}</span><b>{num(n)} clases</b></div>)}</Card>
      <Card t="Más asistencias"><Top list={f.top((r: any) => r.s.asist)} fmt={(r: any) => r.s.asist} /></Card>
      <Card t="Más ausencias"><Top list={f.top((r: any) => r.s.ausentes)} fmt={(r: any) => r.s.ausentes} /></Card>
      <Card t="Más recuperaciones"><Top list={f.top((r: any) => r.s.recup)} fmt={(r: any) => r.s.recup} /></Card>
      <Card t="Más antiguos/as"><Top list={[...f.rows].filter((r: any) => r.s.primera).sort((a: any, b: any) => a.s.primera.localeCompare(b.s.primera)).slice(0, 3)} fmt={(r: any) => fmtDate(r.s.primera)} /></Card>
      <Card t="Más recurrentes (meses suscriptos/as)"><Top list={f.top((r: any) => r.s.meses)} fmt={(r: any) => r.s.meses + ' meses'} /></Card>
      {isAdmin && <Card t="Quien más dinero dejó"><Top list={f.top((r: any) => r.s.pagado)} fmt={(r: any) => gs(r.s.pagado)} /></Card>}
      <Card t="Horarios más llenos (promedio por clase)">{f.avgHora.slice(0, 3).map((x: any) => <div className="kv" key={x.h}><span>{x.h}</span><b>{x.avg.toFixed(1)} personas</b></div>)}</Card>
      <Card t="Horarios más solitarios">{[...f.avgHora].reverse().slice(0, 3).map((x: any) => <div className="kv" key={x.h}><span>{x.h}</span><b>{x.avg.toFixed(1)} personas</b></div>)}<div className="muted small">{num(f.solas)} clases con una sola persona · {num(f.llenas)} con cupo completo</div></Card>
      <Card t="Días con más asistencia">{[...f.recuentoDias].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([n, v]) => <div className="kv" key={n}><span>{n}</span><b>{num(v)}</b></div>)}</Card>
      <Card t="Planes más populares">{f.planes.map(([n, v]) => <div className="kv" key={n}><span>{n}</span><b>{v} suscripciones</b></div>)}</Card>
      <Card t="Pruebas"><div className="kv"><span>Pruebas realizadas</span><b>{f.pruebas.length}</b></div><div className="kv"><span>Se inscribieron después</span><b>{f.conv} ({f.pruebas.length ? Math.round((f.conv / f.pruebas.length) * 100) : 0}%)</b></div></Card>
    </div>
  );
}
